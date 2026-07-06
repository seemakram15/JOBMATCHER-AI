import { describe, expect, it } from 'vitest'
import { developmentAppUrl, productionAppUrl, resolveAppBaseUrl } from './app-url'

describe('server app URL resolver', () => {
  it('uses the local app URL for local development requests', () => {
    expect(resolveAppBaseUrl({ host: 'localhost:3002', configuredUrl: productionAppUrl, nodeEnv: 'production' })).toBe(
      developmentAppUrl,
    )
  })

  it('uses the configured production URL for production emails', () => {
    expect(resolveAppBaseUrl({ host: 'jobmatcher.qzz.io', configuredUrl: productionAppUrl, nodeEnv: 'production' })).toBe(
      productionAppUrl,
    )
  })

  it('ignores accidental localhost configuration in production', () => {
    expect(resolveAppBaseUrl({ configuredUrl: developmentAppUrl, nodeEnv: 'production' })).toBe(productionAppUrl)
  })
})
