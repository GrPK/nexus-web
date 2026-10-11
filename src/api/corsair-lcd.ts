import { authFetchWithStatus, fetchService, postServiceFormResult, putService } from './service';

/** Live state of the iCUE LINK cooler's LCD module. */
export interface CorsairLcdState {
  hasDevice: boolean;
  selectedMediaId: string | null;
  brightness: number;
  rotation: number;
  /** Library item stored in the cooler's flash, shown while Nexus is closed; null/absent is the built-in coolant screen. */
  deviceMediaId?: string | null;
}

export interface CorsairLcdPatch {
  brightness?: number;
  rotation?: number;
  mediaId?: string;
}

export function getCorsairLcdState(): Promise<CorsairLcdState | null> {
  return fetchService<CorsairLcdState>('/devices/corsair/lcd/state');
}

export function setCorsairLcd(patch: CorsairLcdPatch): Promise<unknown | null> {
  return putService('/devices/corsair/lcd/settings', patch);
}

export interface CorsairLcdMediaItem {
  id: string;
  name: string;
  type: 'static' | 'animated';
}

export function getCorsairLcdMedia(): Promise<{ items: CorsairLcdMediaItem[] } | null> {
  return fetchService<{ items: CorsairLcdMediaItem[] }>('/devices/corsair/lcd/media');
}

/** Resolves to the new library item, or the refusal message. */
export async function uploadCorsairLcdMedia(file: File): Promise<{ item?: CorsairLcdMediaItem; msg: string | null }> {
  const form = new FormData();
  form.append('file', file);
  const r = await postServiceFormResult<{ error: boolean; msg: string; item?: CorsairLcdMediaItem }>(
    '/devices/corsair/lcd/media/upload',
    form,
  );
  if (!r) return { msg: '' };
  if (r.error || !('item' in r) || !r.item) return { msg: r.msg || '' };
  return { item: r.item, msg: null };
}

/**
 * Stores a library item on the cooler (null restores the coolant-temperature screen).
 * Resolves to null on success, else the service's message ('' when it gave none).
 */
export async function setCorsairDeviceScreen(mediaId: string | null): Promise<string | null> {
  const { response, status } = await authFetchWithStatus('/devices/corsair/lcd/device-screen', {
    method: 'PUT',
    body: { mediaId },
  });
  if (!response) return '';
  let body: { error?: boolean; msg?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: the status decides.
  }
  if (status >= 200 && status < 300 && !body?.error) return null;
  return body?.msg ?? '';
}
