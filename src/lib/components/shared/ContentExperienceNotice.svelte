<script lang="ts">
  import { contentExperienceNotice } from '$lib/i18n/content-experience-notice';
  import { getLocaleContext } from '$lib/stores/locale.svelte';

  let { contentId, class: className = '' }: { contentId: string; class?: string } = $props();
  const locale = getLocaleContext();
  const notice = $derived(contentExperienceNotice(contentId, locale.current));
</script>

{#if notice}
  <aside class={`content-experience-notice ${className}`} aria-label={notice.title}>
    <p><strong>{notice.title}:</strong> <em>{notice.message}</em></p>
    <small>{notice.timeout}</small>
  </aside>
{/if}

<style>
  .content-experience-notice{position:relative;margin:calc(var(--space-page) / 2) var(--space-page);padding:var(--notice-padding);background:var(--gold-light);border:1px solid var(--border);border-radius:var(--radius-control);box-shadow:var(--shadow);color:var(--text2);font-family:var(--font-reader);font-style:italic;flex-shrink:0}
  strong{color:var(--text);font-size:var(--font-size-label)}
  p{margin:0 0 var(--notice-gap);font-family:var(--font-reader);font-size:var(--font-size-body);line-height:1.6;text-align:justify;overflow-wrap:anywhere}
  small{font-size:var(--font-size-meta);line-height:1.5}
</style>
