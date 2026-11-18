import { readFileSync } from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';

const media = readFileSync(new URL('./fixtures/talk-video.mp4', import.meta.url));

async function expectDecodedFrame(viewer: Locator): Promise<void> {
  // Mirror synchronization writes currentTime, so clock movement alone cannot prove a decoded image.
  await expect.poll(() => viewer.locator('video').evaluate(element => {
    const video = element as HTMLVideoElement;
    const quality = typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
    return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
      && (!quality || quality.totalVideoFrames > 0);
  })).toBe(true);
}

async function revealHud(viewer: Locator): Promise<void> {
  await viewer.getByRole('button', { name: 'Hiện điều khiển video', exact: true }).click({ position: { x: 4, y: 4 } });
  await expect(viewer.locator('.video-topbar')).toHaveAttribute('aria-hidden', 'false');
}

test('mobile talk video follows one player and keeps the original audio album controls', async ({ page }, testInfo) => {
  let catalogs = 0;
  await page.route('**/api/talks?**', route => {
    catalogs++;
    return route.fulfill({ json: [
      { id: 'mobile-video', tieu_de: 'SỨ MỆNH THẦY PHÁP', visibility: 'public', tracks: [
        { title: 'Video một', url: '/__mobile-video.mp4?track=1', media_type: 'video', audio_url: '/must-not-use.m4a' },
        { title: 'Video hai', url: '/__mobile-video.mp4?track=2', media_type: 'video' },
      ] },
      { id: 'mobile-audio', tieu_de: 'SỨ MỆNH ĐỘ VONG FULL TIKTOK', visibility: 'public', tracks: [
        { title: 'Bài âm thanh', url: '/__mobile-video.mp4' },
      ] },
    ] });
  });
  await page.route('**/api/album-plays', route => route.fulfill({ json: [] }));
  await page.route('**/__mobile-video.mp4*', route => {
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;
    return route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', body: media.subarray(start, end + 1),
      headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${media.length}` } : {}) },
    });
  });
  await page.goto('/phap-thoai');
  await expect(page.locator('article').filter({ hasText: 'SỨ MỆNH THẦY PHÁP' }).getByText('Video', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mở album SỨ MỆNH THẦY PHÁP', exact: true }).click();
  const album = page.getByRole('dialog', { name: 'SỨ MỆNH THẦY PHÁP', exact: true });
  await expect(album.locator('.pt-as-btn-offline')).toBeVisible();
  await expect(album.getByRole('button', { name: /MP3|ZIP/i })).toHaveCount(0);
  await album.getByRole('button', { name: 'Phát Video một', exact: true }).click();
  const viewer = album.locator('figure.talk-video');
  await expect(viewer).toHaveClass(/expanded/);
  await expect.poll(() => viewer.locator('video').evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  await expectDecodedFrame(viewer);
  await revealHud(viewer);
  await expect(viewer.getByRole('button')).toHaveCount(8);
  await expect(viewer.getByRole('button', { name: 'Quay lại', exact: true })).toBeVisible();
  await expect(viewer.getByRole('status').filter({ hasText: 'Bạn có thể khóa màn hình' })).toBeVisible();
  await expect(viewer.getByRole('status').filter({ hasText: 'Bạn có thể khóa màn hình' })).toHaveCount(0, { timeout: 6_000 });
  await expect(viewer.locator('.video-topbar')).toHaveAttribute('aria-hidden', 'true');
  await expect(viewer.locator('.video-topbar')).toHaveJSProperty('inert', true);
  await expect(viewer.getByRole('button', { name: 'Tạm dừng', exact: true })).toHaveCount(0);
  await revealHud(viewer);
  await viewer.getByRole('button', { name: 'Bài tiếp theo', exact: true }).click();
  await expect(viewer.locator('.video-transport strong')).toHaveText('Video hai');
  await expectDecodedFrame(viewer);
  await revealHud(viewer);
  await viewer.getByRole('button', { name: 'Bài trước', exact: true }).click();
  await expect(viewer.locator('.video-transport strong')).toHaveText('Video một');
  await revealHud(viewer);
  await viewer.getByRole('button', { name: 'Danh sách bài', exact: true }).click();
  await expect(viewer).not.toHaveClass(/expanded/);
  await page.screenshot({ path: testInfo.outputPath('mobile-video-list.png') });
  await viewer.getByRole('button', { name: 'Mở rộng', exact: true }).click();
  await expect(viewer.getByRole('status').filter({ hasText: 'Bạn có thể khóa màn hình' })).toBeVisible();
  await viewer.getByRole('slider').fill('8');
  await page.screenshot({ path: testInfo.outputPath('mobile-video-back-hint.png') });
  await viewer.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(viewer).toHaveCount(0);
  const mini = page.locator('.pt-mp-info-touch');
  await expect(page.getByRole('region', { name: 'Trình phát Pháp Thoại' }).getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible();
  await mini.click();
  await expect(viewer).toHaveClass(/expanded/);
  await expect(viewer.locator('.video-transport strong')).toHaveText('Video một');
  await expect.poll(() => viewer.locator('video').evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(7);
  await expectDecodedFrame(viewer);
  await expect(page.locator('.pt-fp-sheet')).toHaveCount(0);
  await revealHud(viewer);
  await viewer.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.getByRole('button', { name: 'Mở album SỨ MỆNH ĐỘ VONG FULL TIKTOK', exact: true }).click();
  const audio = page.getByRole('dialog', { name: 'SỨ MỆNH ĐỘ VONG FULL TIKTOK', exact: true });
  await expect(audio.locator('video')).toHaveCount(0);
  await expect(audio.locator('.pt-video-badge')).toHaveCount(0);
  await expect(audio.locator('.pt-as-btn-offline')).toBeVisible();
  expect(catalogs).toBe(1);
});

test('landscape talk video keeps 16:9 inline, exits fullscreen to its list and preserves one player', async ({ page }, testInfo) => {
  let catalogs = 0;
  await page.addInitScript(() => {
    let count = 0;
    window.Audio = new Proxy(window.Audio, {
      construct(target, args, newTarget) {
        count += 1;
        return Reflect.construct(target, args, newTarget);
      },
    });
    Object.defineProperty(window, '__talkAudioInstances', { get: () => count });
  });
  const albumTitle = 'KINH ĐỊA TẠNG BỒ TÁT BỔN NGUYỆN';
  await page.route('**/api/talks?**', route => {
    catalogs += 1;
    return route.fulfill({ json: [
      { id: 'landscape-video', tieu_de: albumTitle, dien_gia: 'Vũ Tiến Dũng', visibility: 'public', tracks: [
        { title: 'PHẨM 1 (PHẦN 1)', url: '/__landscape-video.mp4?track=1', media_type: 'video', aspect_ratio: '16:9' },
        { title: 'PHẨM 1 (PHẦN 2)', url: '/__landscape-video.mp4?track=2', media_type: 'video', aspect_ratio: '16:9' },
      ] },
      { id: 'landscape-legacy-audio', tieu_de: 'ALBUM AUDIO CŨ', visibility: 'public', tracks: [
        { title: 'Bài audio cũ', url: '/__landscape-video.mp4?audio=1' },
      ] },
    ] });
  });
  await page.route('**/api/album-plays', route => route.fulfill({ json: [] }));
  await page.route('**/__landscape-video.mp4*', route => {
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;
    return route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', body: media.subarray(start, end + 1),
      headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${media.length}` } : {}) },
    });
  });
  await page.goto('/phap-thoai');
  await page.getByRole('button', { name: `Mở album ${albumTitle}`, exact: true }).click();
  const album = page.getByRole('dialog', { name: albumTitle, exact: true });
  await expect(album.locator('.pt-as-album-desc')).toContainText('Vũ Tiến Dũng');
  await expect(album).not.toContainText(/Tiến Dũng AI|youtube\.com|Kênh nguồn/);
  await expect(album.locator('.pt-as-video-poster')).toBeVisible();
  await album.locator('.pt-as-track-list').getByRole('button', { name: 'Phát PHẨM 1 (PHẦN 1)', exact: true }).click();
  const viewer = album.locator('figure.talk-video');
  await expect(viewer).toHaveClass(/landscape/);
  await expect(viewer).not.toHaveClass(/expanded/);
  await expect.poll(() => viewer.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  await expectDecodedFrame(viewer);
  await expect(viewer.locator('video')).toBeInViewport({ ratio: .9 });
  const frame = await viewer.locator('video').boundingBox();
  expect(frame).not.toBeNull();
  expect(frame!.width / frame!.height).toBeCloseTo(16 / 9, 1);
  await expect(viewer.getByRole('status').filter({ hasText: 'Bạn có thể khóa màn hình' })).toHaveCount(0);
  const layout = album.locator('.pt-as-video-layout');
  expect(await layout.evaluate(element => getComputedStyle(element).display)).toBe(page.viewportSize()!.width <= 799 ? 'block' : 'grid');
  await viewer.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await viewer.getByRole('slider').fill('5');
  await expect.poll(() => viewer.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath('landscape-video-inline.png') });
  await viewer.getByRole('button', { name: 'Toàn màn hình', exact: true }).click();
  await expect(viewer).toHaveClass(/expanded/);
  if (page.viewportSize()!.width < page.viewportSize()!.height) {
    await expect(viewer.locator('.video-stage')).toHaveCSS('transform', /^matrix\(0, 1, -1, 0,/);
  }
  await expect(viewer.getByRole('button', { name: 'Thu nhỏ', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('landscape-video-fullscreen.png') });
  await viewer.getByRole('button', { name: 'Phát', exact: true }).click();
  await expectDecodedFrame(viewer);
  await expect(viewer.locator('.video-topbar')).toHaveAttribute('aria-hidden', 'true', { timeout: 6_000 });
  await expect(viewer.locator('.video-caption')).toHaveJSProperty('inert', true);
  await revealHud(viewer);
  await viewer.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(viewer).not.toHaveClass(/expanded/);
  await expect(album.locator('.pt-as-track-list')).toBeVisible();
  await expect(viewer.locator('video')).toHaveCount(1);
  await expect.poll(() => viewer.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(4.5);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await album.locator('.pt-as-track-list').getByRole('button', { name: 'Phát PHẨM 1 (PHẦN 2)', exact: true }).click();
  await expect(viewer.locator('video')).toHaveAttribute('aria-label', 'PHẨM 1 (PHẦN 2)');
  await expect(viewer).not.toHaveClass(/expanded/);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__talkAudioInstances'))).toBe(1);
  await album.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.getByRole('button', { name: 'Mở album ALBUM AUDIO CŨ', exact: true }).click();
  const legacyAudio = page.getByRole('dialog', { name: 'ALBUM AUDIO CŨ', exact: true });
  await expect(legacyAudio.locator('video')).toHaveCount(0);
  await expect(legacyAudio.locator('.pt-as-btn-offline')).toBeVisible();
  expect(catalogs).toBe(1);
});
