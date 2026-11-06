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
	import { getAuthContext } from '$lib/runes/auth.svelte.js';

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
			alert('폴더 생성 실패: ' + (err.detail || '오류'));
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
			alert('삭제 실패: ' + (err.detail || '오류'));
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
			alert('폴더 삭제 실패: ' + (err.detail || '오류'));
		}
	}

	async function deleteSingleAsset(id) {
		if (!confirm('정말로 이 파일을 삭제하시겠습니까?')) return;
		try {
			await fastApi('POST', `/api/media/delete/${id}`);
			selectedAsset = null;
			await loadMedia();
		} catch (err) {
			alert('삭제 실패: ' + (err.detail || '오류'));
		}
	}

	async function downloadSingleFile(asset) {
		try {
			const response = await fetch(getSecureMediaUrl(PUBLIC_SERVER_URL, asset), {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Download fail');
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = asset.original_name;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			alert('다운로드 실패: ' + err.message);
		}
	}

	function formatBytes(bytes) {
		if (!bytes || bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
											<td class="px-8 py-6 text-[10px] text-slate-400 font-mono">{new Date(asset.created_at).toLocaleDateString()}</td>
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

<!-- 상세 정보 모달 -->
{#if selectedAsset}
	<div transition:fade class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
		<div transition:fly={{ y: 100 }} class="relative w-full max-w-6xl overflow-hidden rounded-[3rem] bg-white shadow-2xl flex flex-col md:flex-row">
			<button
				class="absolute top-6 right-6 z-10 btn btn-circle btn-ghost text-slate-400 hover:text-black hover:bg-slate-100"
				onclick={() => (selectedAsset = null)}
			>
				<Icon icon="ph:x-bold" class="text-2xl" />
			</button>
			<div class="md:w-2/3 bg-slate-950 flex items-center justify-center p-2 min-h-[500px]">
				{#if selectedAsset.category === 'image'}
					<img
						src={getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg')}
						alt={selectedAsset.original_name}
						class="w-full h-full max-h-[85vh] rounded-2xl object-contain shadow-2xl shadow-black/50"
					/>
				{:else}
					<div class="flex flex-col items-center text-slate-700">
						<Icon icon="ph:file-bold" class="text-9xl mb-4" />
						<span class="text-2xl font-black uppercase">{selectedAsset.file_path.split('.').pop()} FILE</span>
					</div>
				{/if}
			</div>
			<div class="md:w-1/3 p-8 flex flex-col justify-between bg-white border-l border-slate-100">
				<div class="space-y-6">
					<header>
						<span class="text-[10px] font-black tracking-[0.4em] text-rose-600 uppercase mb-2 block">Asset Details</span>
						<h2 class="text-2xl font-black tracking-tighter text-slate-900 leading-tight break-all">{selectedAsset.original_name}</h2>
					</header>
					<div class="grid grid-cols-2 gap-4 border-y border-slate-100 py-6">
						<div class="space-y-1">
							<span class="text-[9px] font-black text-slate-300 uppercase tracking-widest block">Access Tier</span>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-rose-500"></span>
								<span class="text-xs font-black text-slate-600 uppercase tracking-tighter">{selectedAsset.access_level}</span>
							</div>
						</div>
						<div class="space-y-1">
							<span class="text-[9px] font-black text-slate-300 uppercase tracking-widest block">File Weight</span>
							<span class="text-xs font-black text-slate-600 font-mono tracking-tighter">{formatBytes(selectedAsset.file_size)}</span>
						</div>
					</div>
					<div class="space-y-2">
						<span class="text-[9px] font-black text-slate-300 uppercase tracking-widest block">Physical Path</span>
						<code class="block bg-slate-50 p-4 rounded-2xl text-[10px] font-bold text-slate-400 break-all border border-slate-100">
							{selectedAsset.file_path}
						</code>
					</div>
				</div>
				<div class="pt-8 flex flex-col gap-3">
					<button
						onclick={() => downloadSingleFile(selectedAsset)}
						class="btn h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest hover:bg-rose-600 transition-all border-none"
					>
						<Icon icon="ph:download-simple-bold" class="text-xl mr-2" /> Download
					</button>
					<button
						onclick={() => deleteSingleAsset(selectedAsset.id)}
						class="btn h-12 rounded-xl border-2 border-slate-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-600 hover:text-rose-600 transition-all"
					>
						<Icon icon="ph:trash-bold" class="text-lg mr-1" /> Delete
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
