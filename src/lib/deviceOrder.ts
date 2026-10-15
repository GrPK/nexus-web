/**
 * New saved order after the user drags the visible list. Saved ids of devices
 * that are not plugged in are hidden, not dropped: each is re-inserted at its
 * old index so it returns to roughly its slot when it reappears.
 */
export function mergeDeviceOrder(saved: string[], displayed: string[]): string[] {
  const shown = new Set(displayed);
  const result = [...displayed];
  saved.forEach((id, index) => {
    if (!shown.has(id)) result.splice(Math.min(index, result.length), 0, id);
  });
  return result;
}
