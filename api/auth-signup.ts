import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { z } from 'zod'
import { sanitiseText } from '../src/lib/security.js'
import {
  ApiError,
  enforceRateLimit,
  handleOptions,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(254),
  password: z.string().min(6, 'Password must be at least 6 characters.').max(128),
  name: z.string().trim().min(1, 'Name is required.').max(160),
})

interface CreatedUser {
  id: string
  email: string
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    enforceRateLimit(req, 'auth-signup', 8, 15 * 60_000)

    const input = signupSchema.parse(await readJson(req))
    const name = sanitiseText(input.name, 160)
    const result = await createUser(input.email.toLowerCase(), input.password, name, req)

    sendJson(res, 201, {
      user: { id: result.user.id, email: result.user.email },
      confirmationRequired: result.confirmationRequired,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid signup data.',
        },
      })
      return
    }

    sendError(res, error, 'SIGNUP_FAILED')
  }
}

interface SignupResult {
  user: CreatedUser
  confirmationRequired: boolean
}

async function createUser(email: string, password: string, name: string, req: IncomingMessage): Promise<SignupResult> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const databaseUrl = process.env.DATABASE_URL
  const brevo = getBrevoConfig()

  // Preferred path: an email provider is configured, so require email confirmation.
  // No DB fallback here — surface a clear error instead of silently auto-confirming.
  if (supabaseUrl && isUsableAdminKey(serviceRoleKey) && brevo) {
    const user = await createUnconfirmedUserWithConfirmation(supabaseUrl, serviceRoleKey, brevo, email, password, name, req)
    return { user, confirmationRequired: true }
  }

  // No email provider — create an instantly-usable account (legacy behaviour).
  if (supabaseUrl && isUsableAdminKey(serviceRoleKey)) {
    try {
      const user = await createConfirmedUserWithAdminApi(supabaseUrl, serviceRoleKey, email, password, name)
      await sendWelcomeEmail(user.email, name, req).catch((error) =>
        console.error('Welcome email failed:', error instanceof Error ? error.message : error),
      )
      return { user, confirmationRequired: false }
    } catch (error) {
      if (!isUsableDatabaseUrl(databaseUrl)) {
        throw error
      }
    }
  }

  if (isUsableDatabaseUrl(databaseUrl)) {
    const user = await createConfirmedUserWithDatabase(databaseUrl, email, password, name)
    return { user, confirmationRequired: false }
  }

  throw new ApiError(
    503,
    'ADMIN_SIGNUP_NOT_CONFIGURED',
    'Server signup is not configured. Add SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL.',
  )
}

async function createUnconfirmedUserWithConfirmation(
  supabaseUrl: string,
  serviceRoleKey: string,
  brevo: BrevoConfig,
  email: string,
  password: string,
  name: string,
  req: IncomingMessage,
): Promise<CreatedUser> {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const redirectTo = `${appBaseUrl(req)}/auth?mode=confirm`
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      data: { full_name: name, email_verified: false, phone_verified: false },
      redirectTo,
    },
  })

  if (error) {
    throw new ApiError(error.status === 422 ? 409 : 400, 'SIGNUP_FAILED', error.message)
  }

  const user = data.user
  if (!user?.id || !user.email) {
    throw new ApiError(500, 'SIGNUP_FAILED', 'Supabase did not return a created user.')
  }

  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    throw new ApiError(500, 'SIGNUP_FAILED', 'No confirmation token was generated.')
  }

  const { error: profileError } = await admin.from('users').upsert(defaultProfile(user.id, user.email, name))
  if (profileError) {
    throw new ApiError(500, 'PROFILE_CREATE_FAILED', profileError.message)
  }

  const confirmUrl = new URL(redirectTo)
  confirmUrl.searchParams.set('type', 'signup')
  confirmUrl.searchParams.set('token_hash', tokenHash)

  await sendConfirmationEmail(brevo, user.email, name, confirmUrl.toString())

  return { id: user.id, email: user.email }
}

async function createConfirmedUserWithAdminApi(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  password: string,
  name: string,
): Promise<CreatedUser> {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      email_verified: true,
      phone_verified: false,
    },
  })

  if (error) {
    throw new ApiError(error.status === 422 ? 409 : 400, 'SIGNUP_FAILED', error.message)
  }

  const user = data.user
  if (!user?.id || !user.email) {
    throw new ApiError(500, 'SIGNUP_FAILED', 'Supabase did not return a created user.')
  }

  const { error: profileError } = await admin.from('users').upsert(defaultProfile(user.id, user.email, name))

  if (profileError) {
    throw new ApiError(500, 'PROFILE_CREATE_FAILED', profileError.message)
  }

  return { id: user.id, email: user.email }
}

async function createConfirmedUserWithDatabase(databaseUrl: string, email: string, password: string, name: string): Promise<CreatedUser> {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query('begin')
    const result = await client.query<CreatedUser>(
      `
      with new_user as (
        select extensions.gen_random_uuid() as id
      ),
      inserted_user as (
        insert into auth.users (
          id,
          instance_id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          confirmation_sent_at,
          email_change,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          recovery_token,
          email_change_token_new,
          email_change_token_current,
          email_change_confirm_status,
          reauthentication_token,
          is_sso_user,
          is_anonymous
        )
        select
          id,
          '00000000-0000-0000-0000-000000000000'::uuid,
          'authenticated',
          'authenticated',
          $1::text,
          extensions.crypt($2::text, extensions.gen_salt('bf')),
          now(),
          now(),
          '',
          jsonb_build_object('provider', 'email', 'providers', array['email']),
          jsonb_build_object(
            'sub', id::text,
            'email', $1::text,
            'full_name', $3::text,
            'email_verified', true,
            'phone_verified', false
          ),
          now(),
          now(),
          '',
          '',
          '',
          '',
          0,
          '',
          false,
          false
        from new_user
        returning id, email
      ),
      inserted_identity as (
        insert into auth.identities (
          provider_id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        )
        select
          id::text,
          id,
          jsonb_build_object(
            'sub', id::text,
            'email', email,
            'full_name', $3::text,
            'email_verified', true,
            'phone_verified', false
          ),
          'email',
          now(),
          now(),
          now()
        from inserted_user
        returning user_id
      ),
      inserted_profile as (
        insert into public.users (
          id,
          email,
          name,
          role,
          location,
          target_role,
          target_roles,
          must_have_skills,
          avoid_keywords,
          preferred_countries,
          preferred_cities,
          remote_preference,
          preferred_remote,
          salary_min,
          salary_max,
          minimum_salary,
          experience_years,
          good_job_examples,
          bad_job_examples,
          profile_completed_at,
          currency,
          is_active
        )
        select
          id,
          email,
          $3::text,
          'job_seeker',
          'Remote',
          '',
          array[]::text[],
          array[]::text[],
          array[]::text[],
          array['Remote']::text[],
          array['Remote']::text[],
          'remote',
          true,
          0,
          0,
          0,
          0,
          array[]::text[],
          array[]::text[],
          null,
          'USD',
          true
        from inserted_user
        on conflict (id) do update set
          email = excluded.email,
          name = excluded.name,
          updated_at = now()
        returning id
      )
      select id::text, email::text from inserted_user
      `,
      [email, password, name],
    )
    await client.query('commit')

    const user = result.rows[0]
    if (!user?.id || !user.email) {
      throw new ApiError(500, 'SIGNUP_FAILED', 'Database signup did not return a created user.')
    }

    return user
  } catch (error) {
    await client.query('rollback').catch(() => undefined)

    if (isPostgresUniqueViolation(error)) {
      throw new ApiError(409, 'SIGNUP_FAILED', 'An account with this email already exists.')
    }

    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

function defaultProfile(id: string, email: string, name: string) {
  return {
    id,
    email,
    name,
    role: 'job_seeker',
    location: 'Remote',
    target_role: '',
    target_roles: [],
    must_have_skills: [],
    avoid_keywords: [],
    preferred_countries: ['Remote'],
    preferred_cities: ['Remote'],
    remote_preference: 'remote',
    preferred_remote: true,
    salary_min: 0,
    salary_max: 0,
    minimum_salary: 0,
    experience_years: 0,
    good_job_examples: [],
    bad_job_examples: [],
    profile_completed_at: null,
    currency: 'USD',
    is_active: true,
  }
}

function isUsableAdminKey(key: string | undefined): key is string {
  if (!key) return false

  const normalised = key.trim().toLowerCase()
  return (
    normalised.length > 20 &&
    normalised !== 'undefined' &&
    normalised !== 'null' &&
    !normalised.includes('dummy') &&
    !normalised.includes('placeholder') &&
    !normalised.startsWith('sb_publishable_') &&
    !normalised.startsWith('sb_anon_')
  )
}

function isUsableDatabaseUrl(url: string | undefined): url is string {
  if (!url) return false

  const normalised = url.trim().toLowerCase()
  return (
    normalised.startsWith('postgres://') ||
    normalised.startsWith('postgresql://')
  ) && !normalised.includes('your-password') && !normalised.includes('dummy') && !normalised.includes('placeholder')
}

function isPostgresUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

const PROD_APP_URL = 'https://myjobmatcher.vercel.app'
const DEV_APP_URL = 'http://localhost:3002'
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

function appBaseUrl(req: IncomingMessage) {
  const header = req.headers['x-forwarded-host'] || req.headers.host
  const host = Array.isArray(header) ? header[0] : header
  if (host && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(host)) return DEV_APP_URL
  const configured = (process.env.APP_URL || process.env.VITE_APP_URL || '').trim().replace(/\/+$/, '')
  if (configured && !/dummy|placeholder/i.test(configured)) return configured
  return process.env.NODE_ENV === 'production' ? PROD_APP_URL : DEV_APP_URL
}

interface BrevoConfig {
  apiKey: string
  senderEmail: string
  senderName: string
}

function getBrevoConfig(): BrevoConfig | null {
  const apiKey = process.env.BREVO_API_KEY || ''
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL || ''
  const senderName = process.env.BREVO_SENDER_NAME || 'Jobmatcher'
  const usable = (value: string) => Boolean(value && !/dummy|placeholder|your-/i.test(value))
  if (!usable(apiKey) || apiKey.toLowerCase().startsWith('xsmtpsib') || !usable(senderEmail)) return null
  return { apiKey, senderEmail, senderName }
}

async function sendBrevoEmail(
  brevo: BrevoConfig,
  input: { to: string; subject: string; html: string; text: string; tag: string },
) {
  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': brevo.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: brevo.senderEmail, name: brevo.senderName },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
      tags: ['jobmatcher', input.tag],
    }),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(503, 'BREVO_NOT_CONFIGURED', 'Brevo rejected the configured API key or sender. Use a v3 API key and a verified sender email.')
    }
    console.error('Brevo send failed with status:', response.status)
    throw new ApiError(502, 'EMAIL_DELIVERY_FAILED', 'Could not send the confirmation email right now. Please try again shortly.')
  }
}

async function sendConfirmationEmail(brevo: BrevoConfig, email: string, name: string, confirmUrl: string) {
  const firstName = escapeHtml((name || '').split(' ')[0] || 'there')
  await sendBrevoEmail(brevo, {
    to: email,
    subject: 'Confirm your Jobmatcher email',
    html: buildConfirmationHtml(firstName, escapeHtml(confirmUrl)),
    text: `Hi ${firstName},\n\nConfirm your email to activate your Jobmatcher account:\n${confirmUrl}\n\nIf you didn't create this account, you can safely ignore this email.\n\nJobmatcher — Upload. Match. Apply smarter.`,
    tag: 'confirm-email',
  })
}

async function sendWelcomeEmail(email: string, name: string, req: IncomingMessage) {
  const brevo = getBrevoConfig()
  if (!brevo) return
  const signInUrl = `${appBaseUrl(req)}/auth?mode=signin`
  const firstName = escapeHtml((name || '').split(' ')[0] || 'there')
  await sendBrevoEmail(brevo, {
    to: email,
    subject: 'Welcome to Jobmatcher — your account is ready',
    html: buildWelcomeHtml(firstName, escapeHtml(signInUrl)),
    text: `Hi ${firstName},\n\nYour Jobmatcher account is ready. Sign in to upload your CV and start matching:\n${signInUrl}\n\nJobmatcher — Upload. Match. Apply smarter.`,
    tag: 'welcome',
  })
}

function buildConfirmationHtml(firstName: string, confirmUrl: string) {
  const logo = escapeHtml(`${PROD_APP_URL}/jobmatcher-logo.svg`)
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirm your Jobmatcher email</title></head>
<body style="margin:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe7f2;border-radius:22px;overflow:hidden;box-shadow:0 24px 80px rgba(31,41,55,.12);">
        <tr><td style="background:#0f172a;padding:28px 32px;color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td width="52" style="width:52px;"><img src="${logo}" width="44" height="44" alt="Jobmatcher" style="display:block;width:44px;height:44px;border:0;border-radius:12px;"></td>
            <td style="padding-left:10px;"><div style="font-size:20px;font-weight:800;color:#ffffff;">Jobmatcher</div><div style="font-size:13px;color:#b6c4d7;margin-top:3px;">Upload. Match. Apply smarter.</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 32px 10px;">
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Confirm your email, ${firstName}</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#4b5563;">Welcome to Jobmatcher! Confirm your email address to activate your account and start matching with live jobs.</p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#6b7280;">If you didn't create this account, you can safely ignore this email.</p>
          <a href="${confirmUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:800;box-shadow:0 12px 30px rgba(99,102,241,.32);">Confirm my email</a>
        </td></tr>
        <tr><td style="padding:24px 32px 34px;"><p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">Button not working? Copy this secure link into your browser:</p><p style="margin:0;padding:14px 16px;background:#f8fafc;border:1px solid #e5edf7;border-radius:14px;font-size:12px;line-height:1.6;color:#334155;word-break:break-all;">${confirmUrl}</p></td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5edf7;"><p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">This link confirms your Jobmatcher account email.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildWelcomeHtml(firstName: string, signInUrl: string) {
  const logo = escapeHtml(`${PROD_APP_URL}/jobmatcher-logo.svg`)
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Welcome to Jobmatcher</title></head>
<body style="margin:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe7f2;border-radius:22px;overflow:hidden;box-shadow:0 24px 80px rgba(31,41,55,.12);">
        <tr><td style="background:#0f172a;padding:28px 32px;color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td width="52" style="width:52px;"><img src="${logo}" width="44" height="44" alt="Jobmatcher" style="display:block;width:44px;height:44px;border:0;border-radius:12px;"></td>
            <td style="padding-left:10px;"><div style="font-size:20px;font-weight:800;color:#ffffff;">Jobmatcher</div><div style="font-size:13px;color:#b6c4d7;margin-top:3px;">Upload. Match. Apply smarter.</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 32px 10px;">
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Welcome, ${firstName} 👋</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#4b5563;">Your account is ready. Upload your CV once, get live roles ranked by fit, and track every application in one place.</p>
          <a href="${signInUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:800;box-shadow:0 12px 30px rgba(99,102,241,.32);">Sign in to get started</a>
        </td></tr>
        <tr><td style="padding:24px 32px 34px;"><p style="margin:0;padding:14px 16px;background:#f8fafc;border:1px solid #e5edf7;border-radius:14px;font-size:12px;line-height:1.6;color:#334155;word-break:break-all;">${signInUrl}</p></td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5edf7;"><p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">For personal job-search use. You can change your password anytime from Preferences.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}

function readJson(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const contentType = req.headers['content-type'] || ''
    if (!contentType.toLowerCase().includes('application/json')) {
      reject(new ApiError(400, 'INVALID_CONTENT_TYPE', 'Expected application/json.'))
      return
    }

    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 16_384) {
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Signup payload is too large.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'))
      }
    })
    req.on('error', reject)
  })
}
