import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {saveNhkArticleRecords, saveNhkKnowledge} from './nhkLibrary';
import {saveNhkSessions} from './nhkMorning';
import {saveNhkPracticeMode, loadNhkPracticeMode} from './nhkPracticeMode';
const source = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
describe('calm UI and persistence contracts', () => {
  it('loads one current NHK stylesheet instead of stacking legacy layouts', () => {
    const page = source('./NhkMorningPage.tsx');
    expect(page).toContain("import './nhkCalm.css'");
    for (const old of ['nhkMorning.css','nhkReadable.css','nhkArticleStudio.css']) expect(page).not.toContain(`import './${old}'`);
    expect(source('./main.tsx')).not.toContain("import './index.css'");
  });
  it('has accessible controls, focus and reduced motion tokens', () => {
    const css = source('./nhkCalm.css');
    expect(css).toContain('min-height: 44px'); expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce'); expect(css).toContain('safe-area-inset-bottom');
  });
  it('reports quota failures without crashing or claiming saved', () => {
    const broken = {getItem: () => {throw Error('disabled');}, setItem: () => {throw Error('quota');}};
    expect(saveNhkArticleRecords([], broken)).toBe(false); expect(saveNhkKnowledge([], broken)).toBe(false);
    expect(saveNhkSessions([], broken)).toBe(false); expect(saveNhkPracticeMode('quiet',broken)).toBe(false);
    expect(loadNhkPracticeMode(broken)).toBe('voice');
  });
});
