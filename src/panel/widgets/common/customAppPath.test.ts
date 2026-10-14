import { describe, it, expect } from 'vitest';
import { isLaunchablePath, launchPathLabel, looksLikeLaunchPath, normalizeLaunchPath } from './customAppPath';

describe('looksLikeLaunchPath', () => {
  it.each([
    'C:\\Games\\OnceHuman\\launcher.exe',
    'c:/Games/x.lnk',
    '\\\\server\\share\\app.exe',
    '/Applications/Foo.app',
    '~/bin/tool',
    'steam://rungameid/2139460',
  ])('accepts %s', text => expect(looksLikeLaunchPath(text)).toBe(true));

  it.each(['', '  ', 'chrome', 'Once Human', 'a:b'])('rejects %j', text => expect(looksLikeLaunchPath(text)).toBe(false));
});

describe('normalizeLaunchPath', () => {
  it('trims and strips wrapping quotes', () => {
    expect(normalizeLaunchPath('  "C:\\a b\\c.exe" ')).toBe('C:\\a b\\c.exe');
    expect(normalizeLaunchPath('C:\\a.exe')).toBe('C:\\a.exe');
  });
});

describe('launchPathLabel', () => {
  it('uses the file name for paths and the raw text for URIs', () => {
    expect(launchPathLabel('C:\\Games\\OnceHuman\\launcher.exe')).toBe('launcher.exe');
    expect(launchPathLabel('/Applications/Foo.app')).toBe('Foo.app');
    expect(launchPathLabel('steam://rungameid/2139460')).toBe('steam://rungameid/2139460');
  });
});

describe('isLaunchablePath', () => {
  it.each(['C:\\Games\\a.exe', 'D:/x.lnk', 'https://example.com', 'steam://rungameid/1'])('accepts %s', t => expect(isLaunchablePath(t)).toBe(true));
  it.each(['\\\\host\\share\\a.exe', 'ftp://x/y', 'file:///C:/a.exe', 'javascript://x', '/usr/bin/x', '~/x'])('rejects %s', t => expect(isLaunchablePath(t)).toBe(false));
});
