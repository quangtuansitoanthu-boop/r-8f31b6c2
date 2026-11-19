import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { APP_VERSION_PATH, isOlderNativeBuild, parseStoreRelease, type StoreRelease, type UpdatePlatform } from '$lib/contracts/native-app-update';
import { resolvePublicUrl } from './native-api';
import { isNativeApp, nativePlatform } from './native-platform';
import { requestDeadline } from './network-deadline';

export function watchNativeAppUpdates(onRelease: (release: StoreRelease | null) => void): () => void {
  if (!isNativeApp()) return () => {};
  const currentPlatform = nativePlatform();
  if (currentPlatform === 'web') return () => {};
  const platform: UpdatePlatform = currentPlatform;

  let disposed = false;
  let foreground = true;
  let check: AbortController | undefined;
  const listeners: PluginListenerHandle[] = [];

  async function checkOpening() {
    if (disposed || navigator.onLine === false) return;
    const opening = new AbortController();
    check = opening;
    const release = await checkForUpdate(platform, opening.signal);
    if (!opening.signal.aborted && navigator.onLine) onRelease(release);
  }

  function changeForeground(active: boolean) {
    if (disposed || active === foreground) return;
    foreground = active;
    if (active) void checkOpening();
    else {
      check?.abort();
      onRelease(null);
    }
  }

  async function track(registration: Promise<PluginListenerHandle>) {
    try {
      const listener = await registration;
      if (disposed) await listener.remove();
      else listeners.push(listener);
    } catch { /* Kiểm tra một lần khi mở nguội vẫn có thể chạy. */ }
  }

  if (platform === 'ios') {
    void track(App.addListener('pause', () => changeForeground(false)));
    void track(App.addListener('resume', () => changeForeground(true)));
  } else {
    void track(App.addListener('appStateChange', ({ isActive }) => changeForeground(isActive)));
  }
  void checkOpening();

  return () => {
    disposed = true;
    check?.abort();
    for (const listener of listeners) void listener.remove().catch(() => {});
  };
}

async function checkForUpdate(platform: UpdatePlatform, signal: AbortSignal): Promise<StoreRelease | null> {
  const deadline = requestDeadline(signal, 4_000);
  try {
    const installed = await App.getInfo();
    if (deadline.signal.aborted) return null;
    const response = await fetch(resolvePublicUrl(APP_VERSION_PATH), {
      credentials: 'omit', cache: 'no-store', signal: deadline.signal,
    });
    if (!response.ok) return null;
    const policy = await response.json() as { nativeUpdates?: Partial<Record<UpdatePlatform, unknown>> } | null;
    const release = parseStoreRelease(platform, policy?.nativeUpdates?.[platform]);
    return !deadline.signal.aborted && release && isOlderNativeBuild(platform, installed, release) ? release : null;
  } catch {
    return null;
  } finally {
    deadline.dispose();
  }
}
