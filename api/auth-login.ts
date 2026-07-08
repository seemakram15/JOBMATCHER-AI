import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  ApiError,
  enforceRateLimit,
  enforceRateLimitByKey,
  handleOptions,
  readJson,
  requireMethod,
  sendError,
  sendJson,
  setCors,
} from './security.js'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(254),
  password: z.string().min(1, 'Password is required.').max(128),
})

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(req, res, ['POST'])
  if (handleOptions(req, res, ['POST'])) return

  try {
    requireMethod(req, ['POST'])
    enforceRateLimit(req, 'auth-login', 20, 15 * 60_000)

    const input = loginSchema.parse(await readJson(req))
    const email = input.email.toLowerCase()
    enforceRateLimitByKey(req, 'auth-login-email', email, 7, 15 * 60_000)

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !publishableKey) {
      throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Signin is not configured on the server.')
    }

    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.signInWithPassword({ email, password: input.password })

    if (error || !data.session || !data.user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    }

    sendJson(res, 200, {
      user: { id: data.user.id, email: data.user.email },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid signin data.',
        },
      })
      return
    }

    sendError(res, error, 'SIGNIN_FAILED')
  }
}
