import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const css = readFileSync(new URL('./nhkReadable.css', import.meta.url), 'utf8');

describe('readable NHK layout contract', () => {
  it('ships an explicit voice and quiet mode control with large touch targets', () => {
    expect(css).toContain('.nhk-mode-switch');
    expect(css).toMatch(/\.nhk-mode-switch\s*>\s*button[\s\S]*?min-height:\s*64px/);
    expect(css).toContain('.nhk-quiet-response');
    expect(css).toContain('.nhk-quiet-review-shell');
  });

  it('raises the base reading size and separates home information hierarchy', () => {
    expect(css).toMatch(/\.nhk-page\s*\{[\s\S]*?font-size:\s*15px/);
    expect(css).toMatch(/\.nhk-page small\s*\{[\s\S]*?font-size:\s*12px/);
    expect(css).toContain('.nhk-home-section');
    expect(css).toContain('.nhk-home-week-grid');
    expect(css).toContain('.nhk-recent-review-list');
  });
});
