// The resume as data: the single source for the /resume page and the PDF.
// public/Brooks_Roley.pdf is built from this file: after any change here, run
// `yarn resume:pdf` and commit both. src/lib/__tests__/resume.test.ts guards the
// wording (known misspellings, entity claims) so a typo can't sit unnoticed.

export interface ResumeRole {
  org: string
  role: string
  dates: string
  bullets: string[]
}

export interface SkillGroup {
  label: string
  items: string[]
}

export const SUMMARY =
  'Full-stack software engineer with ten years across healthcare, e-commerce and fintech, specializing in user interfaces. ' +
  'I build fast, accessible front ends in React, Vue and TypeScript and the Python and Node services behind them, ' +
  'and have led framework migrations, product work, and WCAG and HIPAA compliance.'

export const LOCATION = 'Orange County, CA'

export const AVAILABILITY = 'Open to full-time roles — remote, or hybrid in Orange County.'

// The home hero's one-paragraph pitch. The hero, its loading fallback and the
// site-wide meta description all read from here so they cannot drift apart.
export const HERO_SUMMARY =
  'Full-stack software engineer with a front-end lean. I build fast, accessible interfaces ' +
  'in React, Vue and TypeScript, for products and for game clients, and the services behind them.'

// Search results and link previews. Kept under ~160 characters so it is not cut off.
export const SITE_DESCRIPTION =
  'Brooks Roley — full-stack software engineer with a front-end lean: React, TypeScript, Node and Python. ' +
  'Open to full-time roles.'

// One line per break between roles, each placed after the entry at its index.
// Brooks chose (2026-10-28) one line for the years between Grove and Zoox and
// nothing more: no illness, estate or property details. resume.test.ts guards this.
export const INTERLUDES = [
  {
    afterIndex: 1,
    text: '2022 – 2024 — Family leave: caring for my father at the end of his life, and a move from the Bay Area to Orange County.',
  },
]

export const EXPERIENCE: ResumeRole[] = [
  {
    org: 'Independent',
    role: 'Software Engineer',
    dates: '2025 – Present',
    bullets: [
      'Built a bilingual intake system for Centerpointe for Children, a pediatric therapy clinic. Answers are encrypted in the browser (RSA-OAEP, AES-256-GCM), so the server and inbox hold only ciphertext.',
      'Built and run this site on Next.js, TypeScript and PostgreSQL. CI runs 1,700+ tests and Lighthouse on every change, and a scheduled AI coding agent opens pull requests that I review before they merge.',
      'Built a basketball data platform across four codebases: a Python API, a C++ engine compiled to WebAssembly, a Vue 3 game and a SwiftUI iOS app.',
      'Built a desktop launcher in Electron, React and TypeScript. Updates ship only changed chunks (16 KB of a 1.07 MB build for a one-line change); installs are verified, resumable and roll back.',
    ],
  },
  {
    org: 'Zoox',
    role: 'Software Engineer (contract)',
    dates: 'September 2024 – March 2025',
    bullets: [
      'Owned the Site Reliability team’s OnCall notification system: Vue and Vuetify, Python and FastAPI, AWS, OpsGenie, Slack, Terraform, HashiCorp Vault and Grafana.',
      'Integrated the ‘Zoox Intelligence’ AI into the OnCall app and its Slack bot.',
    ],
  },
  {
    org: 'Grove Collaborative',
    role: 'Software Engineer II',
    dates: '2019 – 2022',
    bullets: [
      'Full-stack engineer on a Django and Vue e-commerce platform, and Scrum Lead across teams focused on discovery, personalization and engagement.',
      'Led a homepage personalization service on AWS SageMaker for 1.5M+ active customers, responding in 150ms through caching and async workflows.',
      'Led the migration from Backbone.js to the Vue Composition API and Vue Router, and unified the product tiles into one data-fetching path, for faster loads and smaller bundles.',
      'Partnered with accessibility firm A360 to lead site-wide WCAG remediation.',
    ],
  },
  {
    org: 'Zipongo (now Foodsmart)',
    role: 'Senior Associate and Software Engineer',
    dates: '2017 – 2019',
    bullets: [
      'Led front-end development of role-based access control interfaces in React, Redux and Node.js with SAML single sign-on, built to HIPAA requirements.',
      'Designed and built the provider tools for creating and managing personalized nutrition plans, integrated with backend recipe services.',
    ],
  },
  {
    org: 'SigFig',
    role: 'Front End Software Engineer',
    dates: '2016 – 2017',
    bullets: [
      'Built Angular and TypeScript interfaces for banking partners including Wells Fargo, with accessibility, internationalization and a behavioral analytics layer.',
    ],
  },
  {
    org: 'Limelight Health',
    role: 'Software Engineer',
    dates: '2015 – 2016',
    bullets: [
      'Early hire at a startup FINEOS later acquired for $75M. Built Node.js quoting APIs and the PDF service (PHP, D3.js) that charted insurance costs.',
    ],
  },
]

export const SKILLS: SkillGroup[] = [
  { label: 'Languages and frameworks', items: ['TypeScript', 'JavaScript', 'Python', 'C++', 'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Django', 'FastAPI', 'D3.js', 'WebAssembly (Emscripten)'] },
  { label: 'Data', items: ['PostgreSQL', 'Supabase', 'MySQL', 'SQLite', 'Redis', 'Memcached', 'Snowflake', 'Celery'] },
  { label: 'Infrastructure and tools', items: ['AWS (S3, SageMaker)', 'Docker', 'Kubernetes', 'Terraform', 'Vercel', 'Git', 'Bash', 'Webpack'] },
  { label: 'Accessibility and standards', items: ['WCAG', 'HIPAA', 'SSO/SAML', 'A/B testing'] },
  { label: 'Monitoring and delivery', items: ['Datadog', 'Grafana', 'CI/CD with GitHub Actions'] },
  { label: 'AI', items: ['LLM API integration', 'Claude Code', 'Agent workflows under test and review'] },
]

export const EDUCATION = {
  school: 'Sonoma State University',
  degree: 'Bachelor of Science, Computer Science',
  year: '2013',
}
