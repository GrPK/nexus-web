import { fetchService, postService } from './service';
import type { SystemVolumeState } from './system';

// Default capture device. The state is exactly GET /system/volume's.

export const fetchSystemMic = () =>
  fetchService<SystemVolumeState>('/system/mic');

export const setSystemMicVolume = (volume: number) =>
  postService('/system/mic', { volume });

export const setSystemMicMuted = (muted: boolean) =>
  postService('/system/mic/mute', { muted });
