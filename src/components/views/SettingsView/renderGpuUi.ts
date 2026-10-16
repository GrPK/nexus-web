/** Value the service stores when the user picks CPU rendering. */
export const SOFTWARE_RENDER_VALUE = 'software';

/**
 * The picker appears when there is a choice to make: a second card, or the
 * CPU option on a service that offers it.
 */
export function showRenderGpuPicker(platform: string | undefined, gpuCount: number, softwareAvailable: boolean): boolean {
  return (platform === 'windows' || platform === 'linux') && (gpuCount > 1 || softwareAvailable);
}

/** Keep the option while it is the saved choice, even if the service stops offering it. */
export function showSoftwareOption(softwareAvailable: boolean, value: string): boolean {
  return softwareAvailable || value === SOFTWARE_RENDER_VALUE;
}
