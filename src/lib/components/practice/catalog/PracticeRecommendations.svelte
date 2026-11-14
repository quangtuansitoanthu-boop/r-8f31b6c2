<script lang="ts">
  import AppArtwork from '$lib/components/icons/AppArtwork.svelte';
  import { modalDialog } from '$lib/browser/modal-dialog';
  import { getLocaleContext } from '$lib/stores/locale.svelte';
  import { personalPracticeCopy } from '$lib/i18n/personal-practice-copy';
  import type { Snippet } from 'svelte';

  let { isCollapsed = $bindable(true), onCollapsedChange, routines }: {
    isCollapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void; routines: Snippet;
  } = $props();
  const locale = getLocaleContext();
  const copy = $derived(personalPracticeCopy[locale.current === 'en' ? 'en' : 'vi']);

  function setCollapsed(collapsed: boolean) {
    if (isCollapsed === collapsed) return;
    isCollapsed = collapsed;
    onCollapsedChange?.(collapsed);
  }
</script>

<button type="button" class="tt-mode-card tt-mode-card--rec" onclick={() => setCollapsed(false)}>
  <div class="tt-mode-icon-wrap" aria-hidden="true"><AppArtwork name="practice" size={48} /></div>
  <div class="tt-mode-body"><span class="tt-mode-title">{copy.myRoutines}</span></div>
  <span class="tt-mode-arrow" aria-hidden="true">→</span>
</button>

{#if !isCollapsed}
  <dialog use:modalDialog class="tt-modal-container" aria-labelledby="practice-routines-title"
    oncancel={event => { event.preventDefault(); setCollapsed(true); }}>
    <section class="practice-recommendations">
      <header>
        <h2 id="practice-routines-title">{copy.myRoutines}</h2>
        <button type="button" class="tt-rec-toggle-btn" onclick={() => setCollapsed(true)} aria-label={locale.t.practice.backToPractice}>←</button>
      </header>
      <div class="practice-recommendations__scroll">{@render routines()}</div>
    </section>
  </dialog>
{/if}

<style>
  .tt-modal-container::backdrop{background:var(--practice-dialog-backdrop)}
  .tt-modal-container{padding:0;border:0;background:transparent;margin:auto;width:calc(100% - var(--space-page) * 2);max-width:var(--practice-dialog-width);height:var(--practice-dialog-height);max-height:calc(100dvh - max(var(--space-page), var(--app-safe-top, 0px)) - max(var(--space-page), env(safe-area-inset-bottom, 0px)));min-height:0;display:flex;flex-direction:column}
  .practice-recommendations{height:100%;display:flex;flex-direction:column;min-height:0;max-height:calc(100dvh - max(16px,var(--app-safe-top,0px)) - max(16px,env(safe-area-inset-bottom,0px)));overflow:hidden;border:1px solid var(--border2);border-radius:22px;background:var(--bg);color:var(--text);font-family:var(--font-app);box-shadow:var(--shadow-xl)}
  header{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:12px;padding:22px 20px 18px;border-bottom:1px solid var(--border2)}
  h2{margin:0;color:var(--text);font-size:var(--font-size-section-title);line-height:1.4;font-weight:700;letter-spacing:-.4px}
  .tt-rec-toggle-btn{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:1px solid var(--border2);border-radius:50%;background:var(--card);color:var(--text2);cursor:pointer}
  .tt-rec-toggle-btn:hover{background:var(--bg2)}
  .practice-recommendations__scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:18px 20px 20px}
  button:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  @media(max-width:380px){header{padding:18px 16px 16px}.practice-recommendations__scroll{padding:16px}h2{font-size:var(--font-size-section-title)}}

  .practice-recommendations{max-height:calc(100dvh - max(16px,var(--app-safe-top,0px)) - max(16px,env(safe-area-inset-bottom,0px)))}
  button{min-height:44px}


  .tt-rec-toggle-btn{min-width:44px;min-height:44px}
  @media(prefers-reduced-motion:no-preference){
    .tt-modal-container{animation:recommendations-enter var(--motion-enter) var(--ease-standard) both}
    @keyframes recommendations-enter{from{opacity:0;transform:translateY(var(--radius-control))}to{opacity:1;transform:translateY(0)}}
  }
  .practice-recommendations{background:var(--dialog-glass-background);border-color:var(--dialog-glass-border);-webkit-backdrop-filter:var(--dialog-glass-filter);backdrop-filter:var(--dialog-glass-filter);box-shadow:var(--dialog-glass-shadow)}
  @supports not (backdrop-filter:blur(1px)){.practice-recommendations{background:var(--card)}}
  @supports not (background:color-mix(in srgb,currentColor,transparent)){.practice-recommendations{background:var(--card);border-color:var(--border)}}
  @media(prefers-reduced-transparency:reduce){.practice-recommendations{background:var(--card);-webkit-backdrop-filter:none;backdrop-filter:none}}
</style>
