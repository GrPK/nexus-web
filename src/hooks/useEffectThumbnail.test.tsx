import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchServiceBlob = vi.fn();
vi.mock('../api/service', () => ({ fetchServiceBlob: (path: string) => fetchServiceBlob(path) }));

let made = 0;
const revoked = new Set<string>();
beforeEach(() => {
  vi.resetModules();
  made = 0;
  revoked.clear();
  fetchServiceBlob.mockReset();
  fetchServiceBlob.mockImplementation(async () => new Blob(['BM']));
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:thumb-${++made}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => { revoked.add(u); });
});
afterEach(() => vi.restoreAllMocks());

async function harness() {
  const { useEffectThumbnail } = await import('./useEffectThumbnail');
  function Thumb({ version, id }: { version: string; id: string }) {
    const url = useEffectThumbnail('custom:fx1', 0, version);
    return <img data-testid={id} src={url ?? undefined} alt="" />;
  }
  return Thumb;
}

const srcOf = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="${id}"]`)?.getAttribute('src') ?? null;

describe('useEffectThumbnail', () => {
  it('never revokes an image a surface still shows when another asks for the same slot at another version', async () => {
    const Thumb = await harness();
    // The effect tile keys on the save time, the preset strip on the look's hash: same effect and slot.
    const { container } = render(<><Thumb version="1700" id="tile" /><Thumb version="hash-a" id="strip" /></>);
    await act(async () => {});
    const tile = srcOf(container, 'tile');
    const strip = srcOf(container, 'strip');
    expect(tile).toMatch(/^blob:/);
    expect(strip).toMatch(/^blob:/);
    expect(revoked.has(tile!)).toBe(false);
    expect(revoked.has(strip!)).toBe(false);
  });

  it('frees an older version once no surface shows it, and keeps the newest for the next mount', async () => {
    const Thumb = await harness();
    const { container, rerender, unmount } = render(<Thumb version="1" id="t" />);
    await act(async () => {});
    const first = srcOf(container, 't')!;
    rerender(<Thumb version="2" id="t" />);
    await act(async () => {});
    const second = srcOf(container, 't')!;
    expect(second).not.toBe(first);
    expect(revoked.has(first)).toBe(true);
    unmount();
    expect(revoked.has(second)).toBe(false);
    const again = render(<Thumb version="2" id="t" />);
    expect(srcOf(again.container, 't')).toBe(second);
    expect(fetchServiceBlob).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the last good image when a refetch fails', async () => {
    const Thumb = await harness();
    const { container, rerender } = render(<Thumb version="1" id="t" />);
    await act(async () => {});
    const first = srcOf(container, 't')!;
    fetchServiceBlob.mockResolvedValueOnce(null);
    rerender(<Thumb version="2" id="t" />);
    await act(async () => {});
    expect(srcOf(container, 't')).toBe(first);
    expect(revoked.has(first)).toBe(false);
  });

  it('shows the version it asked for when another version of the slot lands in the same tick', async () => {
    const Thumb = await harness();
    const gates: Array<(b: Blob) => void> = [];
    fetchServiceBlob.mockImplementation(() => new Promise<Blob>(r => gates.push(r)));
    const { container } = render(<><Thumb version="old" id="a" /><Thumb version="new" id="b" /></>);
    // Both fetches settle before either surface claims its image.
    await act(async () => { gates[0](new Blob(['A'])); gates[1](new Blob(['B'])); });
    const a = srcOf(container, 'a')!;
    const b = srcOf(container, 'b')!;
    expect(a).not.toBe(b);
    expect(revoked.has(a) || revoked.has(b)).toBe(false);
  });

  it('keeps the newest request cached when an older one answers late', async () => {
    const Thumb = await harness();
    const gates: Array<(b: Blob) => void> = [];
    fetchServiceBlob.mockImplementation(() => new Promise<Blob>(r => gates.push(r)));
    const first = render(<Thumb version="1" id="t" />);
    first.rerender(<Thumb version="2" id="t" />);
    await act(async () => { gates[1](new Blob(['2'])); });
    const second = srcOf(first.container, 't')!;
    await act(async () => { gates[0](new Blob(['1'])); });
    first.unmount();
    // Version 2 was requested last, so it stays cached; the late version 1 is freed.
    const again = render(<Thumb version="2" id="t" />);
    expect(srcOf(again.container, 't')).toBe(second);
    expect(revoked.has(second)).toBe(false);
    expect(revoked.size).toBe(1);
  });
});

