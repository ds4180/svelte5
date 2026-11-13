<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Renders raw HTML only after client mount so malformed CMS/board HTML cannot
	 * trigger browser HTML-parser DOM repair and corrupt Svelte 5 hydration markers.
	 */
	let {
		html = '',
		class: className = ''
	}: {
		html?: string | null;
		class?: string;
	} = $props();

	let mounted = $state(false);
	const safeHtml = $derived(typeof html === 'string' ? html : '');

	onMount(() => {
		mounted = true;
	});
</script>

<div class={className} aria-busy={!mounted ? 'true' : undefined}>
	{#if mounted}
		{@html safeHtml}
	{/if}
</div>
