// An effect another page asked the Lighting page to run; taken once, when that page has loaded.
let pending: string | null = null;

export function requestLightingEffect(key: string): void {
  pending = key;
}

export function takeLightingEffect(): string | null {
  const key = pending;
  pending = null;
  return key;
}
