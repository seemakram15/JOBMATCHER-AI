import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  ApiError,
  enforceRateLimit,
  handleOptions,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

const productionAppUrl = 'https://myjobmatcher.vercel.app'
const developmentAppUrl = 'http://localhost:3002'
const brevoEndpoint = 'https://api.brevo.com/v3/smtp/email'
const emailLogoUrl = `${productionAppUrl}/jobmatcher-logo.svg`

const resetSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(254),
})

interface ResetEmailConfig {
  supabaseUrl: string
  serviceRoleKey: string
  brevoApiKey: string
  senderEmail: string
  senderName: string
  redirectTo: string
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    enforceRateLimit(req, 'password-reset', 5, 15 * 60_000)

    const input = resetSchema.parse(await readJson(req))
    await sendPasswordResetEmail(input.email.toLowerCase(), req)

    // Always use a neutral success response so account existence is not exposed.
    sendJson(res, 202, { ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid email address.',
        },
      })
      return
    }

    sendError(res, error, 'PASSWORD_RESET_FAILED')
  }
}

async function sendPasswordResetEmail(email: string, req: IncomingMessage) {
  const config = getResetEmailConfig(req)
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: config.redirectTo,
    },
  })

  if (error) {
    if (isMissingUserError(error)) return
    if (isAdminConfigError(error)) {
      throw new ApiError(503, 'PASSWORD_RESET_NOT_CONFIGURED', 'Password reset is not configured on the server.')
    }
    console.error('Password reset link generation failed:', error.status || 'unknown')
    return
  }

  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    console.error('Password reset link generation returned no token hash.')
    return
  }

  const resetLink = buildAppRecoveryLink(config.redirectTo, tokenHash)

  await sendBrevoEmail({
    apiKey: config.brevoApiKey,
    senderEmail: config.senderEmail,
    senderName: config.senderName,
    toEmail: email,
    subject: 'Reset your Jobmatcher password',
    htmlContent: buildPasswordResetHtml(resetLink),
    textContent: buildPasswordResetText(resetLink),
  })
}

function getResetEmailConfig(req: IncomingMessage): ResetEmailConfig {
  const supabaseUrl = normaliseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const brevoApiKey = process.env.BREVO_API_KEY || ''
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL || ''
  const senderName = process.env.BREVO_SENDER_NAME || 'Jobmatcher'
  const appUrl = getAppBaseUrl(req)

  if (!supabaseUrl || !isUsableSecret(serviceRoleKey)) {
    throw new ApiError(
      503,
      'PASSWORD_RESET_NOT_CONFIGURED',
      'Password reset is not configured. Add SUPABASE_SERVICE_ROLE_KEY on the server.',
    )
  }

  if (!isUsableSecret(brevoApiKey)) {
    throw new ApiError(
      503,
      'BREVO_NOT_CONFIGURED',
      'Brevo email is not configured. Add BREVO_API_KEY on the server.',
    )
  }

  if (brevoApiKey.toLowerCase().startsWith('xsmtpsib')) {
    throw new ApiError(
      503,
      'BREVO_REST_KEY_REQUIRED',
      'Brevo REST API key is required. Use a v3 API key from Brevo SMTP & API, not an SMTP key.',
    )
  }

  if (!senderEmail || !z.string().email().safeParse(senderEmail).success) {
    throw new ApiError(
      503,
      'BREVO_SENDER_NOT_CONFIGURED',
      'Brevo sender is not configured. Add BREVO_SENDER_EMAIL on the server.',
    )
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    brevoApiKey,
    senderEmail,
    senderName,
    redirectTo: `${appUrl}/auth?mode=recovery`,
  }
}

async function sendBrevoEmail(input: {
  apiKey: string
  senderEmail: string
  senderName: string
  toEmail: string
  subject: string
  htmlContent: string
  textContent: string
}) {
  const response = await fetch(brevoEndpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': input.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: input.senderEmail,
        name: input.senderName,
      },
      to: [{ email: input.toEmail }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      tags: ['jobmatcher', 'password-reset'],
    }),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        503,
        'BREVO_NOT_CONFIGURED',
        'Brevo rejected the configured API key or sender. Use a v3 API key and a verified sender email.',
      )
    }
    console.error('Brevo send failed with status:', response.status)
    throw new ApiError(502, 'EMAIL_DELIVERY_FAILED', 'Could not send the reset email right now.')
  }
}

function buildPasswordResetHtml(resetLink: string) {
  const safeLink = escapeHtml(resetLink)
  const safeLogoUrl = escapeHtml(emailLogoUrl)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your Jobmatcher password</title>
  </head>
  <body style="margin:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe7f2;border-radius:22px;overflow:hidden;box-shadow:0 24px 80px rgba(31,41,55,.12);">
            <tr>
              <td style="background:#0f172a;padding:28px 32px;color:#ffffff;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="52" style="width:52px;">
                      <img src="${safeLogoUrl}" width="44" height="44" alt="Jobmatcher logo" style="display:block;width:44px;height:44px;border:0;border-radius:12px;">
                    </td>
                    <td style="padding-left:10px;">
                      <div style="font-size:20px;font-weight:800;line-height:1.2;color:#ffffff;">Jobmatcher</div>
                      <div style="font-size:13px;color:#b6c4d7;margin-top:3px;">Upload. Match. Apply smarter.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 10px;">
                <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Reset your password</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#4b5563;">
                  We received a request to reset the password for your Jobmatcher account. Use the secure button below to choose a new password.
                </p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#6b7280;">
                  If you did not request this, you can safely ignore this email. Your current password will stay unchanged.
                </p>
                <a href="${safeLink}" style="display:inline-block;background:#4f8cff;color:#ffffff;text-decoration:none;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:800;box-shadow:0 12px 30px rgba(79,140,255,.32);">
                  Reset password
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 34px;">
                <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">Button not working? Copy this secure link into your browser:</p>
                <p style="margin:0;padding:14px 16px;background:#f8fafc;border:1px solid #e5edf7;border-radius:14px;font-size:12px;line-height:1.6;color:#334155;word-break:break-all;">${safeLink}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5edf7;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">This email was sent for your Jobmatcher account security.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildPasswordResetText(resetLink: string) {
  return [
    'Reset your Jobmatcher password',
    '',
    'We received a request to reset the password for your Jobmatcher account.',
    'Open this secure link to choose a new password:',
    resetLink,
    '',
    'If you did not request this, you can ignore this email. Your current password will stay unchanged.',
    '',
    'Jobmatcher',
    'Upload. Match. Apply smarter.',
  ].join('\n')
}

function getAppBaseUrl(req: IncomingMessage) {
  const configured = normaliseUrl(process.env.APP_URL || process.env.VITE_APP_URL)
  if (configured && (process.env.NODE_ENV !== 'production' || !isLocalhost(configured))) return configured

  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host'])
  const host = forwardedHost || firstHeaderValue(req.headers.host)
  if (host && isLocalHostHeader(host)) return developmentAppUrl

  return process.env.NODE_ENV === 'production' ? productionAppUrl : developmentAppUrl
}

function buildAppRecoveryLink(redirectTo: string, tokenHash: string) {
  try {
    const url = new URL(redirectTo)
    url.searchParams.set('type', 'recovery')
    url.searchParams.set('token_hash', tokenHash)
    return url.toString()
  } catch {
    return redirectTo
  }
}

function normaliseUrl(value: unknown) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed || /dummy|placeholder/i.test(trimmed)) return ''
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function isLocalhost(value: string) {
  try {
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(new URL(value).hostname)
  } catch {
    return false
  }
}

function isLocalHostHeader(host: string) {
  const hostname = host.split(':')[0]
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)
}

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isUsableSecret(value: string | undefined) {
  return Boolean(value && !/dummy|placeholder|your-/i.test(value))
}

function isMissingUserError(error: { status?: number; message?: string }) {
  const message = (error.message || '').toLowerCase()
  return error.status === 404 || message.includes('user not found') || message.includes('unable to find user')
}

function isAdminConfigError(error: { status?: number; message?: string }) {
  const message = (error.message || '').toLowerCase()
  return error.status === 401 || error.status === 403 || message.includes('service role') || message.includes('jwt')
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

async function readJson(req: IncomingMessage) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (Buffer.byteLength(body) > 20_000) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
    }
  }
  return body ? JSON.parse(body) : {}
}
