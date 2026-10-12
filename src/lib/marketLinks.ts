// The hosted dashboard runs against the visitor's own Nexus, so its store pages can install.
const MY_SYSTEM_ORIGIN = 'https://my.hellonexus.com';

export function marketEffectUrl(listingId: string): string {
  return `${MY_SYSTEM_ORIGIN}/store/effects/${encodeURIComponent(listingId)}`;
}
