/** @type {import('@lhci/cli').LighthouseConfig} */
module.exports = {
  ci: {
    collect: {
      // Start Next.js production server, then audit these pages
      startServerCommand: 'yarn start',
      startServerReadyPattern: 'localhost',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/resume',
        'http://localhost:3000/posts/pente',
        'http://localhost:3000/posts/luminous-flow',
        'http://localhost:3000/posts/nanu-pika-td',
        // 'http://localhost:3000/zero-paradox', // commented out until LLC is set up
      ],
      numberOfRuns: 1,
      settings: {
        // Simulate mobile by default (stricter, more meaningful)
        preset: 'desktop',
        throttlingMethod: 'simulate',
      },
    },

    assert: {
      // Per-category thresholds. 'error' blocks merge; 'warn' comments but allows.
      // Game pages (luminous-flow, pente) are canvas-heavy — performance is warn for now.
      // Accessibility and SEO are hard errors everywhere.
      assertions: {
        'categories:performance':     ['warn',  { minScore: 0.7 }],
        'categories:accessibility':   ['error', { minScore: 0.9 }],
        'categories:best-practices':  ['warn',  { minScore: 0.85 }],
        'categories:seo':             ['error', { minScore: 0.9 }],

        // Always flag missing meta
        'meta-description':           ['error', { minScore: 1 }],
        // Warn on large JS payloads — agents should not balloon bundle size
        'total-byte-weight':          ['warn',  { maxNumericValue: 500000 }],
        // Flag render-blocking resources
        'render-blocking-resources':  ['warn',  { maxLength: 2 }],
      },
    },

    upload: {
      // Results stored for 7 days, linked in the PR comment automatically
      // when LHCI_GITHUB_APP_TOKEN secret is set.
      // Install the app at: https://github.com/apps/lighthouse-ci
      target: 'temporary-public-storage',
    },
  },
}
