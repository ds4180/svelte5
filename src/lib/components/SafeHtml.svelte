<script lang="ts">
	import { onMount, tick, mount, unmount } from 'svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { buildChartProps } from '$lib/components/tiptap/extensions';
	import '$lib/components/tiptap/tiptap-blocks.css';
	import ImageZoomLightbox from '$lib/components/ImageZoomLightbox.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitizeHtml';

	/**
	 * Renders raw HTML only after client mount so malformed CMS/board HTML cannot
	 * trigger browser HTML-parser DOM repair and corrupt Svelte 5 hydration markers.
	 * Also hydrates custom Tiptap nodes (e.g. [data-tiptap-chart]) and supports
	 * responsive lightbox preview when clicking inline images.
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
	const safeHtml = $derived(mounted ? sanitizeHtml(html) : '');

	type PreviewImage = { src: string; alt: string };
	let previewImages = $state<PreviewImage[]>([]);
	let previewIndex = $state<number>(-1);

	function openImageAt(targetImg: HTMLImageElement) {
		if (!container) return;
		const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'))
			.map((el) => ({
				src: el.currentSrc || el.getAttribute('src') || '',
				alt: el.getAttribute('alt') || '첨부 이미지'
			}))
			.filter((item) => Boolean(item.src));
		if (imgs.length === 0) return;

		const clickedSrc = targetImg.currentSrc || targetImg.getAttribute('src') || '';
		const idx = imgs.findIndex((item) => item.src === clickedSrc);
		previewImages = imgs;
		previewIndex = idx >= 0 ? idx : 0;
	}

	function handleContainerClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (!target) return;
		if (target.tagName === 'IMG') {
			// 링크로 감싸진 이미지가 아니라면 상세 보기 라이트박스 실행
			if (!target.closest('a')) {
				e.preventDefault();
				openImageAt(target as HTMLImageElement);
			}
		}
	}

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

			// 본문 내 클릭 가능한 이미지에 확대 커서 및 접근성 힌트 부여
			container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
				if (!img.closest('a')) {
					img.style.cursor = 'zoom-in';
					if (!img.title) img.title = '클릭하여 크게 보기';
				}
			});

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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={container}
	onclick={handleContainerClick}
	class={className}
	aria-busy={!mounted ? 'true' : undefined}
>
	{#if mounted}
		{@html safeHtml}
	{/if}
</div>

<ImageZoomLightbox
	images={previewImages}
	bind:index={previewIndex}
	ariaLabel="본문 이미지 상세 보기"
/>
