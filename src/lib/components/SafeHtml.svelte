<script lang="ts">
	import { onMount, tick, mount, unmount } from 'svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { buildChartProps } from '$lib/components/tiptap/extensions';
	import '$lib/components/tiptap/tiptap-blocks.css';
	import Icon from '@iconify/svelte';

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
	const safeHtml = $derived(typeof html === 'string' ? html : '');

	type PreviewImage = { src: string; alt: string };
	let previewImages = $state<PreviewImage[]>([]);
	let previewIndex = $state<number>(-1);
	const activePreview = $derived(
		previewIndex >= 0 && previewIndex < previewImages.length ? previewImages[previewIndex] : null
	);

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

	function closePreview() {
		previewIndex = -1;
	}

	function prevPreview() {
		if (previewImages.length <= 1) return;
		previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length;
	}

	function nextPreview() {
		if (previewImages.length <= 1) return;
		previewIndex = (previewIndex + 1) % previewImages.length;
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

	function handleKeydown(e: KeyboardEvent) {
		if (!activePreview) return;
		if (e.key === 'Escape') closePreview();
		else if (e.key === 'ArrowLeft') prevPreview();
		else if (e.key === 'ArrowRight') nextPreview();
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

<svelte:window onkeydown={handleKeydown} />

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

{#if activePreview}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-3 backdrop-blur-xs sm:p-6"
		onclick={(e) => {
			if (e.target === e.currentTarget) closePreview();
		}}
		role="dialog"
		aria-modal="true"
		aria-label="본문 이미지 상세 보기"
		tabindex="-1"
	>
		<!-- 상단 바 -->
		<div class="mb-3 flex w-full max-w-5xl items-center justify-between gap-3 text-white">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate text-sm font-bold">{activePreview.alt}</span>
				{#if previewImages.length > 1}
					<span class="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
						{previewIndex + 1} / {previewImages.length}
					</span>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<a
					href={activePreview.src}
					download
					target="_blank"
					rel="noopener noreferrer"
					class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
					title="원본 열기 / 다운로드"
					aria-label="이미지 다운로드"
				>
					<Icon icon="ph:download-simple-bold" class="h-4 w-4" />
				</a>
				<button
					type="button"
					onclick={closePreview}
					class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
					title="닫기 (ESC)"
					aria-label="미리보기 닫기"
				>
					<Icon icon="ph:x-bold" class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- 이미지 본문 -->
		<div class="relative flex w-full max-w-5xl flex-1 items-center justify-center overflow-hidden">
			{#if previewImages.length > 1}
				<button
					type="button"
					onclick={prevPreview}
					class="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
					aria-label="이전 이미지"
				>
					<Icon icon="ph:caret-left-bold" class="h-5 w-5" />
				</button>
			{/if}

			<img
				src={activePreview.src}
				alt={activePreview.alt}
				class="max-h-[82dvh] max-w-full rounded-xl object-contain shadow-2xl"
			/>

			{#if previewImages.length > 1}
				<button
					type="button"
					onclick={nextPreview}
					class="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
					aria-label="다음 이미지"
				>
					<Icon icon="ph:caret-right-bold" class="h-5 w-5" />
				</button>
			{/if}
		</div>
	</div>
{/if}
