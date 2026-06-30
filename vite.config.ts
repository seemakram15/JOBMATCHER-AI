/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of [
    'SERPAPI_KEY',
    'APIFY_API_TOKEN',
    'APIFY_API_KEYS',
    'ADZUNA_APP_ID',
    'ADZUNA_APP_KEY',
    'ADZUNA_APP_KEYS',
    'JOOBLE_API_KEY',
    'JOOBLE_API_KEYS',
    'RAPIDAPI_KEY',
    'OPENWEB_NINJA_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'BREVO_API_KEY',
    'BREVO_SENDER_EMAIL',
    'BREVO_SENDER_NAME',
    'SENDER_EMAIL',
    'APP_URL',
  ]) {
    if (!process.env[key] && env[key]) {
      process.env[key] = env[key]
    }
  }

  return {
    plugins: [
      react(),
      {
        name: 'jobmatcher-local-api',
        configureServer(server) {
          server.middlewares.use('/api/parse-cv', async (req, res) => {
            try {
              const { default: parseCvHandler } = await import('./api/parse-cv')
              await parseCvHandler(req, res)
            } catch (error) {
              sendApiMiddlewareError(res, error)
            }
          })
          server.middlewares.use('/api/live-jobs', async (req, res) => {
            try {
              const { default: liveJobsHandler } = await import('./api/live-jobs')
              await liveJobsHandler(req, res)
            } catch (error) {
              sendApiMiddlewareError(res, error)
            }
          })
          server.middlewares.use('/api/auth-signup', async (req, res) => {
            try {
              const { default: authSignupHandler } = await import('./api/auth-signup')
              await authSignupHandler(req, res)
            } catch (error) {
              sendApiMiddlewareError(res, error)
            }
          })
          server.middlewares.use('/api/password-reset', async (req, res) => {
            try {
              const { default: passwordResetHandler } = await import('./api/password-reset')
              await passwordResetHandler(req, res)
            } catch (error) {
              sendApiMiddlewareError(res, error)
            }
          })
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
            charts: ['recharts'],
            motion: ['framer-motion'],
            dnd: ['@dnd-kit/core', '@dnd-kit/utilities'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  }
})

function sendApiMiddlewareError(res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, error: unknown) {
  res.statusCode = 500
  res.setHeader('Content-Type', 'application/json')
  res.end(
    JSON.stringify({
      error: {
        code: 'LOCAL_API_FAILED',
        message: error instanceof Error ? error.message : 'Local API route failed.',
      },
    }),
  )
}
