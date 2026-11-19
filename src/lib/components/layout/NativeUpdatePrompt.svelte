<script lang="ts">
  import { onMount } from 'svelte';
  import { appDialogState } from '$lib/browser/app-dialog';
  import { openNativeAppStore } from '$lib/browser/external-links';
  import { modalDialog } from '$lib/browser/modal-dialog';
  import { watchNativeAppUpdates } from '$lib/browser/native-app-update';
  import { STORE_URLS, type StoreRelease } from '$lib/contracts/native-app-update';
  import { nativeAppUpdateText } from '$lib/i18n/native-app-update';
  import { getLocaleContext } from '$lib/stores/locale.svelte';

  let { home }: { home: boolean } = $props();
  const locale = getLocaleContext();
  const text = $derived(nativeAppUpdateText[locale.current]);
  let release = $state.raw<StoreRelease | null>(null);
  let openingStore = $state(false);
  let storeFailed = $state(false);
  let presented = false;

  function setRelease(value: StoreRelease | null) {
    release = value;
    openingStore = false;
    storeFailed = false;
    presented = false;
  }

  onMount(() => watchNativeAppUpdates(setRelease));

  $effect(() => {
    if (!release) return;
    if (home && !$appDialogState) presented = true;
    else if (presented) setRelease(null);
  });

  async function update(current: StoreRelease) {
    if (openingStore) return;
    openingStore = true;
    storeFailed = false;
    try {
      await openNativeAppStore(current.storeUrl);
      if (release === current) setRelease(null);
    } catch {
      if (release === current) {
        openingStore = false;
        storeFailed = true;
      }
    }
  }
</script>

{#if home && release && !$appDialogState}
  {@const available = release}
  <dialog
    use:modalDialog
    data-native-update-prompt
    aria-labelledby="native-update-title"
    aria-describedby="native-update-message"
    oncancel={(event) => { event.preventDefault(); setRelease(null); }}
    onkeydown={(event) => event.stopPropagation()}
  >
    <h2 id="native-update-title">{text.title(available.version)}</h2>
    <p id="native-update-message">{text.message}</p>
    {#if storeFailed}
      <p role="alert">{text.storeFailed(available.storeUrl === STORE_URLS.ios ? 'App Store' : 'Google Play')}</p>
    {/if}
    <div class="actions">
      <button type="button" data-modal-focus onclick={() => setRelease(null)}>{text.later}</button>
      <button type="button" class="primary" disabled={openingStore} onclick={() => update(available)}>{text.update}</button>
    </div>
  </dialog>
{/if}

<style>
  dialog {
    box-sizing: border-box;
    width: min(calc(var(--dialog-compact-width) * .78), calc(100% - var(--space-page) * 2));
    max-height: calc(100dvh - var(--space-page) * 2 - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    inset-block-start: env(safe-area-inset-top);
    inset-block-end: env(safe-area-inset-bottom);
    margin: auto;
    padding: var(--dialog-action-space);
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--dialog-corner);
    background: var(--card);
    color: var(--text);
    box-shadow: var(--shadow-xl);
    font: inherit;
  }
  dialog::backdrop { background: var(--practice-dialog-backdrop); }
  h2 { margin: 0; font-size: var(--font-size-card-title); line-height: 1.25; overflow-wrap: anywhere; }
  p { margin: var(--dialog-action-gap) 0; color: var(--text2); line-height: 1.4; overflow-wrap: anywhere; }
  p[role="alert"] { color: var(--danger-text); }
  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--dialog-action-gap);
  }
  button {
    min-width: var(--touch-target-size);
    min-height: var(--touch-target-size);
    padding: var(--dialog-action-gap) var(--dialog-action-space);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--bg2);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  button:focus-visible { outline-offset: calc(var(--dialog-action-gap) / -2); }
  .primary { background: var(--gold); color: var(--on-gold); font-weight: 650; }
  .primary:focus-visible { outline-color: var(--on-gold); }
  @media (max-width: 360px) {
    h2 { font-size: var(--font-size-body); }
  }
</style>
