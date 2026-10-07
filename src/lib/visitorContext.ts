/**
 * What the server can tell about a visitor from one request, without storing
 * anything that identifies a person: no IP address is kept, location is the
 * coarse city-level lookup Vercel already does at the edge, and the user agent
 * is reduced to a device / browser / OS family.
 */

export type DeviceKind = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'

export type VisitorContext = {
  referrer: string | null
  country: string | null
  region: string | null
  city: string | null
  device: DeviceKind
  browser: string | null
  os: string | null
}

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python|httpclient|facebookexternalhit|embedly|pingdom|scrapy|axios|node-fetch/i

export function parseUserAgent(ua: string | null | undefined): Pick<VisitorContext, 'device' | 'browser' | 'os'> {
  if (!ua) return { device: 'unknown', browser: null, os: null }
  if (BOT_RE.test(ua)) return { device: 'bot', browser: null, os: null }

  let os: string | null = null
  if (/iPhone|iPod/.test(ua)) os = 'iOS'
  else if (/iPad/.test(ua)) os = 'iPadOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Windows NT/.test(ua)) os = 'Windows'
  else if (/CrOS/.test(ua)) os = 'ChromeOS'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Linux/.test(ua)) os = 'Linux'

  // Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
  let browser: string | null = 'Other'
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera'
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet'
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox'
  else if (/Chrome\/|CriOS\//.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua)) browser = 'Safari'

  let device: DeviceKind = 'desktop'
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'tablet'
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) device = 'mobile'

  return { device, browser, os }
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')

/**
 * The page a visitor arrived from, or null when there is none or it is this
 * site. Query strings are dropped: they can carry search terms and tokens.
 */
export function externalReferrer(raw: unknown, requestHost: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (requestHost && bareHost(url.host) === bareHost(requestHost)) return null
  return `${url.origin}${url.pathname}`.slice(0, 300)
}

type HeaderBag = Record<string, string | string[] | undefined>

function header(headers: HeaderBag, name: string): string | null {
  const value = headers[name]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first.length > 0 ? first : null
}

function decoded(value: string | null): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value).slice(0, 80)
  } catch {
    return value.slice(0, 80)
  }
}

/** Vercel sets the x-vercel-ip-* headers in production; locally they are absent. */
export function visitorContext(headers: HeaderBag, clientReferrer: unknown): VisitorContext {
  return {
    referrer: externalReferrer(clientReferrer, header(headers, 'host')),
    country: decoded(header(headers, 'x-vercel-ip-country')),
    region: decoded(header(headers, 'x-vercel-ip-country-region')),
    city: decoded(header(headers, 'x-vercel-ip-city')),
    ...parseUserAgent(header(headers, 'user-agent')),
  }
}
