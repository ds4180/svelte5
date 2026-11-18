<script lang="ts">
	import { onMount, tick, mount, unmount } from 'svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { buildChartProps } from '$lib/components/tiptap/extensions';
	import '$lib/components/tiptap/tiptap-blocks.css';

	/**
	 * Renders raw HTML only after client mount so malformed CMS/board HTML cannot
	 * trigger browser HTML-parser DOM repair and corrupt Svelte 5 hydration markers.
	 * Also hydrates custom Tiptap nodes (e.g. [data-tiptap-chart]) into live Svelte components.
	 */
	let {
		html = '',
		class: className = ''
	}: {
		html?: string | null;
		class?: string;
	} = $props();

	let mounted = $state(false);
	let container: HTMLDivElement | undefined = $state();
	const safeHtml = $derived(typeof html === 'string' ? html : '');

	onMount(() => {
		mounted = true;
	});

	$effect(() => {
		if (!mounted || !container) return;
		const currentHtml = safeHtml;
		void currentHtml;

		const mountedCharts: any[] = [];
		let cancelled = false;

		tick().then(() => {
			if (cancelled || !container) return;
			const chartNodes = container.querySelectorAll<HTMLElement>('[data-tiptap-chart]');
			chartNodes.forEach((el) => {
				el.innerHTML = '';
				const canvasBox = document.createElement('div');
				canvasBox.className = 'tiptap-chart-canvas';
				el.appendChild(canvasBox);

				const instance = mount(Chart, {
					target: canvasBox,
					props: buildChartProps({
						chartType: el.getAttribute('data-chart-type') || 'bar',
						title: el.getAttribute('data-title') || '',
						labels: el.getAttribute('data-labels') || '',
						values: el.getAttribute('data-values') || '',
						datasets: el.getAttribute('data-datasets') || '',
						horizontal: el.getAttribute('data-horizontal') === 'true',
						stacked: el.getAttribute('data-stacked') === 'true',
						showLegend: el.getAttribute('data-show-legend') !== 'false'
					})
				});
				mountedCharts.push(instance);
			});
		});

		return () => {
			cancelled = true;
			mountedCharts.forEach((inst) => unmount(inst));
		};
	});
</script>

<div bind:this={container} class={className} aria-busy={!mounted ? 'true' : undefined}>
	{#if mounted}
		{@html safeHtml}
	{/if}
</div>
