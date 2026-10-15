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
    expect(normalizeLaunchPath('/Applications/Foo.app/')).toBe('/Applications/Foo.app');
    expect(normalizeLaunchPath('/')).toBe('/');
  });
});

describe('launchPathLabel', () => {
  it('uses the file name for paths and the raw text for URIs', () => {
    expect(launchPathLabel('C:\\Games\\OnceHuman\\launcher.exe')).toBe('launcher');
    expect(launchPathLabel('/Applications/Foo.app')).toBe('Foo');
    expect(launchPathLabel('steam://rungameid/2139460')).toBe('steam://rungameid/2139460');
  });
});

describe('isLaunchablePath', () => {
  it.each(['C:\\Games\\a.exe', 'D:/x.lnk', 'https://example.com', 'steam://rungameid/1'])('accepts %s', t => expect(isLaunchablePath(t)).toBe(true));
  it.each(['\\\\host\\share\\a.exe', 'ftp://x/y', 'file:///C:/a.exe', 'javascript://x', '/usr/bin/x', '~/x'])('rejects %s', t => expect(isLaunchablePath(t)).toBe(false));
  it.each(['C:\\Program Files\\App\\app.exe', '"C:\\Program Files\\App\\app.exe"', 'C:\\Games\\Once Human\\launcher.exe'])('accepts spaces and quotes in %s', t => expect(isLaunchablePath(t)).toBe(true));
  it.each(['C:\\Games\\game.exe -windowed', 'C:\\Games\\a.lnk /x', 'D:/x/y.BAT arg'])('rejects arguments in %s', t => expect(isLaunchablePath(t)).toBe(false));
});

describe('isLaunchablePath on a Mac', () => {
  it.each(['/Applications/Foo.app', '/usr/local/bin/tool'])('accepts %s', t => expect(isLaunchablePath(t, true)).toBe(true));
  it.each(['/', '//host/x', '~/x', 'Foo.app', 'C:\\Games\\a.exe', 'D:/x.lnk', '/Applications/Foo.app --flag'])('rejects %s', t => expect(isLaunchablePath(t, true)).toBe(false));
  it('accepts a spaced app name and URIs', () => {
    expect(isLaunchablePath('/Applications/Google Chrome.app', true)).toBe(true);
    expect(isLaunchablePath('https://example.com', true)).toBe(true);
  });
});
