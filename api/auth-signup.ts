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
    const user = await createConfirmedUser(input.email.toLowerCase(), input.password, name)

    sendJson(res, 201, {
      user: {
        id: user.id,
        email: user.email,
      },
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

async function createConfirmedUser(email: string, password: string, name: string): Promise<CreatedUser> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const databaseUrl = process.env.DATABASE_URL

  if (supabaseUrl && isUsableAdminKey(serviceRoleKey)) {
    try {
      return await createConfirmedUserWithAdminApi(supabaseUrl, serviceRoleKey, email, password, name)
    } catch (error) {
      if (!isUsableDatabaseUrl(databaseUrl)) {
        throw error
      }
    }
  }

  if (isUsableDatabaseUrl(databaseUrl)) {
    return createConfirmedUserWithDatabase(databaseUrl, email, password, name)
  }

  throw new ApiError(
    503,
    'ADMIN_SIGNUP_NOT_CONFIGURED',
    'Server signup is not configured. Add SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL to create accounts without confirmation emails.',
  )
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
