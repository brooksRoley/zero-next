import type { GetServerSideProps } from 'next'
import { buildSitemapXml } from 'src/lib/sitemap'

// Served at /sitemap.xml. The body is written in getServerSideProps; the
// component never renders.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
  res.write(buildSitemapXml())
  res.end()
  return { props: {} }
}

export default function Sitemap() {
  return null
}
