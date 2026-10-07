import { INTERNAL_ROUTE_KEYS, absoluteUrl } from 'src/lib/routes'

/**
 * The sitemap is built from the route registry, so a page that joins or leaves
 * the registry joins or leaves the sitemap with it. Proxy-gated pages are not
 * in the registry and so never appear here.
 */
export function buildSitemapXml(): string {
  const urls = INTERNAL_ROUTE_KEYS.map((key) => `  <url><loc>${absoluteUrl(key)}</loc></url>`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
