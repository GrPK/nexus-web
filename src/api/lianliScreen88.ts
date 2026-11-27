import { serializeCrop, type NormalizedCrop } from '../components/common/MediaCropper/mediaCrop';
import { getTokenSync } from './auth';
import { fetchService, postService, postServiceForm, putService, resolveHttp } from './service';
import type { HydroShift2Lighting, HydroShift2LightingApi, HydroShift2LightingPatch } from './hydroshift2';
import type { HydroShift2CurveMediaItem } from './hydroshift2Curve';

/**
 * The 8.8's one device row (its panel's source id too). It is connected while the glass is a panel,
 * a Windows display or only its bezel LED board is there, and its Nexus Control drives glass and ring.
 */
export const LIANLI_SCREEN88_ID = 'lianli-screen88';
/** The product name, for where no device row names it. */
export const LIANLI_SCREEN88_NAME = 'Lian Li Universal Screen 8.8';

const BASE = '/devices/lianli-screen88';
const LIGHTING = `${BASE}/lighting`;

/**
 * The Universal Screen 8.8's bezel LEDs, driven by the service itself: follow the
 * Lighting page ('canvas'), or play one of L-Connect's bezel effects. Same shape as
 * the HydroShift II lights, so the same card shows it.
 */
export function getLianLiScreen88Lighting(): Promise<HydroShift2Lighting | null> {
  return fetchService<HydroShift2Lighting>(LIGHTING);
}

export function setLianLiScreen88Lighting(patch: HydroShift2LightingPatch): Promise<unknown | null> {
  return putService(LIGHTING, patch);
}

export const LIANLI_SCREEN88_LIGHTING_API: HydroShift2LightingApi = {
  get: () => getLianLiScreen88Lighting(),
  set: patch => setLianLiScreen88Lighting(patch),
};

/** A library video's picture with the glass mounted landscape (1920x480); a service that does not say otherwise. */
export const LIANLI_SCREEN88_SCREEN_ASPECT = 1920 / 480;

export type LianLiScreen88ScreenMode = 'nexus' | 'video';

export const LIANLI_SCREEN88_SAVER_MINUTES = [0, 5, 10, 15, 30, 45, 60] as const;

/** GET /devices/lianli-screen88/settings. The service omits null fields from the JSON. */
export interface LianLiScreen88Settings {
  /** The glass is attached as a Nexus panel. */
  connected: boolean;
  firmware?: string | null;
  /** The glass is in its own Windows display mode now: an ordinary Windows monitor that Nexus cannot draw on. */
  inWindowsDisplay: boolean;
  /** Null until set in Nexus; the glass's own flag is then left as found. */
  offlineMode?: boolean | null;
  /** What the user asked for: true a Windows display, false a Nexus screen, null leave the glass as found. */
  windowsDisplay?: boolean | null;
  screenMode: LianLiScreen88ScreenMode;
  video?: string | null;
  /** Media currently on the glass: the video in video mode or a running screen saver. */
  playing?: string | null;
  screenSaverMinutes: number;
  screenSaverVideo?: string | null;
  screenSaverBrightness: number;
  /** The panel record turns the glass a quarter (rotation 90 or 270): videos play portrait, cropped 1:4. */
  videoPortrait?: boolean;
  /** A library video's picture at the current mount: 1920x480, or 480x1920 portrait. */
  videoWidth?: number;
  videoHeight?: number;
}

/** The video picture's aspect at the current mount (the cropper's, the thumbnails' and the preview's). */
export function lianLiScreen88VideoAspect(settings: Pick<LianLiScreen88Settings, 'videoWidth' | 'videoHeight'> | null): number {
  const w = settings?.videoWidth ?? 0;
  const h = settings?.videoHeight ?? 0;
  return w > 0 && h > 0 ? w / h : LIANLI_SCREEN88_SCREEN_ASPECT;
}

/** PUT body: only the fields sent change. An empty `video` or `screenSaverVideo` clears it. */
export interface LianLiScreen88SettingsPatch {
  offlineMode?: boolean;
  windowsDisplay?: boolean;
  screenMode?: LianLiScreen88ScreenMode;
  video?: string;
  screenSaverMinutes?: number;
  screenSaverVideo?: string;
  screenSaverBrightness?: number;
}

/** The library's items have the Curve's shape (the service shares the code). */
export type LianLiScreen88MediaItem = HydroShift2CurveMediaItem;

/** One of L-Connect's own template videos in the user's L-Connect folder. */
export interface LConnectVideo {
  file: string;
  /** "L-Connect 88001", the name the import gives it in the library. */
  label: string;
  sizeBytes: number;
  /** A library item with this label exists already. */
  imported: boolean;
}

export interface LConnectVideos {
  folder: string;
  videos: LConnectVideo[];
}

interface OkResponse {
  error?: boolean;
  msg?: string | null;
  name?: string | null;
}

export function getLianLiScreen88Settings(): Promise<LianLiScreen88Settings | null> {
  return fetchService<LianLiScreen88Settings>(`${BASE}/settings`);
}

export async function setLianLiScreen88Settings(patch: LianLiScreen88SettingsPatch): Promise<boolean> {
  const res = await putService<OkResponse>(`${BASE}/settings`, patch);
  return !!res && !res.error;
}

export async function getLianLiScreen88Media(): Promise<LianLiScreen88MediaItem[] | null> {
  const res = await fetchService<{ media: LianLiScreen88MediaItem[] }>(`${BASE}/media`);
  return res?.media ?? null;
}

/**
 * The stored clip's name, or null when the upload failed. The crop is the current mount's: 4:1 sent as
 * `crop`, or 1:4 sent as `portraitCrop` when the glass is mounted portrait. The other mount then shows
 * the centre of the whole clip at its own aspect.
 */
export async function uploadLianLiScreen88Media(file: File, crop: NormalizedCrop, portrait = false): Promise<{ name: string | null } | null> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append(portrait ? 'portraitCrop' : 'crop', serializeCrop(crop));
  const res = await postServiceForm<OkResponse>(`${BASE}/media`, form);
  return res && !res.error ? { name: res.name ?? null } : null;
}

export async function deleteLianLiScreen88Media(name: string): Promise<boolean> {
  const res = await postService<OkResponse>(`${BASE}/media/delete`, { name });
  return !!res && !res.error;
}

/**
 * Browser-playable preview of a clip: 960x240, or 240x960 when `portrait`; left out, the service
 * follows the current mount. A media element cannot send a Bearer header, so the token rides the query.
 */
export function lianLiScreen88MediaPreviewUrl(name: string, portrait?: boolean): string {
  const params = new URLSearchParams();
  if (portrait !== undefined) params.set('portrait', String(portrait));
  const tok = getTokenSync();
  if (tok) params.set('token', tok);
  const query = params.toString();
  const base = resolveHttp(`${BASE}/media/${encodeURIComponent(name)}/preview`);
  return query ? `${base}?${query}` : base;
}

/** L-Connect's template videos found on this PC; nothing of them ships with Nexus. */
export function getLianLiScreen88LConnectVideos(): Promise<LConnectVideos | null> {
  return fetchService<LConnectVideos>(`${BASE}/lconnect-videos`);
}

/** Copies the picked L-Connect videos into the library; their library names, or null when the service refused or did not answer. */
export async function importLianLiScreen88LConnectVideos(files: string[]): Promise<string[] | null> {
  const res = await postService<{ names?: string[]; error?: boolean }>(`${BASE}/lconnect-videos/import`, { files });
  return res && !res.error ? res.names ?? [] : null;
}
