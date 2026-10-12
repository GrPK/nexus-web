import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEXUS_GALLERY_DROP, postGalleryDrop } from './windowActions';

type TestWindow = Window & { chrome?: { webview?: { postMessageWithAdditionalObjects?: (m: unknown, o: unknown) => void } } };

afterEach(() => {
  delete (window as TestWindow).chrome;
});

describe('postGalleryDrop', () => {
  const files = [new File(['x'], 'a.png')];

  it('returns false without a shell bridge', () => {
    expect(postGalleryDrop(files)).toBe(false);
  });

  it('posts the files and returns true when the bridge accepts them', () => {
    const post = vi.fn();
    (window as TestWindow).chrome = { webview: { postMessageWithAdditionalObjects: post } };
    expect(postGalleryDrop(files)).toBe(true);
    expect(post).toHaveBeenCalledWith(NEXUS_GALLERY_DROP, files);
  });

  it('returns false when WebView2 rejects a File with no disk path', () => {
    (window as TestWindow).chrome = {
      webview: {
        postMessageWithAdditionalObjects: () => {
          throw new TypeError('Failed to post a message: additional File object is not a file on the disk.');
        },
      },
    };
    expect(postGalleryDrop(files)).toBe(false);
  });
});
