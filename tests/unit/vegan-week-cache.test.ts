import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadVeganWeek, needsVeganWeekUpdate, readVeganWeek, watchVeganWeekPreload } from '../../src/lib/browser/vegan-week';
import { prepareVeganWeek } from '../../src/jobs/vegan-week';

afterEach(() => vi.unstubAllGlobals());

describe('vegan week cache cleanup', () => {
  it('upgrades a saved v5 rotation from the packaged file without contacting the media host', async () => {
    const week = '2026-11-16';
    const fresh = prepareVeganWeek(week, 5);
    const { rotationRevision, ...legacy } = fresh;
    const storage = new Map([['tutam:vegan-week:v1:' + week, JSON.stringify(legacy)]]);
    const fetch = vi.fn(async () => Response.json(fresh));
    vi.stubGlobal('location', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('fetch', fetch);

    expect(needsVeganWeekUpdate(week)).toBe(true);
    await expect(downloadVeganWeek(week)).resolves.toMatchObject({ rotationRevision });
    expect(needsVeganWeekUpdate(week)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/vegan/weeks/v5/' + week + '.json', expect.anything());
  });

  it('keeps the old week offline and replaces it after a valid regional download', async () => {
    const week = '2026-11-30';
    const entries: Record<string, string> = {
      ['tutam:vegan-week:v1:' + week]: JSON.stringify(prepareVeganWeek(week)),
    };
    Object.defineProperties(entries, {
      getItem: { value: (key: string) => entries[key] ?? null },
      setItem: { value: (key: string, value: string) => { entries[key] = value; } },
    });
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify(prepareVeganWeek(week, 5))));
    vi.stubGlobal('localStorage', entries);
    vi.stubGlobal('fetch', fetch);
    expect(needsVeganWeekUpdate(week)).toBe(true);
    await expect(downloadVeganWeek(week)).rejects.toThrow('offline');
    expect(readVeganWeek(week)?.recipes).toHaveLength(100);
    await downloadVeganWeek(week);
    expect(readVeganWeek(week)?.recipes).toHaveLength(190);
    expect(needsVeganWeekUpdate(week)).toBe(false);
    await downloadVeganWeek(week);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/v5/' + week), expect.anything());
  });
  it('keeps three usable weeks even when newer entries are damaged', () => {
    const prefix = 'tutam:vegan-week:v1:';
    const good = ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'];
    const storage: Record<string, string> = Object.fromEntries(
      good.map(week => [prefix + week, JSON.stringify(prepareVeganWeek(week))]),
    );
    storage[prefix + '2026-12-21'] = '{broken';
    storage[prefix + '2026-12-28'] = '{}';
    storage['unrelated-setting'] = 'keep';
    Object.defineProperties(storage, {
      getItem: { value: (key: string) => storage[key] ?? null },
      removeItem: { value: (key: string) => { delete storage[key]; } },
    });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', { hidden: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });

    const stop = watchVeganWeekPreload();
    stop();
    expect(Object.keys(storage).sort()).toEqual([...good.slice(1).map(week => prefix + week), 'unrelated-setting'].sort());
    expect(readVeganWeek('2026-11-30')?.recipes).toHaveLength(100);
  });
});
