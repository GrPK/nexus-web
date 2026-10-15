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

function classBody(scss: string, cls: string): string {
  const m = new RegExp(`^\\.${cls}\\b[^{]*\\{([^}]*)\\}`, 'm').exec(scss);
  return m ? m[1] : '';
}

// The attributes of the opening tag that sit outside any `{...}` expression, so
// a class on an element nested inside a footer or footnote is not counted.
function topLevelAttributes(src: string, from: number): string {
  let depth = 0;
  let out = '';
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (depth === 0) {
      if (ch === '>' && src[i - 1] !== '=') break;
      out += ch;
    } else if (depth === 1 && ch !== '}') {
      out += src[i - 1] === '{' || /\w|\./.test(ch) ? ch : '';
    }
    if (ch === '}') depth -= 1;
  }
  return out;
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
        for (const m of topLevelAttributes(src, tag.index ?? 0).matchAll(/(?:className|boxClassName)=\{?(\w+)\.(\w+)\}?/g)) {
          const imp = imports.find((i) => i[1] === m[1]);
          const path = imp ? join(dirname(file), imp[2]) : scssPath;
          if (!existsSync(path)) continue;
          if (/\bmargin(-[a-z]+)?\s*:/.test(classBody(readFileSync(path, 'utf8'), m[2]))) {
            offences.push(`${relative(SRC, file)}: .${m[2]}`);
          }
        }
      }
    }
    expect(offences).toEqual([]);
  });
});
