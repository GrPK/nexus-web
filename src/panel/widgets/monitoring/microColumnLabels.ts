// Short captions for the Micro Vertical Bars design. Words every label ends
// with are dropped from the END only ("Pin 1 Current" and "Pin 2 Current" give
// "Pin 1" and "Pin 2"). Any empty or colliding result keeps the full labels.
export function shortColumnLabels(labels: string[]): string[] {
  if (labels.length < 2 || labels.some(l => l.trim() === '')) return labels;
  const words = labels.map(l => l.trim().split(/\s+/));
  const minLen = Math.min(...words.map(w => w.length));
  let strip = 0;
  while (strip < minLen - 1) {
    const last = words[0][words[0].length - 1 - strip].toLowerCase();
    if (!words.every(w => w[w.length - 1 - strip].toLowerCase() === last)) break;
    strip++;
  }
  if (strip === 0) return labels;
  const short = words.map(w => w.slice(0, w.length - strip).join(' '));
  return new Set(short.map(s => s.toLowerCase())).size === short.length ? short : labels;
}
