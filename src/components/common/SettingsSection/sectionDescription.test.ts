// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// A section's explanatory text is its `description` prop, shown under the title
// outside the box. A SettingsHint, or an ad-hoc intro paragraph, as the first child of the box
// is that same text in a second place, so it is refused. A hint after a row (a note on that row) is fine.
const SRC = join(__dirname, '..', '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [p] : [];
  });
}

// End index of the JSX opening tag starting at `from`: the first `>` outside
// braces and quoted strings, ignoring the `>` of `=>`.
function tagEnd(src: string, from: number): number {
  let depth = 0;
  let quote = '';
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && src[i - 1] !== '\\') quote = '';
    } else if (ch === '"' || ch === "'" || (ch === '`' && depth > 0)) quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (depth === 0 && ch === '>' && src[i - 1] !== '=') return i;
  }
  return src.length;
}

// Source text right after the opening tag of the SettingsSection at `from`,
// leading JSX comments skipped.
export function afterOpeningTag(src: string, from: number): string {
  let rest = src.slice(tagEnd(src, from) + 1).trimStart();
  while (rest.startsWith('{/*')) rest = rest.slice(rest.indexOf('*/') + 2).replace(/^\s*\}/, '').trimStart();
  return rest;
}

// True when the first child of the box is a hint or an ad-hoc intro paragraph:
// directly, behind `{cond && ...}` or a ternary's first branch, or inside a fragment.
export function opensWithIntro(rest: string): boolean {
  let text = rest;
  let conditional = false;
  for (let guard = 0; guard < 6; guard += 1) {
    if (text.startsWith('<>')) { text = text.slice(2).trimStart(); continue; }
    const cond = /^\{[^{}]*?(?:&&|\?(?!\.))\s*\(?\s*/.exec(text);
    if (cond) { conditional = true; text = text.slice(cond[0].length); continue; }
    break;
  }
  // A warning-tone hint is a live state the user must act on, not an intro.
  if (text.startsWith('<SettingsHint')) return !/\btone="warning"/.test(text.slice(0, tagEnd(text, 0)));
  if (conditional || !/^<p[\s>]/.test(text)) return false;
  return /data-settings-aside|description/i.test(text.slice(0, tagEnd(text, 0)));
}

export function startsWithHint(src: string): string[] {
  return [...src.matchAll(/<SettingsSection\b/g)]
    .filter((m) => opensWithIntro(afterOpeningTag(src, m.index ?? 0)))
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

  it('flags a conditional, ternary, fragment and ad-hoc intro opener, and survives a > in a prop', () => {
    const wrap = (inner: string) => `<SettingsSection title="a" className={x > 1 ? 'a>b' : ''}>${inner}</SettingsSection>`;
    expect(startsWithHint(wrap('{open && <SettingsHint>x</SettingsHint>}'))).toHaveLength(1);
    expect(startsWithHint(wrap('{open ? (<SettingsHint>x</SettingsHint>) : null}'))).toHaveLength(1);
    expect(startsWithHint(wrap('<><SettingsHint>x</SettingsHint></>'))).toHaveLength(1);
    expect(startsWithHint(wrap('<p className={styles.note} data-settings-aside="true">x</p>'))).toHaveLength(1);
    expect(startsWithHint(wrap('<p className={styles.description}>x</p>'))).toHaveLength(1);
    expect(startsWithHint(wrap('<p role="status">state</p>'))).toHaveLength(0);
    expect(startsWithHint(wrap('{bad && <SettingsHint tone="warning">x</SettingsHint>}'))).toHaveLength(0);
    expect(startsWithHint(wrap('{bad && <SettingsHint tone="info">x</SettingsHint>}'))).toHaveLength(1);
    expect(startsWithHint(wrap('{list.length < 1 && <SettingsHint>x</SettingsHint>}'))).toHaveLength(1);
    expect(startsWithHint(wrap('{open?.x && <SettingsRow label="r" />}'))).toHaveLength(0);
  });
});
