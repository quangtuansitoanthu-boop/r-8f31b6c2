import { afterEach, expect, it, vi } from 'vitest';
import { fetchPublicMedia } from '$lib/browser/public-media-fallback';
import { readPublicMedia } from '$lib/server/http/public-media';
import type { R2BucketLike } from '$lib/server/cloudflare-context';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('tries Workers once after a public CDN failure', async () => {
  const source = 'https://media.quangtu.vn/posters/fb-poster-test.webp';
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('DNS unavailable'))
    .mockResolvedValueOnce(new Response('image'))
    .mockResolvedValueOnce(new Response('next image'));
  vi.stubGlobal('fetch', fetcher);
  expect(await (await fetchPublicMedia(source, { credentials: 'omit' })).text()).toBe('image');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toMatch(/\.workers\.dev\/api\/public-media\/posters\/fb-poster-test\.webp$/u);
  expect(await (await fetchPublicMedia(source, { credentials: 'omit' })).text()).toBe('next image');
  expect(fetcher.mock.calls[2][0]).toBe(fetcher.mock.calls[1][0]);
});

it('rejects a parked CDN HTML page and tries Workers', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_000);
  const source = 'https://media.quangtu.vn/posters/fb-poster-test.webp';
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response('<html>Parked</html>', { headers: { 'content-type': 'text/html' } }))
    .mockResolvedValueOnce(new Response('image'));
  vi.stubGlobal('fetch', fetcher);
  expect(await (await fetchPublicMedia(source, { credentials: 'omit' })).text()).toBe('image');
  expect(fetcher.mock.calls[0][0]).toBe(source);
  expect(fetcher.mock.calls[1][0]).toContain('.workers.dev/api/public-media/');
});

it('streams an allowed R2 range and rejects private keys without reading the bucket', async () => {
  const get = vi.fn().mockResolvedValue({
    size: 200, range: { offset: 0, length: 4 }, body: new Response('abcd').body,
  });
  const bucket = { get } as unknown as R2BucketLike;
  const request = new Request('https://example.test', { headers: { Range: 'bytes=0-3' } });
  expect((await readPublicMedia(request, 'private/a.mp4', bucket)).status).toBe(404);
  const response = await readPublicMedia(request, 'videos/fb-video-test.mp4', bucket);
  expect(get).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(206);
  expect(response.headers.get('Content-Range')).toBe('bytes 0-3/200');
  expect(await response.text()).toBe('abcd');
});
