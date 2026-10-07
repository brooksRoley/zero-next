import { describe, it, expect } from 'vitest'
import { externalReferrer, parseUserAgent, visitorContext } from 'src/lib/visitorContext'

const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  lighthouse: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Chrome-Lighthouse',
}

describe('parseUserAgent', () => {
  it.each([
    ['chromeMac', { device: 'desktop', browser: 'Chrome', os: 'macOS' }],
    ['safariIphone', { device: 'mobile', browser: 'Safari', os: 'iOS' }],
    ['edgeWindows', { device: 'desktop', browser: 'Edge', os: 'Windows' }],
    ['firefoxLinux', { device: 'desktop', browser: 'Firefox', os: 'Linux' }],
    ['ipad', { device: 'tablet', browser: 'Safari', os: 'iPadOS' }],
    ['androidTablet', { device: 'tablet', browser: 'Chrome', os: 'Android' }],
    ['googlebot', { device: 'bot', browser: null, os: null }],
    ['lighthouse', { device: 'bot', browser: null, os: null }],
  ] as const)('reads %s', (name, expected) => {
    expect(parseUserAgent(UA[name])).toEqual(expected)
  })

  it('reports unknown rather than guessing when there is no user agent', () => {
    expect(parseUserAgent(undefined)).toEqual({ device: 'unknown', browser: null, os: null })
  })
})

describe('externalReferrer', () => {
  it('keeps another site, without its query string', () => {
    expect(externalReferrer('https://www.linkedin.com/jobs/view/123?trk=secret#x', 'www.brooksroley.com')).toBe(
      'https://www.linkedin.com/jobs/view/123',
    )
  })

  it.each([
    'https://www.brooksroley.com/resume',
    'https://brooksroley.com/',
  ])('drops this site itself (%s)', (referrer) => {
    expect(externalReferrer(referrer, 'www.brooksroley.com')).toBeNull()
  })

  it.each([[''], [null], [42], ['not a url'], ['javascript:alert(1)']])('drops %j', (referrer) => {
    expect(externalReferrer(referrer, 'www.brooksroley.com')).toBeNull()
  })
})

describe('visitorContext', () => {
  it('reads coarse location from the edge headers and stores no address', () => {
    const ctx = visitorContext(
      {
        host: 'www.brooksroley.com',
        'user-agent': UA.chromeMac,
        'x-forwarded-for': '203.0.113.7',
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-country-region': 'CA',
        'x-vercel-ip-city': 'San%20Juan%20Capistrano',
      },
      'https://news.ycombinator.com/item?id=1',
    )
    expect(ctx).toEqual({
      referrer: 'https://news.ycombinator.com/item',
      country: 'US',
      region: 'CA',
      city: 'San Juan Capistrano',
      device: 'desktop',
      browser: 'Chrome',
      os: 'macOS',
    })
    expect(JSON.stringify(ctx)).not.toContain('203.0.113.7')
  })

  it('leaves location empty where the headers are absent (local development)', () => {
    const ctx = visitorContext({ host: 'localhost:3000' }, null)
    expect(ctx).toMatchObject({ country: null, region: null, city: null, referrer: null, device: 'unknown' })
  })
})
