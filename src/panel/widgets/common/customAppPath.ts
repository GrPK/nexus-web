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

/** Strips the quotes Windows adds when copying a path as text. */
export function normalizeLaunchPath(text: string): string {
  const s = text.trim();
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).trim() : s;
}

/** File name for a path, the raw text for a URI. */
export function launchPathLabel(path: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) return path;
  const name = path.split(/[\\/]/).filter(Boolean).pop();
  return name || path;
}

/** What the service will actually launch: a drive-letter path (no UNC share)
 *  or an http, https or steam URI. Anything else looksLikeLaunchPath accepts
 *  would save but silently never run. */
export function isLaunchablePath(text: string): boolean {
  const s = text.trim();
  return /^[a-zA-Z]:[\\/]/.test(s) || /^(https?|steam):\/\/\S/i.test(s);
}

/** Shape of an id the service launches directly (URI, path separator, drive
 *  path) rather than resolving through the /shortcuts list. */
export function isDirectLaunchTarget(id: string): boolean {
  return /[\\/]/.test(id) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(id);
}
