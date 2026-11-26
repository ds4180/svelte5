<script lang="ts">
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { portal } from '$lib/actions/portal';

	type LightboxImage = {
		src: string;
		alt?: string;
		downloadUrl?: string;
		downloadName?: string;
	};

	let {
		images = [],
		index = $bindable(-1),
		ariaLabel = '이미지 상세 보기'
	}: {
		images?: LightboxImage[];
		index?: number;
		ariaLabel?: string;
	} = $props();

	const active = $derived(index >= 0 && index < images.length ? images[index] : null);

	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 5;
	let zoomScale = $state(1);
	let panPosition = $state({ x: 0, y: 0 });
	let isDragging = $state(false);
	let dragStart = { x: 0, y: 0 };
	let initialPinchDistance = 0;
	let initialPinchScale = 1;
	let isSwiping = $state(false);
	let swipeStart = { x: 0, y: 0 };
	let swipeOffset = $state(0);
	let swipeDirection = $state(0); // 1: 다음(오른쪽에서 진입), -1: 이전(왼쪽에서 진입), 0: 즉시

	function clampZoom(v: number) {
		return Math.min(Math.max(Number(v.toFixed(2)), MIN_ZOOM), MAX_ZOOM);
	}

	function resetZoom() {
		zoomScale = 1;
		panPosition = { x: 0, y: 0 };
		isDragging = false;
		isSwiping = false;
		swipeOffset = 0;
	}

	function zoomIn() {
		zoomScale = clampZoom(zoomScale + 0.5);
	}

	function zoomOut() {
		zoomScale = clampZoom(zoomScale - 0.5);
		if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
	}

	function toggleZoom() {
		if (zoomScale === 1) {
			zoomScale = 2.5;
		} else {
			resetZoom();
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		zoomScale = clampZoom(zoomScale + (e.deltaY > 0 ? -0.25 : 0.25));
		if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
	}

	function nonPassiveWheel(node: HTMLElement) {
		const handler = (e: WheelEvent) => handleWheel(e);
		node.addEventListener('wheel', handler, { passive: false });
		return {
			destroy: () => node.removeEventListener('wheel', handler)
		};
	}

	function getTouchDistance(e: TouchEvent) {
		if (e.touches.length >= 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			return Math.hypot(dx, dy);
		}
		return 0;
	}

	function startPan(e: MouseEvent | TouchEvent) {
		if ('touches' in e) {
			if (e.touches.length === 2) {
				initialPinchDistance = getTouchDistance(e);
				initialPinchScale = zoomScale;
				isDragging = false;
				isSwiping = false;
				swipeOffset = 0;
				return;
			}
			if (e.touches.length === 0) return;
			if (zoomScale <= 1) {
				if (images.length > 1) {
					isSwiping = true;
					swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
					swipeOffset = 0;
				}
				return;
			}
			isDragging = true;
			dragStart = {
				x: e.touches[0].clientX - panPosition.x,
				y: e.touches[0].clientY - panPosition.y
			};
			return;
		}
		if (e.button !== 0 || zoomScale <= 1) return;
		isDragging = true;
		dragStart = {
			x: e.clientX - panPosition.x,
			y: e.clientY - panPosition.y
		};
	}

	function onPan(e: MouseEvent | TouchEvent) {
		if ('touches' in e) {
			if (e.touches.length === 2) {
				const currentDist = getTouchDistance(e);
				if (initialPinchDistance > 0 && currentDist > 0) {
					const ratio = currentDist / initialPinchDistance;
					zoomScale = clampZoom(initialPinchScale * ratio);
					if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
				}
				return;
			}
			if (e.touches.length === 0) return;
			if (isSwiping && zoomScale <= 1) {
				const dx = e.touches[0].clientX - swipeStart.x;
				const dy = e.touches[0].clientY - swipeStart.y;
				if (Math.abs(dx) > Math.abs(dy)) {
					swipeOffset = dx * 0.45;
				}
				return;
			}
			if (!isDragging || zoomScale <= 1) return;
			panPosition = {
				x: e.touches[0].clientX - dragStart.x,
				y: e.touches[0].clientY - dragStart.y
			};
			return;
		}
		if (!isDragging || zoomScale <= 1) return;
		panPosition = {
			x: e.clientX - dragStart.x,
			y: e.clientY - dragStart.y
		};
	}

	function endPan(e?: MouseEvent | TouchEvent) {
		if (e && 'changedTouches' in e && isSwiping && zoomScale <= 1 && e.changedTouches.length > 0) {
			const dx = e.changedTouches[0].clientX - swipeStart.x;
			const dy = e.changedTouches[0].clientY - swipeStart.y;
			isSwiping = false;
			if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
				swipeDirection = dx < 0 ? 1 : -1;
				swipeOffset = 0;
				if (dx < 0) next();
				else prev();
			} else {
				swipeOffset = 0;
			}
		} else {
			isSwiping = false;
			swipeOffset = 0;
		}
		isDragging = false;
		initialPinchDistance = 0;
		if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
	}

	function close() {
		resetZoom();
		index = -1;
	}

	function prev() {
		if (images.length <= 1) return;
		swipeDirection = -1;
		resetZoom();
		index = (index - 1 + images.length) % images.length;
	}

	function next() {
		if (images.length <= 1) return;
		swipeDirection = 1;
		resetZoom();
		index = (index + 1) % images.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!active) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			next();
		} else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
			if (e.key === '+' || e.key === '=') zoomIn();
			else if (e.key === '-' || e.key === '_') zoomOut();
			else if (e.key === '0') resetZoom();
		}
	}

	$effect(() => {
		void index;
		untrack(() => resetZoom());
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if active}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portal
		class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-3 backdrop-blur-xs sm:p-6"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
		role="dialog"
		aria-modal="true"
		aria-label={ariaLabel}
		tabindex="-1"
	>
		<!-- 상단 바 -->
		<div class="mb-3 flex w-full max-w-5xl items-center justify-between gap-3 text-white">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate text-sm font-bold">{active.alt || '이미지'}</span>
				{#if images.length > 1}
					<span class="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
						{index + 1} / {images.length}
					</span>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<div
					class="flex items-center gap-0.5 rounded-full bg-white/15 p-0.5 backdrop-blur-xs"
					role="group"
					aria-label="이미지 확대/축소 컨트롤"
				>
					<button
						type="button"
						onclick={zoomOut}
						disabled={zoomScale <= MIN_ZOOM}
						class="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
						title="축소 (-)"
						aria-label="이미지 축소"
					>
						<Icon icon="ph:minus-bold" class="h-4 w-4" />
					</button>
					<button
						type="button"
						onclick={resetZoom}
						class="min-w-[3.25rem] rounded-full px-2 py-1 text-center font-mono text-xs font-bold text-white transition hover:bg-white/20"
						title="100% 리셋 (0)"
						aria-label="확대 배율 초기화"
					>
						{Math.round(zoomScale * 100)}%
					</button>
					<button
						type="button"
						onclick={zoomIn}
						disabled={zoomScale >= MAX_ZOOM}
						class="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
						title="확대 (+)"
						aria-label="이미지 확대"
					>
						<Icon icon="ph:plus-bold" class="h-4 w-4" />
					</button>
				</div>
				<a
					href={active.downloadUrl || active.src}
					download={active.downloadName || true}
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
					onclick={close}
					class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
					title="닫기 (ESC)"
					aria-label="미리보기 닫기"
				>
					<Icon icon="ph:x-bold" class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- 이미지 본문 -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			use:nonPassiveWheel
			onmousedown={startPan}
			onmousemove={onPan}
			onmouseup={endPan}
			onmouseleave={endPan}
			ontouchstart={startPan}
			ontouchmove={onPan}
			ontouchend={endPan}
			ondblclick={toggleZoom}
			class="relative flex w-full max-w-5xl flex-1 touch-none items-center justify-center overflow-hidden select-none"
			style="cursor: {zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'};"
		>
			{#if images.length > 1}
				<button
					type="button"
					onclick={prev}
					onmousedown={(e) => e.stopPropagation()}
					ontouchstart={(e) => e.stopPropagation()}
					ondblclick={(e) => e.stopPropagation()}
					class="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
					aria-label="이전 이미지"
				>
					<Icon icon="ph:caret-left-bold" class="h-5 w-5" />
				</button>
			{/if}

			{#key active.src}
				<img
					in:fly={{ x: swipeDirection * 70, duration: swipeDirection ? 180 : 0 }}
					src={active.src}
					alt={active.alt || '이미지'}
					draggable="false"
					class="pointer-events-none max-h-[82dvh] max-w-full rounded-xl object-contain shadow-2xl transition-transform select-none"
					style="transform: translate({panPosition.x + swipeOffset}px, {panPosition.y}px) scale({zoomScale}); transform-origin: center center; transition-duration: {isDragging || isSwiping
						? '0ms'
						: '140ms'};"
				/>
			{/key}

			{#if images.length > 1}
				<button
					type="button"
					onclick={next}
					onmousedown={(e) => e.stopPropagation()}
					ontouchstart={(e) => e.stopPropagation()}
					ondblclick={(e) => e.stopPropagation()}
					class="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
					aria-label="다음 이미지"
				>
					<Icon icon="ph:caret-right-bold" class="h-5 w-5" />
				</button>
			{/if}
		</div>

		<p
			class="pointer-events-none mt-2 text-center text-xs text-white/50 transition-opacity select-none"
			class:opacity-0={zoomScale !== 1}
			aria-hidden={zoomScale !== 1}
		>
			{images.length > 1 ? '좌우 스와이프 전환 · ' : ''}휠/핀치로 확대 · 더블클릭 2.5x · 드래그로 이동
		</p>
	</div>
{/if}
