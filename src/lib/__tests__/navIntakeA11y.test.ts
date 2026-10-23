import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('nav / intake / updates card accessibility', () => {
  it('mobile nav toggle exposes expanded state and the controlled menu id', () => {
    const s = read('src/components/NavHeader.jsx');
    expect(s).toContain('aria-expanded={mobileOpen}');
    expect(s).toContain('aria-controls="mobile-menu"');
    expect(s).toContain('id="mobile-menu"');
  });
  it('contact page links show keyboard focus', () => {
    expect(read('src/pages/intake.jsx')).toContain('focus-visible:ring-2');
  });
  it('contact page takes no uploads and stores nothing', () => {
    const s = read('src/pages/intake.jsx');
    for (const banned of ['supabase', 'getUserMedia', 'MediaRecorder', '<form', '<input', '<textarea', 'fetch(']) {
      expect(s, banned).not.toContain(banned);
    }
  });
  it('updates card labels its email field and shows keyboard focus', () => {
    const s = read('src/components/UpdatesCard.tsx');
    expect(s).toContain('htmlFor="updates-email"');
    expect(s).toContain('focus-visible:ring-2');
  });
});
