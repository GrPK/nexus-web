// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The gap below a section belongs to the component. A class handed to
// SettingsSection or SettingsBlock (className or boxClassName) must not set a
// margin of its own, or the enforced spacing is patched per screen again.
const SRC = join(__dirname, '..', '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [p] : [];
  });
}

// Own declarations of the rule whose selector is exactly `.cls`: nested blocks
// are dropped, and `.cls-foo` or `.cls .box` rules never match.
export function classBody(scss: string, cls: string): string {
  let out = '';
  let depth = 0;
  let selector = '';
  let start = 0;
  for (let i = 0; i < scss.length; i += 1) {
    const ch = scss[i];
    if (ch === '{') {
      if (depth === 0) {
        selector = scss.slice(start, i).replace(/\/\/[^\n]*/g, '').trim();
        start = i + 1;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        if (selector.split(',').some((part) => part.trim() === `.${cls}`)) {
          out += scss.slice(start, i).replace(/\{[^{}]*\}/g, '');
        }
        start = i + 1;
      }
    }
  }
  return out;
}

// Every `styles.xxx` reference inside the className / boxClassName attributes
// of the opening tag at `from`, ternaries and template literals included.
// Classes on elements nested in other props (footer, footnote) are not counted.
export function classRefs(src: string, from: number): Array<[string, string]> {
  const refs: Array<[string, string]> = [];
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (depth === 0 && ch === '>' && src[i - 1] !== '=') break;
    if (depth === 0 && /^(?:className|boxClassName)=\{/.test(src.slice(i, i + 20))) {
      const open = src.indexOf('{', i);
      let d = 0;
      let j = open;
      for (; j < src.length; j += 1) {
        if (src[j] === '{') d += 1;
        if (src[j] === '}') { d -= 1; if (d === 0) break; }
      }
      for (const m of src.slice(open, j).matchAll(/(\w+)\.(\w+)/g)) refs.push([m[1], m[2]]);
      i = j;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
  }
  return refs;
}

describe('SettingsSection class overrides', () => {
  it('no class passed to a section or block sets a margin', () => {
    const offences: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const src = readFileSync(file, 'utf8');
      if (!/<Settings(Section|Block)\b/.test(src)) continue;
      const scssPath = join(dirname(file), file.replace(/^.*[\\/]/, '').replace(/\.tsx$/, '.module.scss'));
      const imports = [...src.matchAll(/import (\w+) from '(\.\/[^']+\.module\.scss)'/g)];
      for (const tag of src.matchAll(/<Settings(?:Section|Block)\b/g)) {
        for (const m of classRefs(src, tag.index ?? 0)) {
          const imp = imports.find((i) => i[1] === m[0]);
          const path = imp ? join(dirname(file), imp[2]) : scssPath;
          if (!existsSync(path)) continue;
          if (/\bmargin(-[a-z]+)?\s*:/.test(classBody(readFileSync(path, 'utf8'), m[1]))) {
            offences.push(`${relative(SRC, file)}: .${m[1]}`);
          }
        }
      }
    }
    expect(offences).toEqual([]);
  });
});

describe('guard helpers', () => {
  it('classBody matches the exact selector and survives nested blocks', () => {
    const scss = '.a-b { margin: 1px; }\n.a .box { margin: 1px; }\n.a { color: red; &:hover { margin: 2px; } padding: 0; }\n.c, .a { margin-top: 1px; }';
    const body = classBody(scss, 'a');
    expect(body).toContain('padding: 0');
    expect(body).toContain('margin-top: 1px');
    expect(body).not.toContain('margin: 1px;');
    expect(body).not.toContain('margin: 2px');
  });

  it('classRefs finds every class in a ternary and skips nested elements', () => {
    const src = '<SettingsSection className={on ? styles.a : styles.b} boxClassName={`${styles.c} x`} footer={<i className={styles.nested} />}>';
    expect(classRefs(src, 0).map((r) => r[1])).toEqual(['a', 'b', 'c']);
  });
});
