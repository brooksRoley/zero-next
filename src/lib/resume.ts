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
  'Full-stack software engineer with a front-end lean and ten years across healthcare, e-commerce and fintech. ' +
  'I build fast, accessible interfaces in React, Vue and TypeScript and the Python and Node services behind them, ' +
  'and I have led framework migrations and compliance work under WCAG and HIPAA.'

export const LOCATION = 'Orange County, CA'

export const AVAILABILITY = 'Open to full-time roles — remote, or hybrid in Orange County.'

// One line for the year between roles, placed after the entry at this index.
export const INTERLUDE = {
  afterIndex: 0,
  text: '2025 — Family leave: settled a parent’s estate and relocated to Orange County.',
}

export const EXPERIENCE: ResumeRole[] = [
  {
    org: 'Independent',
    role: 'Software Engineer',
    dates: '2026 – Present',
    bullets: [
      'Built and deployed a bilingual (English and Spanish) family intake system for Centerpointe for Children, a pediatric occupational therapy clinic. Answers are encrypted in the parent’s browser (RSA-OAEP and AES-256-GCM), so the form service and the inbox only ever hold ciphertext.',
      'Built and run this site on Next.js, TypeScript and PostgreSQL. CI runs the test suite and Lighthouse on every change, and an accessibility score under 90 fails the check.',
      'Work daily with AI coding agents under tests and my own review. A scheduled agent opens pull requests on this site that I review before they merge.',
      'Built a basketball data platform across four codebases: a Python API, a C++ engine compiled to WebAssembly, a Vue 3 game and a SwiftUI iOS app.',
    ],
  },
  {
    org: 'Zoox',
    role: 'Software Engineer (contract)',
    dates: 'September 2024 – March 2025',
    bullets: [
      'Owned the Site Reliability team’s OnCall notification system: Vue and Vuetify, Python and FastAPI, AWS, OpsGenie, Slack, Terraform, HashiCorp Vault and Grafana.',
      'Integrated the ‘Zoox Intelligence’ AI into the OnCall app and its Slack integration to improve developer experience.',
    ],
  },
  {
    org: 'Grove Collaborative',
    role: 'Software Engineer II',
    dates: '2019 – 2023',
    bullets: [
      'Full-stack engineer on a Django and Vue e-commerce platform, and Scrum Lead across teams focused on discovery, personalization and engagement.',
      'Led development of a homepage personalization service on AWS SageMaker that responded in 150ms through caching and async workflows, with a custom admin UI.',
      'Led the migration from Backbone.js to the Vue Composition API and Vue Router, giving faster page loads and smaller client bundles.',
      'Partnered with accessibility firm A360 to lead site-wide WCAG remediation.',
      'Unified and refactored the product tile components into one data-fetching path, improving performance, accessibility and styling across the platform.',
    ],
  },
  {
    org: 'Zipongo (now Foodsmart)',
    role: 'Senior Software Engineer',
    dates: '2017 – 2019',
    bullets: [
      'Led front-end development of role-based access control interfaces in React, Redux and Node.js with SAML single sign-on, built to HIPAA requirements.',
      'Designed and built the provider tools for creating and managing personalized nutrition plans, integrated with backend recipe services.',
      'Delivered full-stack features with product and clinical teams.',
    ],
  },
  {
    org: 'SigFig',
    role: 'Front End Software Engineer',
    dates: '2016 – 2017',
    bullets: [
      'Built Angular and TypeScript interfaces for banking partners including Wells Fargo, with an emphasis on accessibility and internationalization.',
      'Built a behavioral analytics layer that captured customer interactions for product decisions.',
    ],
  },
  {
    org: 'Limelight Health (now part of FINEOS)',
    role: 'Software Engineer',
    dates: '2015 – 2016',
    bullets: [
      'Early engineering hire on a Node.js MEAN-stack platform generating insurance quotes for employers.',
      'Built a PDF generation service in PHP and D3.js that visualized quotes across medical, dental, vision and life products.',
    ],
  },
  {
    org: 'Dev Bootcamp',
    role: 'Web Design Phase 0 Instructor',
    dates: '2014 – 2015',
    bullets: [
      'Remote tutor for an intensive course on full-stack web development in JavaScript and Ruby on Rails.',
    ],
  },
]

export const SKILLS: SkillGroup[] = [
  { label: 'Languages and frameworks', items: ['TypeScript', 'JavaScript', 'Python', 'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Django', 'FastAPI', 'D3.js'] },
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
