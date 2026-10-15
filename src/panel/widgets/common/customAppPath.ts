import { isMacAppShell } from '../../../app/windowActions';

/** True for text that reads as a launch target rather than an app-name search:
 *  a drive path, UNC path, rooted or home path, or a scheme URI. */
export function looksLikeLaunchPath(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  return /^[a-zA-Z]:[\\/]/.test(s)
    || s.startsWith('\\\\')
    || s.startsWith('/')
    || s.startsWith('~')
    || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S/.test(s);
}

/** Strips the quotes Windows adds when copying a path as text, and the trailing
 *  slash a macOS file dialog appends to a bundle path. */
export function normalizeLaunchPath(text: string): string {
  const s = text.trim();
  const unquoted = s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).trim() : s;
  return /^\/.*[^/]\/+$/.test(unquoted) ? unquoted.replace(/\/+$/, '') : unquoted;
}

/** File name without its extension for a path, the raw text for a URI. */
export function launchPathLabel(path: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) return path;
  const name = path.split(/[\\/]/).filter(Boolean).pop();
  if (!name) return path;
  const stem = name.replace(/\.[^.]+$/, '');
  return stem || name;
}

/** Text after an executable extension. A path that itself ends in the extension
 *  has none, so a folder like "Example.com Games" is not mistaken for arguments. */
function hasTrailingArgs(s: string, extensions: string): boolean {
  return new RegExp(`\\.(${extensions})\\s+\\S`, 'i').test(s) && !new RegExp(`\\.(${extensions})$`, 'i').test(s);
}

/** What the service will actually launch: on Windows a drive-letter path (no UNC
 *  share), on a Mac an absolute POSIX path (drive paths are refused there), and
 *  on both an http or https URI or a steam run link. A path with text after its executable
 *  extension is rejected, since the service launches a file and passes no
 *  arguments. Anything else looksLikeLaunchPath accepts would save but silently
 *  never run. */
export function isLaunchablePath(text: string, posix: boolean = isMacAppShell()): boolean {
  const s = normalizeLaunchPath(text);
  if (/^https?:\/\/\S/i.test(s) || /^steam:\/\/(rungameid|run)\/[0-9]+$/i.test(s)) return true;
  if (posix) return /^\/[^/\s]/.test(s) && !hasTrailingArgs(s, 'app');
  return /^[a-zA-Z]:[\\/]/.test(s) && !hasTrailingArgs(s, 'exe|lnk|bat|cmd|com|url|appref-ms');
}

/** Shape of an id the service launches directly (URI, path separator, drive
 *  path) rather than resolving through the /shortcuts list. */
export function isDirectLaunchTarget(id: string): boolean {
  return /[\\/]/.test(id) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(id);
}
