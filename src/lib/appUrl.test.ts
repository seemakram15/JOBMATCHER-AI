import { describe, expect, it } from 'vitest'
import { getAppBaseUrl, getPasswordRecoveryRedirectUrl } from './appUrl'

describe('app URL helpers', () => {
  it('uses the development port for local password reset links', () => {
    expect(getAppBaseUrl()).toBe('http://localhost:3002')
    expect(getPasswordRecoveryRedirectUrl()).toBe('http://localhost:3002/auth?mode=recovery')
  })
})
