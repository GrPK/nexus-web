import type { LightingDevice } from '../api/lighting';

/** The name a frame wears: the card's own part of a hardware name built as
 *  "{device} - {zone}" (or "{board} - {port} - {product}" on a chained port),
 *  which is the context the rail needs and the canvas cannot fit. A renamed
 *  card (originalName set) shows its name verbatim: a human typed it, dashes
 *  and all. */
export function canvasLabelName(dev: Pick<LightingDevice, 'name' | 'originalName'>): string {
  if (dev.originalName != null) return dev.name;
  const last = dev.name.lastIndexOf(' - ');
  if (last < 0) return dev.name;
  const own = dev.name.slice(last + 3).trim();
  return own || dev.name;
}
