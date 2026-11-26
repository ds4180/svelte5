<script lang="ts">
	/**
	 * ============================================================================
	 * [공통 미디어 자산 상세 인스펙터 & 초고화질 줌 라이트박스 (MediaAssetDetailModal.svelte)]
	 * ============================================================================
	 * - /v1/admin/media 와 FileManager.svelte 양쪽에서 중복되던 ~350줄의 모달·핀치줌·팬 로직을
	 *   단일 재사용 컴포넌트로 통합합니다.
	 * - 데스크톱에서는 최소 크기만 보장하고 실제 사진 비율에 맞춰 모달이 자동 확장됩니다.
	 */
	import Icon from '@iconify/svelte';
	import { fade, fly } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { getSecureMediaUrl, type MediaAssetLike } from '$lib/config/media';
	import { formatBytes, formatDate } from '$lib/utils';

	interface Props {
		asset: MediaAssetLike | null;
		allFiles?: MediaAssetLike[];
		serverUrl?: string;
		onClose: () => void;
		onSelectAsset?: (nextAsset: MediaAssetLike) => void;
		onDownload: (asset: MediaAssetLike, size?: string | null) => void;
		onDelete?: (assetId: number) => void;
		onBackup?: ((assetId: number) => void) | null;
	}

	let {
		asset,
		allFiles = [],
		serverUrl = '',
		onClose,
		onSelectAsset,
		onDownload,
		onDelete,
		onBackup = null
	}: Props = $props();

	let imageAssets = $derived((allFiles || []).filter((a) => a.category === 'image'));
	let currentImageIndex = $derived(
		asset ? imageAssets.findIndex((a) => a.id === asset.id) : -1
	);

	// 전체화면 확대/축소 라이트박스 상태
	let isZoomOpen = $state(false);
	let zoomScale = $state(1);
	let panPosition = $state({ x: 0, y: 0 });
	let isDragging = $state(false);
	let dragStart = $state({ x: 0, y: 0 });
	let initialPinchDistance = 0;
	let initialPinchScale = 1;

	function resetZoomState() {
		zoomScale = 1;
		panPosition = { x: 0, y: 0 };
	}

	function openZoom() {
		resetZoomState();
		isZoomOpen = true;
	}

	function closeZoom() {
		isZoomOpen = false;
		resetZoomState();
	}

	function handleZoomIn() {
		zoomScale = Math.min(Number((zoomScale + 0.5).toFixed(1)), 4);
	}

	function handleZoomOut() {
		zoomScale = Math.max(Number((zoomScale - 0.5).toFixed(1)), 0.5);
		if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
	}

	function handleZoomToggle() {
		zoomScale = zoomScale === 1 ? 2.5 : 1;
		panPosition = { x: 0, y: 0 };
	}

	function handleWheelZoom(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.25 : 0.25;
		zoomScale = Math.min(Math.max(Number((zoomScale + delta).toFixed(2)), 0.5), 4);
		if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
	}

	function getTouchDistance(e: TouchEvent) {
		if (e.touches && e.touches.length >= 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			return Math.hypot(dx, dy);
		}
		return 0;
	}

	function startPan(e: MouseEvent | TouchEvent) {
		if ('touches' in e && e.touches.length === 2) {
			initialPinchDistance = getTouchDistance(e);
			initialPinchScale = zoomScale;
			isDragging = false;
			return;
		}
		if (zoomScale <= 1) return;
		isDragging = true;
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		dragStart = { x: clientX - panPosition.x, y: clientY - panPosition.y };
	}

	function onPan(e: MouseEvent | TouchEvent) {
		if ('touches' in e && e.touches.length === 2) {
			const currentDist = getTouchDistance(e);
			if (initialPinchDistance > 0 && currentDist > 0) {
				const ratio = currentDist / initialPinchDistance;
				zoomScale = Math.min(Math.max(Number((initialPinchScale * ratio).toFixed(2)), 0.5), 5);
			}
			return;
		}
		if (!isDragging || zoomScale <= 1) return;
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		panPosition = {
			x: clientX - dragStart.x,
			y: clientY - dragStart.y
		};
	}

	function endPan() {
		isDragging = false;
		initialPinchDistance = 0;
	}

	function goToPrev() {
		if (currentImageIndex > 0) {
			resetZoomState();
			onSelectAsset?.(imageAssets[currentImageIndex - 1]);
		}
	}

	function goToNext() {
		if (currentImageIndex >= 0 && currentImageIndex < imageAssets.length - 1) {
			resetZoomState();
			onSelectAsset?.(imageAssets[currentImageIndex + 1]);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!asset) return;
		if (isZoomOpen) {
			if (e.key === 'Escape') closeZoom();
			else if (e.key === '+' || e.key === '=') handleZoomIn();
			else if (e.key === '-' || e.key === '_') handleZoomOut();
			else if (e.key === '0') handleZoomToggle();
			else if (e.key === 'ArrowLeft') goToPrev();
			else if (e.key === 'ArrowRight') goToNext();
			return;
		}
		if (e.key === 'ArrowLeft') goToPrev();
		else if (e.key === 'ArrowRight') goToNext();
		else if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if asset}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-y-auto bg-black/90 p-2 sm:p-3 md:p-5 backdrop-blur-md"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
	>
		<div
			transition:fly={{ y: 30, duration: 200 }}
			class="relative w-full md:w-auto md:min-w-[640px] md:max-w-[92vw] my-auto overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-2xl flex flex-col md:flex-row max-h-[95dvh] md:max-h-[92dvh] shrink-0"
		>
			<!-- 닫기 버튼 (우측 상단) -->
			<button
				type="button"
				class="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-30 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-xl active:scale-95 border border-white/20"
				onclick={onClose}
				aria-label="닫기"
				title="닫기 (ESC)"
			>
				<Icon icon="ph:x-bold" class="text-lg" />
			</button>

			<!-- 🖼️ 좌측(상단) 이미지/미디어 뷰어 영역 (사진 비율에 맞춰 자동 확장, 최소 크기만 보장) -->
			<div class="relative bg-slate-950 flex items-center justify-center p-2 sm:p-3 md:p-4 min-h-[44dvh] max-h-[64dvh] md:min-w-[360px] md:min-h-[380px] md:max-h-none overflow-hidden select-none">
				{#if asset.category === 'image'}
					<button
						type="button"
						class="relative group/preview flex items-center justify-center cursor-zoom-in bg-transparent border-none p-0 focus:outline-none"
						onclick={openZoom}
						title="클릭하여 원본 전체화면 확대"
					>
						<img
							src={getSecureMediaUrl(serverUrl, asset, 'lg')}
							alt={asset.original_name || ''}
							class="block w-auto h-auto max-w-full max-h-[60dvh] md:max-w-[calc(92vw-21rem)] md:max-h-[86dvh] rounded-xl object-contain shadow-2xl transition-transform duration-300 group-hover/preview:scale-[1.01]"
							onerror={(e) => {
								const target = e.currentTarget as HTMLImageElement;
								const mdUrl = getSecureMediaUrl(serverUrl, asset, 'md');
								if (target.src !== mdUrl) {
									target.src = mdUrl;
								} else {
									target.src = '/default-thumbnail.png';
								}
							}}
						/>
						<div class="absolute bottom-2.5 right-2.5 rounded-full bg-black/70 px-2.5 py-1 text-white/90 backdrop-blur-md flex items-center gap-1 text-[11px] font-bold shadow-lg opacity-80 group-hover/preview:opacity-100 transition-opacity">
							<Icon icon="ph:magnifying-glass-plus-bold" class="text-sm text-rose-400" />
							<span class="hidden sm:inline">확대</span>
						</div>
					</button>

					{#if currentImageIndex > 0}
						<button
							type="button"
							class="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-sm shadow-lg active:scale-95"
							onclick={(e) => {
								e.stopPropagation();
								goToPrev();
							}}
							title="이전 사진 (←)"
						>
							<Icon icon="ph:caret-left-bold" class="text-xl" />
						</button>
					{/if}

					{#if currentImageIndex >= 0 && currentImageIndex < imageAssets.length - 1}
						<button
							type="button"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-sm shadow-lg active:scale-95"
							onclick={(e) => {
								e.stopPropagation();
								goToNext();
							}}
							title="다음 사진 (→)"
						>
							<Icon icon="ph:caret-right-bold" class="text-xl" />
						</button>
					{/if}

					{#if currentImageIndex >= 0 && imageAssets.length > 1}
						<div class="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[11px] font-black text-white/90 backdrop-blur-sm">
							{currentImageIndex + 1} / {imageAssets.length}
						</div>
					{/if}
				{:else}
					<div class="flex flex-col items-center text-slate-700 py-12">
						<Icon icon="ph:file-bold" class="text-7xl md:text-9xl mb-3" />
						<span class="text-xl md:text-2xl font-black uppercase font-mono">
							{(asset.file_path || '').split('.').pop()} FILE
						</span>
					</div>
				{/if}
			</div>

			<!-- 📋 우측(하단) 컴팩트 인스펙터 사이드바 -->
			<div class="w-full md:w-72 lg:w-80 shrink-0 p-3.5 sm:p-4 md:p-5 flex flex-col justify-between gap-3 bg-white overflow-y-auto border-t md:border-t-0 md:border-l border-slate-100">
				<div class="space-y-3">
					<header class="pr-8 md:pr-10">
						<span class="text-[9px] font-black tracking-[0.25em] text-rose-600 uppercase block mb-0.5">Asset Details</span>
						<h2 class="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-snug break-all line-clamp-2" title={asset.original_name}>
							{asset.original_name}
						</h2>
					</header>

					<div class="flex items-center justify-between gap-2 border-y border-slate-100 py-2.5 text-xs">
						<div class="flex items-center gap-1.5">
							<span class="h-2 w-2 rounded-full {asset.access_level === 'PUBLIC' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
							<span class="text-[11px] font-black text-slate-700 uppercase">{asset.access_level}</span>
						</div>
						<span class="text-[11px] font-black text-slate-500 font-mono">{formatBytes(asset.file_size)}</span>
					</div>

					{#if asset.category === 'image'}
						<div class="rounded-lg border px-2.5 py-2 text-[11px] {asset.meta_info?.has_original === false ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">
							{#if asset.meta_info?.has_original === false}
								<div class="flex items-center gap-1.5 font-bold">
									<Icon icon="ph:clock-countdown-bold" class="text-xs shrink-0" />
									<span>원본 미포함 · 고화질(LG) 보존 중</span>
								</div>
							{:else}
								<div class="flex items-center justify-between gap-1 font-bold">
									<span class="flex items-center gap-1">
										<Icon icon="ph:check-circle-bold" class="text-xs shrink-0" />
										원본 보관 중
									</span>
									{#if asset.meta_info?.original_expires_at}
										<span class="text-[10px] font-mono opacity-75">~{formatDate(asset.meta_info.original_expires_at)}</span>
									{:else}
										<span class="text-[10px] font-mono opacity-75">영구 보존</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<div class="space-y-1">
						<span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Path</span>
						<code class="block bg-slate-50 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 break-all border border-slate-200 font-mono leading-tight">
							{asset.file_path}
						</code>
					</div>
				</div>

				<div class="pt-2 flex flex-col gap-2">
					{#if asset.category === 'image' && asset.meta_info?.has_original === false}
						<button
							type="button"
							onclick={() => onDownload(asset, 'lg')}
							class="flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl bg-blue-600 text-white font-black uppercase tracking-wider hover:bg-blue-700 transition-all text-xs shadow-sm"
						>
							<Icon icon="ph:image-bold" class="text-base" /> 고화질(LG) 다운로드
						</button>
					{:else}
						<button
							type="button"
							onclick={() => onDownload(asset, null)}
							class="flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl bg-slate-900 text-white font-black uppercase tracking-wider hover:bg-rose-600 transition-all text-xs shadow-sm"
						>
							<Icon icon="ph:download-simple-bold" class="text-base" /> 원본 다운로드
						</button>
					{/if}

					<div class="flex gap-1.5">
						<button
							type="button"
							onclick={onClose}
							class="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all text-[11px] font-black"
						>
							<Icon icon="ph:x-circle-bold" class="text-sm text-slate-500" />
							<span>닫기</span>
						</button>
						{#if onBackup}
							<button
								type="button"
								onclick={() => onBackup(Number(asset.id))}
								class="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-slate-200 bg-white text-slate-800 hover:border-indigo-600 hover:text-indigo-600 transition-all text-[11px] font-black"
							>
								<Icon icon="ph:copy-bold" class="text-sm" />
								<span>백업</span>
							</button>
						{/if}
						{#if onDelete}
							<button
								type="button"
								onclick={() => onDelete(Number(asset.id))}
								class="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all text-[11px] font-black"
							>
								<Icon icon="ph:trash-bold" class="text-sm" />
								<span>삭제</span>
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 🔍 원본 초고화질 전체화면 확대/축소 라이트박스 -->
{#if isZoomOpen && asset && asset.category === 'image'}
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex flex-col justify-between bg-black/95 backdrop-blur-xl select-none overflow-hidden"
	>
		<header class="flex items-center justify-between gap-4 p-3 md:p-4 bg-gradient-to-b from-black/80 to-transparent z-20">
			<div class="flex items-center gap-3 min-w-0">
				<button
					type="button"
					class="btn btn-circle btn-sm btn-ghost text-white/80 hover:text-white hover:bg-white/10"
					onclick={closeZoom}
					title="닫기 (ESC)"
				>
					<Icon icon="ph:arrow-left-bold" class="text-xl" />
				</button>
				<div class="min-w-0">
					<h3 class="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{asset.original_name}</h3>
					<div class="flex items-center gap-2 text-[10px] text-white/50 font-mono">
						<span>{formatBytes(asset.file_size)}</span>
						{#if currentImageIndex >= 0}
							<span>•</span>
							<span>{currentImageIndex + 1} / {imageAssets.length}</span>
						{/if}
						{#if asset.meta_info?.has_original === false}
							<span class="text-amber-400 font-sans">• LG 썸네일 고화질</span>
						{:else}
							<span class="text-emerald-400 font-sans">• 원본 파일</span>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
				<button
					type="button"
					class="btn btn-circle btn-xs btn-ghost text-white hover:bg-white/20"
					onclick={handleZoomOut}
					disabled={zoomScale <= 0.5}
					title="축소 (-)"
				>
					<Icon icon="ph:minus-bold" class="text-sm" />
				</button>
				<button
					type="button"
					class="px-2 py-0.5 rounded text-[11px] font-mono font-black text-white hover:bg-white/20 transition-colors"
					onclick={resetZoomState}
					title="100% 리셋"
				>
					{Math.round(zoomScale * 100)}%
				</button>
				<button
					type="button"
					class="btn btn-circle btn-xs btn-ghost text-white hover:bg-white/20"
					onclick={handleZoomIn}
					disabled={zoomScale >= 4}
					title="확대 (+)"
				>
					<Icon icon="ph:plus-bold" class="text-sm" />
				</button>
				<div class="h-3.5 w-px bg-white/20 mx-0.5"></div>
				<button
					type="button"
					class="px-2 py-0.5 rounded text-[10px] font-black uppercase text-white/80 hover:text-white hover:bg-white/20 transition-colors"
					onclick={handleZoomToggle}
					title="더블클릭 토글 (1x / 2.5x)"
				>
					{zoomScale === 1 ? '2.5x' : 'Reset'}
				</button>
				<button
					type="button"
					class="btn btn-circle btn-xs btn-ghost text-white/80 hover:text-rose-400 hover:bg-white/20 ml-1"
					onclick={closeZoom}
					title="닫기 (ESC)"
				>
					<Icon icon="ph:x-bold" class="text-sm" />
				</button>
			</div>
		</header>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden touch-none"
			style="cursor: {zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'};"
			onwheel={handleWheelZoom}
			onmousedown={startPan}
			onmousemove={onPan}
			onmouseup={endPan}
			onmouseleave={endPan}
			ontouchstart={startPan}
			ontouchmove={onPan}
			ontouchend={endPan}
			ondblclick={handleZoomToggle}
		>
			<img
				src={asset.meta_info?.has_original === false
					? getSecureMediaUrl(serverUrl, asset, 'lg')
					: getSecureMediaUrl(serverUrl, asset)}
				alt={asset.original_name || ''}
				draggable="false"
				class="select-none pointer-events-none rounded transition-transform"
				style="transform: translate({panPosition.x}px, {panPosition.y}px) scale({zoomScale}); transform-origin: center center; max-width: 92vw; max-height: 84vh; object-fit: contain; transition-duration: {isDragging ? '0ms' : '120ms'};"
				onerror={(e) => {
					const target = e.currentTarget as HTMLImageElement;
					const lgUrl = getSecureMediaUrl(serverUrl, asset, 'lg');
					if (target.src !== lgUrl) {
						target.src = lgUrl;
					} else {
						target.src = '/default-thumbnail.png';
					}
				}}
			/>

			{#if currentImageIndex > 0}
				<button
					type="button"
					class="absolute left-3 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-2xl active:scale-95 border border-white/10"
					onclick={(e) => {
						e.stopPropagation();
						goToPrev();
					}}
					title="이전 사진 (←)"
				>
					<Icon icon="ph:caret-left-bold" class="text-2xl" />
				</button>
			{/if}

			{#if currentImageIndex >= 0 && currentImageIndex < imageAssets.length - 1}
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-2xl active:scale-95 border border-white/10"
					onclick={(e) => {
						e.stopPropagation();
						goToNext();
					}}
					title="다음 사진 (→)"
				>
					<Icon icon="ph:caret-right-bold" class="text-2xl" />
				</button>
			{/if}
		</div>

		<footer class="p-2 sm:p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4 text-[10px] sm:text-xs font-medium text-white/50 z-20 text-center">
			<span>마우스 휠 또는 더블 클릭으로 확대</span>
			<span class="hidden sm:inline">•</span>
			<span class="hidden sm:inline">드래그하여 이동</span>
			<span>•</span>
			<span>[ESC] 닫기</span>
			<span class="hidden sm:inline">•</span>
			<span class="hidden sm:inline">[←/→] 이전/다음</span>
		</footer>
	</div>
{/if}
