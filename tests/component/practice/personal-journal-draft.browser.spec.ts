import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { alertInApp } from '$lib/browser/app-dialog';
vi.mock('$lib/browser/app-dialog', () => ({ alertInApp: vi.fn().mockResolvedValue(undefined) }));
import { flushSync, mount, unmount } from 'svelte';
import PersonalJournal from '$lib/components/practice/personal/PersonalJournal.svelte';
import { createPersonalPracticeStorage } from '$lib/browser/personal-practice-storage';
import { getVietnamIsoDate } from '$lib/domain/practice/stats';
import { dismissTopModal, modalDialog } from '$lib/browser/modal-dialog';
import { principalStorageKey } from '$lib/browser/principal-storage';

const localeMock = vi.hoisted(() => ({ store: null as null | { readonly current: 'vi' | 'en'; setLocale(locale: 'vi' | 'en'): void } }));
vi.mock('$lib/stores/locale.svelte', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/stores/locale.svelte')>();
  return { ...original, getLocaleContext: () => localeMock.store ??= original.createLocaleStore('vi') };
});
let component: ReturnType<typeof PersonalJournal> | undefined;
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); flushSync(); };
function storage() {
  const values = new Map<string, string>();
  return createPersonalPracticeStorage({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }, 'journal-owner');
}
function fill(node: HTMLTextAreaElement | HTMLInputElement, value: string) {
  node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); flushSync();
}
beforeEach(() => { vi.clearAllMocks(); localeMock.store = null; localStorage.setItem('tt_reflection_guide_seen_v1', '1'); });
afterEach(async () => { if (component) await unmount(component); component = undefined; document.body.replaceChildren(); localStorage.clear(); });

async function readyJournal(owner: ReturnType<typeof storage>, onShare?: (kind: 'repentance' | 'good_deed', content: string, nickname: string) => Promise<void>) {
  component = mount(PersonalJournal, { target: document.body, props: { storage: owner, onShare } }); await settle();
  document.querySelector<HTMLButtonElement>('.guide-toggle-button')!.click(); await settle();
}

it.each([0, 1])('warns at49words and confirms a50word manual save in section %i', async index => {
  const owner = storage();
  const write = vi.spyOn(owner, 'saveReflection');
  await readyJournal(owner);
  expect(document.body.textContent).toContain('Chia sẻ cộng đồng chưa sẵn sàng');
  const editor = document.querySelectorAll('textarea')[index];
  const saveButton = document.querySelectorAll<HTMLButtonElement>('.actions button:first-child')[index];
  fill(editor, 'từ '.repeat(49)); saveButton.click(); await settle();
  expect(alertInApp).toHaveBeenLastCalledWith(expect.stringContaining('còn thiếu 1 từ'));
  expect(write).not.toHaveBeenCalled();
  expect(editor.value).toBe('từ '.repeat(49));
  fill(editor, 'từ '.repeat(50)); saveButton.click(); await settle();
  expect(write).toHaveBeenCalledTimes(1);
  expect(alertInApp).toHaveBeenLastCalledWith(expect.stringContaining('Đã lưu riêng trên thiết bị.'));
  expect(vi.mocked(alertInApp).mock.lastCall?.[0]).toContain('bạn có thể mất dữ liệu này');
  expect(owner.getReflections()[0][index ? 'goodDeeds' : 'repentance']).toBe('từ '.repeat(50));
});

it('reports a failed manual save in a dialog without claiming success or discarding writing', async () => {
  const owner = storage();
  vi.spyOn(owner, 'saveReflection').mockImplementation(() => { throw new Error('quota'); });
  await readyJournal(owner);
  const editor = document.querySelector('textarea')!;
  fill(editor, 'từ '.repeat(50)); document.querySelector<HTMLButtonElement>('.actions button')!.click(); await settle();
  expect(alertInApp).toHaveBeenLastCalledWith('Chưa lưu được trên thiết bị. Vui lòng thử lại.');
  expect(editor.value).toBe('từ '.repeat(50));
});

it('persists clearing both fields before a same-owner remount', async () => {
  const owner = storage();
  owner.saveReflection({ date: getVietnamIsoDate(), repentance: 'Old reflection', goodDeeds: 'Old good deed', updatedAt: new Date().toISOString() });
  await readyJournal(owner);
  const fields = [...document.querySelectorAll('textarea')];
  fill(fields[0], ''); fill(fields[1], '');
  expect(component.preserveDraft()).toBe(true);
  expect(owner.getReflections()[0]).toMatchObject({ repentance: '', goodDeeds: '' });
});

it('moves focus to writing without suppressing the guide on future visits', async () => {
  localStorage.removeItem('tt_reflection_guide_seen_v1');
  component = mount(PersonalJournal, { target: document.body, props: { storage: storage() } }); await settle();
  const start = document.querySelector<HTMLButtonElement>('.start-button')!;
  start.focus(); start.click(); await settle();
  expect(document.querySelector('[data-testid=reflection-guide]')).toBeNull();
  expect(localStorage.getItem('tt_reflection_guide_seen_v1')).toBeNull();
  expect(document.activeElement).toBe(document.querySelector('textarea'));
});

it('persists clearing both fields before selecting another date', async () => {
  const owner = storage(); const today = getVietnamIsoDate();
  owner.saveReflection({ date: today, repentance: 'Old reflection', goodDeeds: '', updatedAt: new Date().toISOString() });
  await readyJournal(owner);
  fill(document.querySelector('textarea')!, '');
  const date = document.querySelector<HTMLInputElement>('input[type=date]')!;
  date.value = '2026-01-01'; date.dispatchEvent(new Event('change', { bubbles: true })); await settle();
  expect(owner.getReflections().find(item => item.date === today)?.repentance).toBe('');
});

it('keeps a saved reflection when the separate nickname settings cannot be read', async () => {
  const values = new Map<string, string>();
  const owner = createPersonalPracticeStorage({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }, 'journal-owner');
  const saved = { date: getVietnamIsoDate(), repentance: 'Previously saved private reflection', goodDeeds: 'Previously saved good deed', updatedAt: new Date().toISOString() };
  owner.saveReflection(saved);
  const settingsKey = principalStorageKey('journal-owner', 'tt_personal_settings_v1');
  values.set(settingsKey, '{broken-json');
  await readyJournal(owner);
  expect(document.querySelector('[role=status]')?.textContent).toContain('Chưa đọc được');
  document.querySelector<HTMLButtonElement>('.actions button')!.click(); await settle();
  expect(owner.getReflections()[0]).toMatchObject({ repentance: saved.repentance, goodDeeds: saved.goodDeeds });
  expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(saved.repentance);
  expect(values.get(settingsKey)).toBe('{broken-json');
});

it('does not reload a private draft on locale change while nickname reading fails', async () => {
  const owner = storage();
  owner.saveReflection({ date: getVietnamIsoDate(), repentance: 'Saved reflection', goodDeeds: '', updatedAt: new Date().toISOString() });
  vi.spyOn(owner, 'getNickname').mockImplementation(() => { throw new Error('personal_practice_storage_invalid'); });
  await readyJournal(owner);
  fill(document.querySelector<HTMLTextAreaElement>('textarea')!, 'Unsaved latest draft');
  localeMock.store!.setLocale('en'); await settle();
  expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Unsaved latest draft');
  expect(document.querySelector('.actions button')?.textContent).toBe('Save privately');
});

it.each([
  { content: 'word '.repeat(601), nickname: 'Diệu Âm' },
  { content: 'Valid reflection '.repeat(25), nickname: 'person@example.test' },
  { content: `Valid\u0000reflection ${'word '.repeat(50)}`, nickname: 'Diệu Âm' },
])('rejects invalid public input locally without submitting: $nickname', async ({ content, nickname }) => {
  const owner = storage(); owner.saveNickname(nickname); const share = vi.fn();
  await readyJournal(owner, share);
  fill(document.querySelector('textarea')!, content);
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Gửi cộng đồng sám hối')!.click(); await settle();
  expect(document.querySelector('.practice-confirm')).toBeNull();
  expect(document.querySelector('[role=status]')?.textContent).toMatch(/3\.000|Biệt danh/u);
  expect(share).not.toHaveBeenCalled();
});

it('closes full-screen writing through hardware Back without losing the draft', async () => {
  const owner = storage();
  await readyJournal(owner);
  const trigger = document.querySelector<HTMLButtonElement>('.zen-open-btn')!;
  expect(document.activeElement).not.toBe(trigger);
  trigger.click(); await settle();
  const editor = document.querySelector<HTMLTextAreaElement>('.zen-textarea')!;
  fill(editor, 'Unsaved private draft');
  expect(dismissTopModal()).toBe(true); await settle();
  expect(document.querySelector('.zen-overlay')).toBeNull();
  expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Unsaved private draft');
  expect(document.activeElement).toBe(trigger);
  expect(owner.getReflections()).toEqual([]);
});

it('focuses full-screen writing and closes Escape without clearing the draft', async () => {
  await readyJournal(storage());
  document.querySelector<HTMLButtonElement>('.zen-open-btn')!.click(); await settle();
  const editor = document.querySelector<HTMLTextAreaElement>('.zen-textarea')!;
  expect(document.activeElement).toBe(editor);
  fill(editor, 'Escape keeps this draft');
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
  expect(document.querySelector('.zen-overlay')).toBeNull();
  expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Escape keeps this draft');
});

it('does not resurrect a removed fallback dialog during action teardown', async () => {
  const dialog = document.createElement('dialog');
  Object.defineProperty(dialog, 'showModal', { value: undefined });
  Object.defineProperty(dialog, 'close', { value: undefined });
  document.body.append(dialog);
  const action = modalDialog(dialog); await settle();
  dialog.remove(); action.destroy();
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.body.childNodes).toHaveLength(0);
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('announces a failed local save inside full-screen writing and retains the draft', async () => {
  const owner = storage(); vi.spyOn(owner, 'saveReflection').mockImplementation(() => { throw new Error('quota'); });
  await readyJournal(owner);
  document.querySelector<HTMLButtonElement>('.zen-open-btn')!.click(); await settle();
  fill(document.querySelector<HTMLTextAreaElement>('.zen-textarea')!, 'Keep this writing '.repeat(20));
  document.querySelector<HTMLButtonElement>('.zen-save-btn')!.click(); await settle();
  expect(document.querySelector('.zen-overlay [role=status]')?.textContent).toContain('Chưa lưu được');
  expect(document.querySelector<HTMLTextAreaElement>('.zen-textarea')?.value).toBe('Keep this writing '.repeat(20));
});

it('does not let a quick section invalidate a maximum-length private draft', async () => {
  const owner = storage();
  await readyJournal(owner);
  document.querySelector<HTMLButtonElement>('.zen-open-btn')!.click(); await settle();
  const editor = document.querySelector<HTMLTextAreaElement>('.zen-textarea')!;
  const content = 'x '.repeat(10_000); fill(editor, content);
  document.querySelector<HTMLButtonElement>('.snippet-pill')!.click(); await settle();
  expect(editor.value).toBe(content);
  document.querySelector<HTMLButtonElement>('.zen-save-btn')!.click(); await settle();
  expect(owner.getReflections()[0]?.repentance).toBe(content);
});

it('keeps longer private writing available despite the public limit', async () => {
  const owner = storage();
  await readyJournal(owner);
  const privateText = 'x '.repeat(2500);
  fill(document.querySelector('textarea')!, privateText);
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Lưu riêng tư')!.click(); await settle();
  expect(owner.getReflections()[0].repentance).toBe(privateText);
});

it('opens the guide on every visit despite the legacy seen flag, and allows manual collapse without losing writing', async () => {
 const owner=storage(); component=mount(PersonalJournal,{target:document.body,props:{storage:owner}});await settle();
 expect(document.querySelector('[data-testid=reflection-guide]')).not.toBeNull();
 expect(document.querySelector('.remember-label')).toBeNull();
 const toggle=document.querySelector<HTMLButtonElement>('.guide-toggle-button')!;toggle.click();await settle();
 expect(toggle.getAttribute('aria-expanded')).toBe('false');
 const text='từ '.repeat(50);fill(document.querySelector('textarea')!,text);
 toggle.click();await settle();expect(toggle.getAttribute('aria-expanded')).toBe('true');
 toggle.click();await settle();expect(document.querySelector('textarea')!.value).toBe(text);
 await unmount(component!);component=mount(PersonalJournal,{target:document.body,props:{storage:owner}});await settle();
 expect(document.querySelector('[data-testid=reflection-guide]')).not.toBeNull();
});
