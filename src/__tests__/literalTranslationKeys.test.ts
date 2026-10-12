import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';

const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// A key deleted from the locales while a call site still names it renders as
// the raw key, which no gate notices; this reads every literal t('...') key.
describe('literal translation keys', () => {
  it('every t(\'key\') names a key in en.json', () => {
    const keys = Object.keys(en);
    const known = (k: string) => k in en || keys.some(x => x.startsWith(`${k}.`));
    const missing: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      if (file.endsWith('/i18n.tsx') || file.endsWith('/StorybookModal.tsx')) continue;
      for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
        if (!known(m[1])) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
