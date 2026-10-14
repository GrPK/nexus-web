import { StrictMode, createRef } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioPreview } from './StudioPreview';

vi.mock('../../../../hooks/useShaderRenderer', () => ({
  useShaderRenderer: () => ({ ready: true, loading: false, error: null }),
}));

const flushMicrotasks = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe('StudioPreview', () => {
  const loseContext = vi.fn();
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => ({ getExtension: () => ({ loseContext }) }) as unknown as RenderingContext);

  afterEach(() => loseContext.mockClear());

  // StrictMode runs cleanup + setup on the same canvas; losing the context there
  // would leave the re-setup renderer drawing into a dead context.
  it('keeps the context through a StrictMode effect re-run', async () => {
    const { unmount } = render(
      <StrictMode>
        <StudioPreview effectKey="studio-x" stateRef={createRef()} />
      </StrictMode>,
    );
    await flushMicrotasks();
    expect(loseContext).not.toHaveBeenCalled();

    unmount();
    await flushMicrotasks();
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith('webgl2');
  });
});
