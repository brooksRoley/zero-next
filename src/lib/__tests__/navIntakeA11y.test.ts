import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('nav / intake / funding accessibility', () => {
  it('mobile nav toggle exposes expanded state and the controlled menu id', () => {
    const s = read('src/components/NavHeader.jsx');
    expect(s).toContain('aria-expanded={mobileOpen}');
    expect(s).toContain('aria-controls="mobile-menu"');
    expect(s).toContain('id="mobile-menu"');
  });
  it('intake name label is bound to its input and the message box is named', () => {
    const s = read('src/pages/intake.jsx');
    expect(s).toContain('htmlFor="intake-name"');
    expect(s).toContain('id="intake-name"');
    expect(s).toContain('aria-label="Your message"');
  });
  it('intake announces send results, exposes the tab state, and shows keyboard focus', () => {
    const s = read('src/pages/intake.jsx');
    expect(s).toContain('role="status"');
    expect(s).toContain('SEND_FAILED');
    expect(s).toContain("aria-pressed={activeTab === 'text'}");
    expect(s).toContain("aria-pressed={activeTab === 'voice'}");
    expect(s).toContain('role="alert"');
    expect(s).toContain('focus-visible:ring-2');
  });
  it('funding notify button has a visible keyboard focus ring', () => {
    expect(read('src/pages/funding.tsx')).toContain('focus-visible:ring-2');
  });
});
