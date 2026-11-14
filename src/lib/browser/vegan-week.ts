import { fetchPublicMedia } from './public-media-fallback';
import { isVeganWeek, REGIONAL_VEGAN_FIRST_WEEK, ROTATING_VEGAN_VERSION, VEGAN_PACKAGE_MAX_BYTES, vietnamWeek, type VeganWeek } from '$lib/contracts/vegan-week';

const prefix = 'tutam:vegan-week:v1:';
export function needsVeganWeekUpdate(week: string, saved = readVeganWeek(week)): boolean {
  if (!saved) return true;
  if (week >= REGIONAL_VEGAN_FIRST_WEEK && saved.version !== ROTATING_VEGAN_VERSION) return true;
  if (saved.recipes?.some(r => r.steps?.some(s => /\{\d+\}/u.test(s)))) {
    return true;
  }
  return false;
}

const pending = new Map<string, Promise<VeganWeek>>();

function pruneVeganWeeks(incoming?: string): void {
  const weeks = Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length))
    .sort()
    .reverse();
  // Reserve a slot for the validated download without counting a stale copy twice.
  let slots = incoming ? 2 : 3;
  for (const week of weeks) {
    if (week === incoming) continue;
    if (slots > 0 && readVeganWeek(week)) {
      slots--;
    } else {
      localStorage.removeItem(prefix + week);
    }
  }
}

export function readVeganWeek(week: string): VeganWeek | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(prefix + week) ?? 'null');
    return isVeganWeek(value, week) ? value : null;
  } catch {
    return null;
  }
}

export function downloadVeganWeek(week: string): Promise<VeganWeek> {
  const saved = readVeganWeek(week);
  if (saved && !needsVeganWeekUpdate(week, saved)) return Promise.resolve(saved);
  const existing = pending.get(week);
  if (existing) return existing;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const version = week >= REGIONAL_VEGAN_FIRST_WEEK ? ROTATING_VEGAN_VERSION : 1;
      let data: unknown = null;
      if (typeof location !== 'undefined') {
        try {
          const localRes = await fetch('/vegan/weeks/v' + version + '/' + encodeURIComponent(week) + '.json', {
            signal: controller.signal,
          });
          if (localRes.ok) {
            const body = await localRes.text();
            const parsed: unknown = JSON.parse(body);
            if (isVeganWeek(parsed, week) && parsed.version === version && !needsVeganWeekUpdate(week, parsed as VeganWeek)) {
              data = parsed;
            }
          }
        } catch {
          // Fall back to remote media host
        }
      }

      if (!data) {
        const response = await fetchPublicMedia('https://media.quangtu.vn/vegan/weeks/v' + version + '/' + encodeURIComponent(week) + '.json', {
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('vegan-week-unavailable');
        const body = await response.text();
        if (new TextEncoder().encode(body).length > VEGAN_PACKAGE_MAX_BYTES) throw new Error('vegan-week-too-large');
        const parsed: unknown = JSON.parse(body);
        if (!isVeganWeek(parsed, week) || parsed.version !== version) throw new Error('vegan-week-invalid');
        data = parsed;
      }
      pruneVeganWeeks(week);
      localStorage.setItem(prefix + week, JSON.stringify(data));
      return data as VeganWeek;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => pending.delete(week));
  pending.set(week, request);
  return request;
}
export function latestVeganWeek(before: string): VeganWeek | null {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix)).sort().reverse();
    for (const key of keys) {
      const week = key.slice(prefix.length);
      if (week < before) {
        const saved = readVeganWeek(week);
        if (saved) return saved;
      }
    }
  } catch {
    // Storage may be disabled.
  }
  return null;
}

/** While the app is in use, prepare the next menu for devices that already use this feature. */
export function watchVeganWeekPreload() {
  try {
    pruneVeganWeeks();
  } catch {
    // Storage may be disabled.
  }
  let timer: ReturnType<typeof setTimeout>;
  function refresh() {
    clearTimeout(timer);
    if (document.hidden) return;
    const now = new Date();
    const schedule = vietnamWeek(now);
    if (schedule.preload && navigator.onLine && needsVeganWeekUpdate(schedule.next)
      && (readVeganWeek(schedule.current) || latestVeganWeek(schedule.current))) {
      void downloadVeganWeek(schedule.next).catch(() => undefined);
    }
    const local = new Date(now.getTime() + 7 * 3_600_000);
    const boundary = new Date(local);
    const daysToSunday = (7 - local.getUTCDay()) % 7;
    boundary.setUTCDate(local.getUTCDate() + daysToSunday);
    boundary.setUTCHours(18, 0, 0, 0);
    if (boundary <= local) boundary.setUTCDate(boundary.getUTCDate() + 7);
    timer = setTimeout(refresh, boundary.getTime() - local.getTime() + 100);
  }
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);
  refresh();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('online', refresh);
  };
}
