<script>
	/**
	 * @file lib/components/FileManager.svelte
	 * @description [v3.3] 미니 미디어 센터 (Private 전용) - 미디어 마스터 레이아웃 기반 개인 파일 업로드·삭제·리스트 관리
	 */
	import { onMount } from 'svelte';
	import { fastApi } from '$lib/api';
	import { env } from '$env/dynamic/public';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { fade, fly } from 'svelte/transition';
	import ImageUploader from './ImageUploader.svelte';
	import Icon from '@iconify/svelte';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { portal } from '$lib/actions/portal';
	import { formatBytes, formatDate } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

	// --- [Props] ---
	let {
		app_id = 'personal_vault',
		access_level = 'PRIVATE',
		sub_path = ''
	} = $props();

	// --- [개인 전용 고정 경로 설정] ---
	const userId = $derived(auth.user?.id ?? 0);
	const tier = $derived((access_level || 'PRIVATE').toUpperCase());
	const basePath = $derived(sub_path || (userId ? `USERS/${userId}` : ''));

	// --- [States] ---
	let folders = $state([]);
	let recursiveFiles = $state([]);
	let isLoadingMedia = $state(true);

	let selectedAsset = $state(null);
	let uploadedInSession = $state([]);

	// 탐색기 상태
	let currentSubPath = $state('');
	let viewMode = $state('grid'); // 'grid' | 'list'
	let isRecursive = $state(true);

	// 다중 선택 관리 (Set Reassignment for Svelte 5 Reactivity)
	let selectedIds = $state(new Set());
	let selectedFolders = $state(new Set());

	// --- [Functions] ---
	async function handleUploadSuccess() {
		await loadMedia();
		uploadedInSession = [];
	}

	async function loadMedia() {
		if (!basePath) return;
		if (!currentSubPath || !currentSubPath.startsWith(basePath)) {
			currentSubPath = basePath;
		}
		isLoadingMedia = true;
		selectedIds = new Set();
		selectedFolders = new Set();
		try {
			const res = await fastApi(
				'GET',
				`/api/media/admin/list?tier=${tier}&sub_path=${encodeURIComponent(currentSubPath)}&recursive=${isRecursive}`
			);
			folders = res.folders || [];
			recursiveFiles = res.files || [];
		} catch (err) {
			console.error('Mini Media Center list fail:', err);
		} finally {
			isLoadingMedia = false;
		}
	}

	function toggleSelect(id) {
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
		selectedIds = new Set(selectedIds);
	}

	function toggleFolderSelect(path) {
		if (selectedFolders.has(path)) selectedFolders.delete(path);
		else selectedFolders.add(path);
		selectedFolders = new Set(selectedFolders);
	}

	function toggleSelectAll() {
		const currentlySelected = selectedIds.size + selectedFolders.size;
		if (currentlySelected > 0) {
			selectedIds = new Set();
			selectedFolders = new Set();
		} else {
			const newIds = new Set();
			const newFolders = new Set();
			recursiveFiles.forEach((f) => newIds.add(f.id));
			folders.forEach((f) => newFolders.add(f.path));
			selectedIds = newIds;
			selectedFolders = newFolders;
		}
	}

	async function createFolder() {
		const name = prompt('새 폴더 이름을 입력하세요:');
		if (!name) return;
		try {
			await fastApi('POST', '/api/media/admin/folder/create', {
				tier,
				sub_path: currentSubPath,
				folder_name: name
			}, { offline: false }); // 즉시 결과 확인이 필요하므로 오프라인 우체통 제외
			await loadMedia();
		} catch (err) {
			toast.error('폴더 생성 실패: ' + formatApiError(err, '오류'));
		}
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) return;
		if (!confirm('선택한 항목들을 삭제하시겠습니까?')) return;

		try {
			await fastApi('POST', '/api/media/admin/bulk-delete', {
				asset_ids: Array.from(selectedIds),
				folder_paths: Array.from(selectedFolders),
				tier
			});
			selectedIds = new Set();
			selectedFolders = new Set();
			await loadMedia();
		} catch (err) {
			toast.error('삭제 실패: ' + formatApiError(err, '오류'));
		}
	}

	async function deleteSingleFolder(folderPath, folderName) {
		if (!confirm(`정말로 '${folderName}' 폴더와 내부 파일을 모두 삭제하시겠습니까?`)) return;
		try {
			await fastApi('POST', '/api/media/admin/bulk-delete', {
				asset_ids: [],
				folder_paths: [folderPath],
				tier
			});
			selectedFolders.delete(folderPath);
			selectedFolders = new Set(selectedFolders);
			await loadMedia();
		} catch (err) {
			toast.error('폴더 삭제 실패: ' + formatApiError(err, '오류'));
		}
	}

	async function deleteSingleAsset(id) {
		if (!confirm('정말로 이 파일을 삭제하시겠습니까?')) return;
		try {
			await fastApi('POST', `/api/media/delete/${id}`);
			selectedAsset = null;
			await loadMedia();
		} catch (err) {
			toast.error('삭제 실패: ' + formatApiError(err, '오류'));
		}
	}

	async function downloadSingleFile(asset, size = null) {
		try {
			const targetUrl = getSecureMediaUrl(PUBLIC_SERVER_URL, asset, size);
			const response = await fetch(targetUrl, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Download fail');
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			if (size) {
				const ext = size.toLowerCase();
				const base = asset.original_name.substring(0, asset.original_name.lastIndexOf('.')) || asset.original_name;
				a.download = `${base}_${size}.webp`;
			} else {
				a.download = asset.original_name;
			}
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			toast.error('다운로드 실패: ' + (err.message || '오류'));
		}
	}

	// 🖼️ 상세 모달 이미지 탐색 및 키보드 조작
	let imageAssets = $derived(
		(recursiveFiles || []).filter((a) => a.category === 'image')
	);
	let currentImageIndex = $derived(
		selectedAsset ? imageAssets.findIndex((a) => a.id === selectedAsset.id) : -1
	);

	function goToPrevAsset() {
		if (currentImageIndex > 0) {
			selectedAsset = imageAssets[currentImageIndex - 1];
			zoomScale = 1;
			panPosition = { x: 0, y: 0 };
		}
	}

	function goToNextAsset() {
		if (currentImageIndex >= 0 && currentImageIndex < imageAssets.length - 1) {
			selectedAsset = imageAssets[currentImageIndex + 1];
			zoomScale = 1;
			panPosition = { x: 0, y: 0 };
		}
	}

	// 🔍 초고화질 전체화면 확대/축소 뷰어 (Fullscreen Zoom Lightbox)
	let isZoomOpen = $state(false);
	let zoomScale = $state(1);
	let panPosition = $state({ x: 0, y: 0 });
	let isDragging = $state(false);
	let dragStart = $state({ x: 0, y: 0 });

	function openZoom() {
		zoomScale = 1;
		panPosition = { x: 0, y: 0 };
		isZoomOpen = true;
	}

	function closeZoom() {
		isZoomOpen = false;
		zoomScale = 1;
		panPosition = { x: 0, y: 0 };
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

	function handleWheelZoom(e) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.25 : 0.25;
		zoomScale = Math.min(Math.max(Number((zoomScale + delta).toFixed(2)), 0.5), 4);
		if (zoomScale <= 1) panPosition = { x: 0, y: 0 };
	}

	let initialPinchDistance = 0;
	let initialPinchScale = 1;

	function getTouchDistance(e) {
		if (e.touches && e.touches.length >= 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			return Math.hypot(dx, dy);
		}
		return 0;
	}

	function startPan(e) {
		if (e.touches && e.touches.length === 2) {
			initialPinchDistance = getTouchDistance(e);
			initialPinchScale = zoomScale;
			isDragging = false;
			return;
		}
		if (zoomScale <= 1) return;
		isDragging = true;
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;
		dragStart = { x: clientX - panPosition.x, y: clientY - panPosition.y };
	}

	function onPan(e) {
		if (e.touches && e.touches.length === 2) {
			const currentDist = getTouchDistance(e);
			if (initialPinchDistance > 0 && currentDist > 0) {
				const ratio = currentDist / initialPinchDistance;
				zoomScale = Math.min(Math.max(Number((initialPinchScale * ratio).toFixed(2)), 0.5), 5);
			}
			return;
		}
		if (!isDragging || zoomScale <= 1) return;
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;
		panPosition = {
			x: clientX - dragStart.x,
			y: clientY - dragStart.y
		};
	}

	function endPan() {
		isDragging = false;
		initialPinchDistance = 0;
	}

	function handleModalKeydown(e) {
		if (isZoomOpen) {
			if (e.key === 'Escape') closeZoom();
			else if (e.key === '+' || e.key === '=') handleZoomIn();
			else if (e.key === '-' || e.key === '_') handleZoomOut();
			else if (e.key === '0') handleZoomToggle();
			else if (e.key === 'ArrowLeft') goToPrevAsset();
			else if (e.key === 'ArrowRight') goToNextAsset();
			return;
		}
		if (!selectedAsset) return;
		if (e.key === 'ArrowLeft') {
			goToPrevAsset();
		} else if (e.key === 'ArrowRight') {
			goToNextAsset();
		} else if (e.key === 'Escape') {
			selectedAsset = null;
		}
	}

	function enterFolder(path) {
		currentSubPath = path;
		loadMedia();
	}

	function goToParent() {
		if (!currentSubPath || currentSubPath === basePath) return;
		const parts = currentSubPath.split('/').filter((p) => p);
		parts.pop();
		const nextPath = parts.join('/');
		currentSubPath = nextPath.startsWith(basePath) ? nextPath : basePath;
		loadMedia();
	}

	function getFileRelativePath(filePath) {
		const prefix = `${tier}/${currentSubPath}`.replace(/\/$/, '') + '/';
		if (filePath.startsWith(prefix)) {
			const relative = filePath.substring(prefix.length);
			const parts = relative.split('/');
			if (parts.length > 1) return parts.slice(0, -1).join('/') + '/';
		}
		return './';
	}

	onMount(() => {
		currentSubPath = basePath;
		loadMedia();
	});

	$effect(() => {
		if (basePath && !currentSubPath) {
			currentSubPath = basePath;
			loadMedia();
		}
	});
</script>

<div class="space-y-8 font-['Outfit']">
	<div class="flex flex-col lg:flex-row gap-8">
		<!-- Sidebar: 빠른 업로드 (개인 폴더 전용) -->
		<aside class="lg:w-80 flex-shrink-0 space-y-6">
			<div class="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm sticky top-8 transition-all hover:border-rose-200">
				<div class="mb-6 flex items-center justify-between">
					<h3 class="text-xs font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
						<Icon icon="ph:cloud-arrow-up-bold" class="text-lg" /> 빠른 업로드
					</h3>
					<span class="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
						PRIVATE
					</span>
				</div>
				<div class="p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
					<p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Target Path</p>
					<p class="text-[10px] font-bold text-slate-900 font-mono truncate leading-none italic">
						/{tier}/{currentSubPath}
					</p>
				</div>
				<ImageUploader
					{app_id}
					access_level={tier}
					sub_path={currentSubPath}
					bind:uploadedAssets={uploadedInSession}
					onUpload={handleUploadSuccess}
				/>
			</div>
		</aside>

		<!-- Main Content: 폴더 및 파일 탐색기 -->
		<main class="flex-1 space-y-8 min-w-0">
			<!-- 상단 컨트롤 바 -->
			<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100">
				<div class="text-[11px] breadcrumbs p-0 font-bold uppercase tracking-widest text-slate-400">
					<ul>
						<li>
							<button
								onclick={() => {
									currentSubPath = basePath;
									loadMedia();
								}}
								class="hover:text-rose-600"
							>
								🏠 개인폴더
							</button>
						</li>
						{#each currentSubPath.substring(basePath.length).split('/').filter((p) => p) as part, i}
							<li>
								<button
									onclick={() => {
										const subParts = currentSubPath
											.substring(basePath.length)
											.split('/')
											.filter((p) => p)
											.slice(0, i + 1);
										currentSubPath = basePath + (basePath ? '/' : '') + subParts.join('/');
										loadMedia();
									}}
									class="hover:text-rose-600"
								>
									{part}
								</button>
							</li>
						{/each}
					</ul>
				</div>

				<div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
					<button
						class="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-full hover:border-rose-300 transition-all shadow-sm group"
						onclick={toggleSelectAll}
					>
						<div
							class="h-4 w-4 rounded border-2 flex items-center justify-center transition-all {selectedIds.size + selectedFolders.size > 0 ? 'bg-rose-600 border-rose-600' : 'border-slate-300'}"
						>
							{#if selectedIds.size + selectedFolders.size === folders.length + recursiveFiles.length && folders.length + recursiveFiles.length > 0}
								<Icon icon="ph:check-bold" class="text-white text-[10px]" />
							{:else if selectedIds.size + selectedFolders.size > 0}
								<div class="w-2 h-0.5 bg-white"></div>
							{/if}
						</div>
						<span class="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-600">Select All</span>
					</button>

					<!-- 하위 전체 보기 토글 -->
					<button
						class="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-full transition-all shadow-sm hover:border-indigo-300"
						onclick={() => {
							isRecursive = !isRecursive;
							loadMedia();
						}}
					>
						<Icon icon={isRecursive ? 'mdi:file-tree' : 'mdi:file-document'} class="text-sm {isRecursive ? 'text-indigo-600' : 'text-slate-400'}" />
						<span class="text-[10px] font-black uppercase tracking-widest {isRecursive ? 'text-indigo-600' : 'text-slate-500'}">
							{isRecursive ? '하위 전체 보기' : '폴더내 파일만'}
						</span>
					</button>

					{#if selectedIds.size > 0 || selectedFolders.size > 0}
						<div class="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-full shadow-lg" in:fly={{ x: 20 }}>
							<span class="text-[10px] font-black uppercase tracking-tighter">{selectedIds.size + selectedFolders.size} Items</span>
							<div class="w-px h-4 bg-white/20 mx-2"></div>
							<button class="text-[10px] font-black uppercase hover:underline" onclick={handleBulkDelete}>Delete</button>
						</div>
					{/if}

					<button class="btn btn-xs btn-outline rounded-full px-4 font-black uppercase tracking-widest" onclick={createFolder}>
						<Icon icon="ph:folder-plus-bold" class="mr-1" /> New Folder
					</button>

					<div class="join border-2 border-slate-200 rounded-full overflow-hidden bg-white">
						<button class="join-item btn btn-xs px-4 {viewMode === 'grid' ? 'bg-black text-white' : 'bg-transparent text-slate-400'}" onclick={() => (viewMode = 'grid')}>Grid</button>
						<button class="join-item btn btn-xs px-4 {viewMode === 'list' ? 'bg-black text-white' : 'bg-transparent text-slate-400'}" onclick={() => (viewMode = 'list')}>List</button>
					</div>
					<button class="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-rose-600" onclick={loadMedia}>
						<Icon icon="ph:arrows-clockwise-bold" class="text-lg" />
					</button>
				</div>
			</div>

			{#if isLoadingMedia}
				<div class="flex h-64 items-center justify-center">
					<div class="h-12 w-12 animate-spin rounded-full border-4 border-rose-600 border-t-transparent"></div>
				</div>
			{:else}
				<!-- Folders Section -->
				<section class="space-y-6">
					<div class="flex items-center gap-3">
						<div class="h-px flex-1 bg-slate-100"></div>
						<h3 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Folders ({folders.length})</h3>
						<div class="h-px flex-1 bg-slate-100"></div>
					</div>
					<div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{#if currentSubPath !== basePath}
							<button
								class="flex flex-col items-center p-6 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-rose-300 transition-all group"
								onclick={goToParent}
							>
								<Icon icon="ph:arrow-u-up-left-bold" class="text-4xl text-slate-200 group-hover:text-rose-600 mb-2" />
								<span class="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-600">Go Up</span>
							</button>
						{/if}
						{#each folders as folder}
							<div class="relative group">
								<button
									class="flex flex-col items-center w-full p-6 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-rose-300 hover:shadow-xl transition-all group"
									onclick={() => enterFolder(folder.path)}
								>
									<Icon icon="ph:folder-duotone" class="text-5xl text-rose-600/20 group-hover:text-rose-600 transition-colors mb-2" />
									<p class="text-[10px] font-black truncate w-full text-center tracking-tight text-slate-600 group-hover:text-rose-600">{folder.name}</p>
								</button>
								<div class="absolute right-3 top-3 flex items-center gap-1">
									<button
										class="h-6 w-6 rounded-full bg-white/90 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm"
										title="폴더 삭제"
										onclick={(e) => {
											e.stopPropagation();
											deleteSingleFolder(folder.path, folder.name);
										}}
									>
										<Icon icon="ph:trash-bold" class="text-xs" />
									</button>
									<button
										class="h-6 w-6 rounded-full border-2 border-slate-200 flex items-center justify-center transition-all {selectedFolders.has(folder.path) ? 'bg-rose-600 border-rose-600 scale-110 shadow-lg' : 'bg-white opacity-0 group-hover:opacity-100'}"
										onclick={(e) => {
											e.stopPropagation();
											toggleFolderSelect(folder.path);
										}}
									>
										{#if selectedFolders.has(folder.path)}<Icon icon="ph:check-bold" class="text-white text-xs" />{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Files Section -->
				<section class="space-y-6">
					<div class="flex items-center gap-3">
						<div class="h-px flex-1 bg-slate-100"></div>
						<h3 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Files ({recursiveFiles.length})</h3>
						<div class="h-px flex-1 bg-slate-100"></div>
					</div>
					{#if recursiveFiles.length === 0}
						<div class="py-24 text-center rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/30">
							<Icon icon="ph:images-square-bold" class="text-6xl text-slate-200 mx-auto mb-4" />
							<p class="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">No Assets Found</p>
						</div>
					{:else if viewMode === 'grid'}
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
							{#each recursiveFiles as asset (asset.id)}
								<div in:fade class="group relative flex flex-col items-center">
									<div
										class="relative aspect-square w-full overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-2 transition-all hover:border-rose-600 hover:shadow-2xl hover:-translate-y-2 cursor-pointer"
										onclick={() => (selectedAsset = asset)}
										onkeydown={(e) => e.key === 'Enter' && (selectedAsset = asset)}
										role="button"
										tabindex="0"
									>
										{#if asset.category === 'image'}
											<img
												src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')}
												alt={asset.original_name}
												class="h-full w-full rounded-[1.5rem] object-cover transition-transform duration-500 group-hover:scale-110"
											/>
										{:else}
											<div class="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-300">
												<Icon icon="ph:file-bold" class="text-4xl" />
												<span class="mt-1 text-[8px] font-black uppercase">{asset.file_path.split('.').pop()}</span>
											</div>
										{/if}
									</div>
									<div class="absolute right-3 top-3 flex items-center gap-1">
										<button
											class="h-6 w-6 rounded-full bg-white/90 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm"
											title="파일 삭제"
											onclick={(e) => {
												e.stopPropagation();
												deleteSingleAsset(asset.id);
											}}
										>
											<Icon icon="ph:trash-bold" class="text-xs" />
										</button>
										<button
											class="h-6 w-6 rounded-full border-2 border-white flex items-center justify-center transition-all {selectedIds.has(asset.id) ? 'bg-rose-600 scale-110 shadow-lg' : 'bg-black/20 opacity-0 group-hover:opacity-100 hover:bg-black/40'}"
											onclick={(e) => {
												e.stopPropagation();
												toggleSelect(asset.id);
											}}
										>
											{#if selectedIds.has(asset.id)}<Icon icon="ph:check-bold" class="text-white text-xs" />{/if}
										</button>
									</div>
									<div class="mt-3 w-full px-2 text-center">
										<p class="truncate text-[10px] font-black tracking-tighter text-slate-900">{asset.original_name}</p>
										<p class="truncate text-[8px] font-bold text-slate-300 tracking-tighter italic">{getFileRelativePath(asset.file_path)}</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white">
							<table class="w-full text-left">
								<thead class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
									<tr>
										<th class="px-8 py-4 w-12"></th>
										<th class="px-8 py-4">Name & Path</th>
										<th class="px-8 py-4">Size</th>
										<th class="px-8 py-4">Created</th>
										<th class="px-8 py-4 text-right">Actions</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 font-bold">
									{#each recursiveFiles as asset (asset.id)}
										<tr class="group hover:bg-slate-50/50 transition-colors cursor-pointer" onclick={() => (selectedAsset = asset)}>
											<td class="px-8 py-6">
												<button
													class="h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all {selectedIds.has(asset.id) ? 'bg-rose-600 border-rose-600 shadow-lg' : 'border-slate-200'}"
													onclick={(e) => {
														e.stopPropagation();
														toggleSelect(asset.id);
													}}
												>
													{#if selectedIds.has(asset.id)}<Icon icon="ph:check-bold" class="text-white text-xs" />{/if}
												</button>
											</td>
											<td class="px-8 py-6">
												<div class="flex items-center gap-4">
													<div class="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
														{#if asset.category === 'image'}
															<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt="" class="h-full w-full object-cover" />
														{:else}
															<div class="flex h-full w-full items-center justify-center text-slate-300"><Icon icon="ph:file-bold" /></div>
														{/if}
													</div>
													<div class="min-w-0">
														<div class="text-sm font-black text-slate-900 truncate max-w-xs">{asset.original_name}</div>
														<div class="text-[9px] font-bold text-slate-300 truncate">{asset.file_path}</div>
													</div>
												</div>
											</td>
											<td class="px-8 py-6 text-xs text-slate-400 font-mono">{formatBytes(asset.file_size)}</td>
											<td class="px-8 py-6 text-[10px] text-slate-400 font-mono">{formatDate(asset.created_at)}</td>
											<td class="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
												<button
													class="btn btn-square btn-ghost btn-sm text-slate-400 hover:text-rose-600"
													onclick={(e) => {
														e.stopPropagation();
														downloadSingleFile(asset);
													}}
												>
													<Icon icon="ph:download-simple-bold" />
												</button>
												<button
													class="btn btn-square btn-ghost btn-sm text-slate-400 hover:text-rose-600"
													onclick={(e) => {
														e.stopPropagation();
														deleteSingleAsset(asset.id);
													}}
												>
													<Icon icon="ph:trash-bold" />
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
			{/if}
		</main>
	</div>
</div>

<svelte:window onkeydown={handleModalKeydown} />

<!-- 상세 정보 모달 -->
{#if selectedAsset}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[9999] flex flex-col items-center justify-start md:justify-center overflow-y-auto bg-black/90 p-2 sm:p-4 md:p-6 backdrop-blur-md pt-3 sm:pt-4 md:pt-6"
		onclick={(e) => { if (e.target === e.currentTarget) selectedAsset = null; }}
	>
		<div
			transition:fly={{ y: 30, duration: 200 }}
			class="relative w-full max-w-5xl my-auto overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-white shadow-2xl flex flex-col md:flex-row max-h-none md:max-h-[90dvh] shrink-0"
		>
			<!-- 닫기 버튼 (우측 상단) -->
			<button
				type="button"
				class="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-xl active:scale-95 border border-white/20"
				onclick={() => (selectedAsset = null)}
				aria-label="닫기"
				title="닫기 (ESC)"
			>
				<Icon icon="ph:x-bold" class="text-xl" />
			</button>

			<!-- 🖼️ 좌측(상단) 이미지/미디어 뷰어 영역 -->
			<div class="relative flex-1 md:w-3/5 lg:w-2/3 bg-slate-950 flex items-center justify-center p-2 sm:p-4 min-h-[220px] max-h-[42vh] md:max-h-none overflow-hidden select-none">
				{#if selectedAsset.category === 'image'}
					<button
						type="button"
						class="relative group/preview flex items-center justify-center max-w-full max-h-full cursor-zoom-in bg-transparent border-none p-0 focus:outline-none"
						onclick={openZoom}
						title="클릭하여 원본 전체화면 확대"
					>
						<img
							src={getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg')}
							alt={selectedAsset.original_name}
							class="w-auto h-auto max-w-full max-h-[38vh] md:max-h-[82vh] rounded-xl object-contain shadow-2xl transition-transform duration-300 group-hover/preview:scale-[1.01]"
							onerror={(e) => {
								const target = /** @type {HTMLImageElement} */ (e.currentTarget);
								const mdUrl = getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'md');
								if (target.src !== mdUrl) {
									target.src = mdUrl;
								} else {
									target.src = '/default-thumbnail.png';
								}
							}}
						/>
						<div class="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-white/90 backdrop-blur-md flex items-center gap-1.5 text-xs font-bold shadow-lg opacity-80 group-hover/preview:opacity-100 transition-opacity">
							<Icon icon="ph:magnifying-glass-plus-bold" class="text-base text-rose-400" />
							<span class="hidden sm:inline">확대 보기</span>
						</div>
					</button>

					<!-- ◀ 이전 사진 이동 버튼 -->
					{#if currentImageIndex > 0}
						<button
							type="button"
							class="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-sm shadow-lg active:scale-95"
							onclick={(e) => { e.stopPropagation(); goToPrevAsset(); }}
							title="이전 사진 (←)"
						>
							<Icon icon="ph:caret-left-bold" class="text-2xl" />
						</button>
					{/if}

					<!-- ▶ 다음 사진 이동 버튼 -->
					{#if currentImageIndex >= 0 && currentImageIndex < imageAssets.length - 1}
						<button
							type="button"
							class="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-sm shadow-lg active:scale-95"
							onclick={(e) => { e.stopPropagation(); goToNextAsset(); }}
							title="다음 사진 (→)"
						>
							<Icon icon="ph:caret-right-bold" class="text-2xl" />
						</button>
					{/if}

					<!-- 순번 뱃지 (예: 3 / 12) -->
					{#if currentImageIndex >= 0 && imageAssets.length > 1}
						<div class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] font-black text-white/90 backdrop-blur-sm">
							{currentImageIndex + 1} / {imageAssets.length}
						</div>
					{/if}
				{:else}
					<div class="flex flex-col items-center text-slate-700 py-12">
						<Icon icon="ph:file-bold" class="text-7xl md:text-9xl mb-3" />
						<span class="text-xl md:text-2xl font-black uppercase font-mono">{selectedAsset.file_path.split('.').pop()} FILE</span>
					</div>
				{/if}
			</div>

			<!-- 📋 우측(하단) 상세 정보 및 다운로드/삭제 액션 바 (내부 스크롤 지원) -->
			<div class="md:w-2/5 lg:w-1/3 p-5 sm:p-6 md:p-8 flex flex-col justify-between bg-white overflow-y-auto border-t md:border-t-0 md:border-l border-slate-100">
				<div class="space-y-4 md:space-y-6">
					<header>
						<span class="text-[10px] font-black tracking-[0.4em] text-rose-600 uppercase mb-1.5 block">Asset Details</span>
						<h2 class="text-lg md:text-2xl font-black tracking-tight text-slate-900 leading-tight break-all">{selectedAsset.original_name}</h2>
					</header>

					<div class="grid grid-cols-2 gap-3 md:gap-4 border-y border-slate-100 py-4 md:py-6">
						<div class="space-y-1">
							<span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Access Tier</span>
							<div class="flex items-center gap-1.5">
								<span class="h-2 w-2 rounded-full bg-rose-500"></span>
								<span class="text-xs font-black text-slate-700 uppercase tracking-tighter">{selectedAsset.access_level}</span>
							</div>
						</div>
						<div class="space-y-1">
							<span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">File Weight</span>
							<span class="text-xs font-black text-slate-700 font-mono tracking-tighter">{formatBytes(selectedAsset.file_size)}</span>
						</div>
					</div>

					<!-- 원본 보관 상태 안내 -->
					{#if selectedAsset.category === 'image'}
						<div class="rounded-xl border p-3 text-xs {selectedAsset.meta_info?.has_original === false ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">
							{#if selectedAsset.meta_info?.has_original === false}
								<div class="flex items-center gap-1.5 font-bold">
									<Icon icon="ph:clock-countdown-bold" class="text-sm shrink-0" />
									<span>원본 보관 만료 (경량 썸네일 보존)</span>
								</div>
								<p class="mt-1 text-[10px] opacity-80 leading-normal">
									서버 용량 최적화를 위해 원본은 파기되었으나, 고화질 썸네일(LG)로 영구 보존 중입니다.
								</p>
							{:else}
								<div class="flex items-center gap-1.5 font-bold">
									<Icon icon="ph:check-circle-bold" class="text-sm shrink-0" />
									<span>원본 다운로드 가능</span>
								</div>
								{#if selectedAsset.meta_info?.original_expires_at}
									<p class="mt-0.5 text-[10px] opacity-80">
										보관 만료: {formatDate(selectedAsset.meta_info.original_expires_at)}
									</p>
								{/if}
							{/if}
						</div>
					{/if}

					<div class="space-y-1.5">
						<span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Physical Path</span>
						<code class="block bg-slate-50 p-3 rounded-xl text-[10px] font-bold text-slate-500 break-all border border-slate-100 font-mono">
							{selectedAsset.file_path}
						</code>
					</div>
				</div>

				<!-- 액션 버튼 -->
				<div class="pt-6 flex flex-col gap-2.5">
					{#if selectedAsset.category === 'image' && selectedAsset.meta_info?.has_original === false}
						<!-- 원본 부재 시: 고화질(LG) 썸네일 다운로드 버튼 제공 -->
						<button
							type="button"
							onclick={() => downloadSingleFile(selectedAsset, 'lg')}
							class="btn h-12 md:h-14 rounded-xl bg-blue-600 text-white font-black uppercase tracking-wider hover:bg-blue-700 transition-all border-none shadow-md shadow-blue-600/20"
						>
							<Icon icon="ph:image-bold" class="text-xl mr-1.5" /> 고화질(LG) 다운로드
						</button>
						<button
							type="button"
							disabled
							class="btn h-9 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs border-none cursor-not-allowed opacity-60"
						>
							<Icon icon="ph:lock-bold" class="text-sm mr-1" /> 원본 보관 만료
						</button>
					{:else}
						<!-- 원본 존재 시: 원본 다운로드 활성화 -->
						<button
							type="button"
							onclick={() => downloadSingleFile(selectedAsset)}
							class="btn h-12 md:h-14 rounded-xl bg-black text-white font-black uppercase tracking-wider hover:bg-rose-600 transition-all border-none shadow-md"
						>
							<Icon icon="ph:download-simple-bold" class="text-xl mr-1.5" /> 원본 파일 다운로드
						</button>
					{/if}

					<!-- 닫기 및 삭제 버튼 그룹 -->
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => (selectedAsset = null)}
							class="flex-1 btn h-12 md:h-14 rounded-xl border-2 border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm uppercase tracking-wider transition-all shadow-sm active:scale-98"
						>
							<Icon icon="ph:x-circle-bold" class="text-xl mr-1.5 text-slate-500" /> 닫기
						</button>
						<button
							type="button"
							onclick={() => deleteSingleAsset(selectedAsset.id)}
							class="btn h-12 md:h-14 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all font-bold text-xs"
							title="파일 삭제"
						>
							<Icon icon="ph:trash-bold" class="text-lg mr-1" /> 삭제
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 🔍 원본 초고화질 전체화면 확대/축소 라이트박스 (Fullscreen Zoom Lightbox) -->
{#if isZoomOpen && selectedAsset && selectedAsset.category === 'image'}
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex flex-col justify-between bg-black/95 backdrop-blur-xl select-none overflow-hidden"
	>
		<!-- 🔝 상단 툴바 (파일명, 해상도, 줌 컨트롤, 닫기) -->
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
					<h3 class="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{selectedAsset.original_name}</h3>
					<div class="flex items-center gap-2 text-[10px] text-white/50 font-mono">
						<span>{formatBytes(selectedAsset.file_size)}</span>
						{#if currentImageIndex >= 0}
							<span>•</span>
							<span>{currentImageIndex + 1} / {imageAssets.length}</span>
						{/if}
						{#if selectedAsset.meta_info?.has_original === false}
							<span class="text-amber-400 font-sans">• LG 썸네일 고화질</span>
						{:else}
							<span class="text-emerald-400 font-sans">• 원본 파일</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- 줌 배율 제어 툴바 -->
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
					onclick={() => { zoomScale = 1; panPosition = { x: 0, y: 0 }; }}
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

		<!-- 🖼️ 중앙 줌/팬 캔버스 영역 -->
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
				src={selectedAsset.meta_info?.has_original === false 
					? getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg') 
					: getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset)}
				alt={selectedAsset.original_name}
				draggable="false"
				class="select-none pointer-events-none rounded transition-transform"
				style="transform: translate({panPosition.x}px, {panPosition.y}px) scale({zoomScale}); transform-origin: center center; max-width: 92vw; max-height: 84vh; object-fit: contain; transition-duration: {isDragging ? '0ms' : '120ms'};"
				onerror={(e) => {
					const target = /** @type {HTMLImageElement} */ (e.currentTarget);
					const lgUrl = getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg');
					if (target.src !== lgUrl) {
						target.src = lgUrl;
					} else {
						target.src = '/default-thumbnail.png';
					}
				}}
			/>

			<!-- ◀ 이전 사진 이동 (줌 뷰어) -->
			{#if currentImageIndex > 0}
				<button
					type="button"
					class="absolute left-3 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-2xl active:scale-95 border border-white/10"
					onclick={(e) => { e.stopPropagation(); goToPrevAsset(); }}
					title="이전 사진 (←)"
				>
					<Icon icon="ph:caret-left-bold" class="text-2xl" />
				</button>
			{/if}

			<!-- ▶ 다음 사진 이동 (줌 뷰어) -->
			{#if currentImageIndex >= 0 && currentImageIndex < imageAssets.length - 1}
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 z-30 h-12 w-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-2xl active:scale-95 border border-white/10"
					onclick={(e) => { e.stopPropagation(); goToNextAsset(); }}
					title="다음 사진 (→)"
				>
					<Icon icon="ph:caret-right-bold" class="text-2xl" />
				</button>
			{/if}
		</div>

		<!-- 🔽 하단 가이드 힌트 풋터 -->
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
