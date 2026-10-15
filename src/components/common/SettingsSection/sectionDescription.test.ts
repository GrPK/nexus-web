// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// A section's explanatory text is its `description` prop, shown under the title
// outside the box. A SettingsHint as the first child of the box is that same text
// in a second place, so it is refused. A hint after a row (a note on that row) is fine.
const SRC = join(__dirname, '..', '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [p] : [];
  });
}

// Source text right after the opening tag of the SettingsSection at `from`,
// leading JSX comments skipped.
export function afterOpeningTag(src: string, from: number): string {
  let depth = 0;
  let i = from;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (depth === 0 && ch === '>' && src[i - 1] !== '=') break;
  }
  let rest = src.slice(i + 1).trimStart();
  while (rest.startsWith('{/*')) rest = rest.slice(rest.indexOf('*/') + 2).replace(/^\s*\}/, '').trimStart();
  return rest;
}

export function startsWithHint(src: string): string[] {
  return [...src.matchAll(/<SettingsSection\b/g)]
    .filter((m) => afterOpeningTag(src, m.index ?? 0).startsWith('<SettingsHint'))
    .map((m) => src.slice(0, m.index).split('\n').length.toString());
}

describe('SettingsSection explanatory text', () => {
  it('no section opens with a SettingsHint; use the description prop', () => {
    const offences: string[] = [];
    for (const file of tsxFiles(SRC)) {
      for (const line of startsWithHint(readFileSync(file, 'utf8'))) offences.push(`${relative(SRC, file)}:${line}`);
    }
    expect(offences).toEqual([]);
  });

  it('flags a leading hint, also behind a comment, and ignores a hint after a row', () => {
    const lead = '<SettingsSection title={t("a")}>\n  <SettingsHint>x</SettingsHint>\n</SettingsSection>';
    const commented = '<SettingsSection title="a" boxClassName={s.b}>{/* why */}<SettingsHint>x</SettingsHint></SettingsSection>';
    const later = '<SettingsSection title="a"><SettingsRow label="r" /><SettingsHint>x</SettingsHint></SettingsSection>';
    expect(startsWithHint(lead)).toHaveLength(1);
    expect(startsWithHint(commented)).toHaveLength(1);
    expect(startsWithHint(later)).toHaveLength(0);
  });
});
