import { fetchService, postService } from './service';

// Host radios (Wi-Fi, Bluetooth, airplane mode). A radio the host cannot
// report or switch is null and its toggle is hidden.

export type RadioKind = 'wifi' | 'bluetooth' | 'airplane';

export interface RadioState {
  on: boolean;
}

export interface RadiosState {
  wifi: RadioState | null;
  bluetooth: RadioState | null;
  airplane: RadioState | null;
}

// A refusal (unknown kind, absent radio) arrives as the error envelope.
type RadiosWire = Partial<Record<RadioKind, unknown>> & { error?: boolean };

export const RADIO_KINDS: readonly RadioKind[] = ['wifi', 'bluetooth', 'airplane'];

function normalizeRadio(raw: unknown): RadioState | null {
  if (!raw || typeof raw !== 'object') return null;
  const on = (raw as { on?: unknown }).on;
  return typeof on === 'boolean' ? { on } : null;
}

// A service that predates a radio omits it; absent reads as null, never off.
export function normalizeRadios(raw: Partial<Record<RadioKind, unknown>> | null | undefined): RadiosState {
  return {
    wifi: normalizeRadio(raw?.wifi),
    bluetooth: normalizeRadio(raw?.bluetooth),
    airplane: normalizeRadio(raw?.airplane),
  };
}

export async function fetchRadios(): Promise<RadiosState | null> {
  const raw = await fetchService<RadiosWire>('/system/radios');
  return raw && !raw.error ? normalizeRadios(raw) : null;
}

/** Resolves with the state after the change settled. */
export async function setRadio(kind: RadioKind, on: boolean): Promise<RadiosState | null> {
  const raw = await postService<RadiosWire>('/system/radios', { kind, on });
  return raw && !raw.error ? normalizeRadios(raw) : null;
}
