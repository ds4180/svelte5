<script>
	/**
	 * @file (app)/v1/admin/media/+page.svelte
	 * @description 미디어 자산 통합 관리 및 백업 시스템 (File Master)
	 */
	import { onMount } from 'svelte';
	import { fastApi } from '$lib/api';
	import { env } from '$env/dynamic/public';
	import { getMediaUrl, getSecureMediaUrl } from '$lib/config/media';
	import { fade, slide, fly } from 'svelte/transition';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import Icon from '@iconify/svelte';
	import { page } from '$app/stores';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// --- 탭 구성 및 권한 설정 ---
	const userRank = $derived($page.data.user?.rank_level ?? 0);
	const userId = $derived($page.data.user?.id ?? 0);

	const tabConfigs = $derived([
		{ id: 'SHARED', label: '공용폴더', tier: 'SYSTEM', basePath: 'GLOBAL/OFFICE' },
		{ id: 'PERSONAL', label: '개인폴더', tier: 'PRIVATE', basePath: `USERS/${userId}` },
		{ id: 'SYSTEM', label: 'SYSTEM', tier: 'SYSTEM', basePath: '' },
		{ id: 'PROTECTED', label: 'PROTECTED', tier: 'PROTECTED', basePath: '' },
		{ id: 'PUBLIC', label: 'PUBLIC', tier: 'PUBLIC', basePath: '' },
		{ id: 'PRIVATE', label: 'PRIVATE', tier: 'PRIVATE', basePath: '', minRank: 4 },
	].filter(tab => !tab.minRank || userRank >= tab.minRank));

	// --- States ---
	let stats = $state({ total_count: 0, total_size_bytes: 0, tier_summary: {}, folder_physical_summary: {} });
	let recentMedia = $state({ public: [], protected: [], private: [], system: [] });
	
	let folders = $state([]); 
	let recursiveFiles = $state([]); 
	
	let isLoadingStats = $state(true);
	let isLoadingMedia = $state(true);
	
	let selectedAsset = $state(null);
	let uploadedInSession = $state([]);
	
	// 탐색기 전용 상태
	let activeTabId = $state('SHARED'); 
	let currentSubPath = $state(''); 
	let searchQuery = $state('');
	let viewMode = $state('grid'); 
	let isRecursive = $state(true); // [v3.2] 하위 파일 포함 여부 토글
	
	// 선택 관리 (Set Reassignment for Svelte 5 Reactivity)
	let selectedIds = $state(new Set());
	let selectedFolders = $state(new Set());

	// [v3.2] GC 예약 모달 상태
	let gcModalOpen = $state(false);
	let gcRunMode = $state('now'); // 'now' or 'later'
	let gcScheduledAt = $state(''); // 'YYYY-MM-DDTHH:mm' 형식

	const currentTab = $derived(tabConfigs.find(t => t.id === activeTabId) || tabConfigs[0]);

	// --- Functions ---
	async function handleUploadSuccess() {
		await Promise.all([loadStats(), loadRecent(), loadMedia()]);
		uploadedInSession = [];
	}

	async function loadStats() {
		isLoadingStats = true;
		try { stats = await fastApi('GET', '/api/media/admin/stats'); } 
		catch (err) { console.error('Stats fail', err); } 
		finally { isLoadingStats = false; }
	}

	async function loadRecent() {
		try { recentMedia = await fastApi('GET', '/api/media/admin/recent?limit=12'); } 
		catch (err) { console.error('Recent fail', err); }
	}

	async function loadMedia() {
		if (!currentTab) return;
		isLoadingMedia = true;
		selectedIds = new Set();
		selectedFolders = new Set();
		try {
			const res = await fastApi('GET', `/api/media/admin/list?tier=${currentTab.tier}&sub_path=${currentSubPath}&recursive=${isRecursive}`);
			folders = res.folders || [];
			recursiveFiles = res.files || [];
		} catch (err) {
			console.error('Media list fail', err);
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
			recursiveFiles.forEach(f => newIds.add(f.id));
			folders.forEach(f => newFolders.add(f.path));
			selectedIds = newIds;
			selectedFolders = newFolders;
		}
	}

	// --- [Action Handlers] ---

	async function createFolder() {
		const name = prompt('새 폴더 이름을 입력하세요:');
		if (!name) return;
		try {
			await fastApi('POST', '/api/media/admin/folder/create', {
				tier: currentTab.tier,
				sub_path: currentSubPath,
				folder_name: name
			});
			loadMedia();
		} catch (err) { alert('생성 실패: ' + (err.detail || '오류')); }
	}

	async function handleBackup() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) return;
		
		if (selectedFolders.size > 0) {
			alert('폴더 백업은 현재 지원되지 않습니다. 파일만 선택하여 백업해 주세요.');
			return;
		}

		try {
			const res = await fastApi('POST', '/api/media/admin/backup', {
				asset_ids: Array.from(selectedIds),
				folder_paths: [],
				tier: currentTab.tier
			});
			alert(res.message || '✅ 백업 작업이 시작되었습니다.');
			selectedIds = new Set(); selectedFolders = new Set();
			loadMedia();
		} catch (err) { alert('백업 실패: ' + (err.detail || '오류')); }
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) return;
		if (!confirm('선택한 항목들을 삭제(격리)하시겠습니까?')) return;

		try {
			await fastApi('POST', '/api/media/admin/bulk-delete', {
				asset_ids: Array.from(selectedIds),
				folder_paths: Array.from(selectedFolders),
				tier: currentTab.tier
			});
			selectedIds = new Set(); selectedFolders = new Set();
			loadMedia(); loadStats();
		} catch (err) { alert('삭제 실패: ' + (err.detail || '오류')); }
	}

	async function handleRunGC() {
		try {
			const res = await fastApi('POST', '/api/media/admin/gc', { 
				indices: [1, 2, 3, 4, 5],
				scheduled_at: (gcRunMode === 'later' && gcScheduledAt) ? new Date(gcScheduledAt).toISOString() : null
			});
			alert(res.message);
			gcModalOpen = false;
			gcScheduledAt = '';
			gcRunMode = 'now';
		} catch (err) { 
			const msg = err.detail ? (typeof err.detail === 'object' ? JSON.stringify(err.detail) : err.detail) : '오류';
			alert('GC 예약 실패: ' + msg); 
		}
	}

	async function handleZipDownload() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) return;
		try {
			const response = await fetch('/api/media/admin/zip-download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					asset_ids: Array.from(selectedIds),
					folder_paths: Array.from(selectedFolders),
					tier: currentTab.tier
				})
			});
			if (!response.ok) throw new Error('Download fail');
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `admin_export_${new Date().getTime()}.zip`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) { alert('다운로드 실패: ' + err.message); }
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
		} catch (err) { alert('다운로드 실패: ' + err.message); }
	}

	async function deleteAsset(id) {
		if (!confirm('정말로 이 파일을 삭제하시겠습니까?')) return;
		try {
			await fastApi('DELETE', `/api/media/delete/${id}`);
			selectedAsset = null;
			loadStats(); loadRecent(); loadMedia();
		} catch (err) { alert('삭제 실패: ' + (err.detail || '오류')); }
	}

	function formatBytes(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function selectTab(tab) {
		activeTabId = tab.id;
		currentSubPath = tab.basePath;
		loadMedia();
	}

	function enterFolder(path) {
		currentSubPath = path;
		loadMedia();
	}

	function goToParent() {
		if (currentSubPath === currentTab.basePath) return;
		const parts = currentSubPath.split('/').filter(p => p);
		parts.pop();
		currentSubPath = parts.join('/');
		loadMedia();
	}

	function getFileRelativePath(filePath) {
		const prefix = `${currentTab.tier}/${currentSubPath}`.replace(/\/$/, '') + '/';
		if (filePath.startsWith(prefix)) {
			const relative = filePath.substring(prefix.length);
			const parts = relative.split('/');
			if (parts.length > 1) return parts.slice(0, -1).join('/') + '/';
		}
		return './';
	}

	onMount(() => {
		loadStats();
		loadRecent();
		const initialTab = tabConfigs.find(t => t.id === activeTabId) || tabConfigs[0];
		currentSubPath = initialTab.basePath;
		loadMedia();
	});

</script>

<div class="mx-auto max-w-7xl space-y-8 px-4 pb-20 font-['Outfit'] md:px-8">
	<!-- Header -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
				File & Media Asset Management (Rank: {userRank})
			</span>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				미디어 <span class="NOT-ITALIC text-rose-600">마스터</span>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				시스템의 모든 물리 자산을 계층별로 탐색하고, 중요한 데이터를 안전하게 백업 및 관리합니다.
			</p>
		</div>
	</header>

	<!-- Stats Summary -->
	<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
		{#each ['SYSTEM', 'PROTECTED', 'PUBLIC', 'PRIVATE'] as tier}
			{#if tier !== 'PRIVATE' || userRank >= 4}
				<div class="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm flex flex-col items-center text-center">
					<div class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{tier}</div>
					<div class="text-2xl font-black text-slate-900 leading-none mb-1">{stats.tier_summary[tier]?.count || 0}</div>
					<div class="text-[9px] font-bold text-rose-600/50 font-mono">{formatBytes(stats.tier_summary[tier]?.size || 0)}</div>
				</div>
			{/if}
		{/each}

		<!-- GC Trigger Button -->
		{#if userRank >= 4}
			<button 
				onclick={() => gcModalOpen = true}
				class="bg-slate-900 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center group hover:bg-rose-600 transition-all border-2 border-slate-900 hover:border-rose-600"
			>
				<Icon icon="mdi:broom" class="text-3xl text-white mb-2 group-hover:scale-110 transition-transform" />
				<div class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-white/80">Optimize</div>
				<div class="text-sm font-black text-white leading-none mt-1">시스템 정리</div>
			</button>
		{/if}
	</div>

	<!-- Tabs -->
	<nav class="flex gap-2 border-b-2 border-slate-100 overflow-x-auto no-scrollbar">
		{#each tabConfigs as tab}
			<button onclick={() => selectTab(tab)} class="px-8 py-4 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTabId === tab.id ? 'border-b-4 border-rose-600 text-rose-600' : 'text-slate-400 opacity-50 hover:opacity-100'}">
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="flex flex-col lg:flex-row gap-8">
		<!-- Sidebar: Uploader -->
		<aside class="lg:w-80 flex-shrink-0 space-y-6">
			<div class="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm sticky top-8 transition-all hover:border-rose-200">
				<div class="mb-6 flex items-center justify-between">
					<h3 class="text-xs font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
						<Icon icon="ph:cloud-arrow-up-bold" class="text-lg" /> 빠른 업로드
					</h3>
				</div>
				<div class="p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
					<p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Target Path</p>
					<p class="text-[10px] font-bold text-slate-900 font-mono truncate leading-none italic uppercase">
						/{currentTab?.tier}/{currentSubPath}
					</p>
				</div>
				<ImageUploader app_id="admin" access_level={currentTab?.tier} sub_path={currentSubPath} bind:uploadedAssets={uploadedInSession} onUpload={handleUploadSuccess} />
			</div>
		</aside>

		<!-- Main Content -->
		<main class="flex-1 space-y-8 min-w-0">
			<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100">
				<div class="text-[11px] breadcrumbs p-0 font-bold uppercase tracking-widest text-slate-400">
					<ul>
						<li><button onclick={() => currentSubPath = currentTab.basePath} class="hover:text-rose-600">🏠 {currentTab?.label}</button></li>
						<!-- 기점 경로(basePath) 이후의 하위 경로들만 브레드크럼으로 생성 -->
						{#each currentSubPath.substring(currentTab.basePath.length).split('/').filter(p => p) as part, i}
							<li>
								<button onclick={() => {
									const subParts = currentSubPath.substring(currentTab.basePath.length).split('/').filter(p => p).slice(0, i + 1);
									currentSubPath = currentTab.basePath + (currentTab.basePath ? '/' : '') + subParts.join('/');
									loadMedia();
								}} class="hover:text-rose-600">
									{part}
								</button>
							</li>
						{/each}
					</ul>
				</div>
				<div class="flex items-center gap-4 w-full md:w-auto">
					<button class="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-full hover:border-rose-300 transition-all shadow-sm group" onclick={toggleSelectAll}>
						<div class="h-4 w-4 rounded border-2 flex items-center justify-center transition-all { (selectedIds.size + selectedFolders.size) > 0 ? 'bg-rose-600 border-rose-600' : 'border-slate-300' }">
							{#if (selectedIds.size + selectedFolders.size) === (folders.length + recursiveFiles.length) && (folders.length + recursiveFiles.length) > 0}
								<Icon icon="ph:check-bold" class="text-white text-[10px]" />
							{:else if (selectedIds.size + selectedFolders.size) > 0}
								<div class="w-2 h-0.5 bg-white"></div>
							{/if}
						</div>
						<span class="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-600">Select All</span>
					</button>

					<!-- [v3.2] 하위 전체 보기 토글 -->
					<button 
						class="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-full transition-all shadow-sm hover:border-indigo-300" 
						onclick={() => { isRecursive = !isRecursive; loadMedia(); }}
					>
						<Icon icon={isRecursive ? "mdi:file-tree" : "mdi:file-document"} class="text-sm {isRecursive ? 'text-indigo-600' : 'text-slate-400'}" />
						<span class="text-[10px] font-black uppercase tracking-widest {isRecursive ? 'text-indigo-600' : 'text-slate-500'}">
							{isRecursive ? '하위 전체 보기' : '폴더내 파일만'}
						</span>
					</button>

					{#if selectedIds.size > 0 || selectedFolders.size > 0}
						<div class="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-full shadow-lg" in:fly={{ x: 20 }}>
							<span class="text-[10px] font-black uppercase tracking-tighter">{selectedIds.size + selectedFolders.size} Items</span>
							<div class="w-px h-4 bg-white/20 mx-2"></div>
							<button class="text-[10px] font-black uppercase hover:underline" onclick={handleZipDownload}>Zip</button>
							<button class="text-[10px] font-black uppercase hover:underline" onclick={handleBackup}>Backup</button>
							<button class="text-[10px] font-black uppercase hover:underline" onclick={handleBulkDelete}>Delete</button>
						</div>
					{/if}

					<button class="btn btn-xs btn-outline rounded-full px-4 font-black uppercase tracking-widest" onclick={createFolder}>
						<Icon icon="ph:folder-plus-bold" class="mr-1" /> New Folder
					</button>

					<div class="join border-2 border-slate-200 rounded-full overflow-hidden bg-white">
						<button class="join-item btn btn-xs px-4 {viewMode === 'grid' ? 'bg-black text-white' : 'bg-transparent text-slate-400'}" onclick={() => viewMode = 'grid'}>Grid</button>
						<button class="join-item btn btn-xs px-4 {viewMode === 'list' ? 'bg-black text-white' : 'bg-transparent text-slate-400'}" onclick={() => viewMode = 'list'}>List</button>
					</div>
					<button class="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-rose-600" onclick={loadMedia}><Icon icon="ph:arrows-clockwise-bold" class="text-lg" /></button>
				</div>
			</div>

			{#if isLoadingMedia}
				<div class="flex h-64 items-center justify-center"><div class="h-12 w-12 animate-spin rounded-full border-4 border-rose-600 border-t-transparent"></div></div>
			{:else}
				<section class="space-y-6">
					<div class="flex items-center gap-3"><div class="h-px flex-1 bg-slate-100"></div><h3 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Folders</h3><div class="h-px flex-1 bg-slate-100"></div></div>
					<div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{#if currentSubPath !== currentTab.basePath}
							<button class="flex flex-col items-center p-6 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-rose-300 transition-all group" onclick={goToParent}><Icon icon="ph:arrow-u-up-left-bold" class="text-4xl text-slate-200 group-hover:text-rose-600 mb-2" /><span class="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-600">Go Up</span></button>
						{/if}
						{#each folders as folder}
							<div class="relative group">
								<button class="flex flex-col items-center w-full p-6 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-rose-300 hover:shadow-xl transition-all group" onclick={() => enterFolder(folder.path)}>
									<Icon icon="ph:folder-duotone" class="text-5xl text-rose-600/20 group-hover:text-rose-600 transition-colors mb-2" />
									<p class="text-[10px] font-black truncate w-full text-center tracking-tight text-slate-600 group-hover:text-rose-600">{folder.name}</p>
								</button>
								<button class="absolute right-4 top-4 h-6 w-6 z-10 rounded-full border-2 border-slate-200 flex items-center justify-center transition-all {selectedFolders.has(folder.path) ? 'bg-rose-600 border-rose-600 scale-110 shadow-lg' : 'bg-white opacity-0 group-hover:opacity-100'}" onclick={() => toggleFolderSelect(folder.path)}>
									{#if selectedFolders.has(folder.path)}<Icon icon="ph:check-bold" class="text-white text-xs" />{/if}
								</button>
							</div>
						{/each}
					</div>
				</section>

				<section class="space-y-6">
					<div class="flex items-center gap-3"><div class="h-px flex-1 bg-slate-100"></div><h3 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Files ({recursiveFiles.length})</h3><div class="h-px flex-1 bg-slate-100"></div></div>
					{#if recursiveFiles.length === 0}
						<div class="py-24 text-center rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/30"><Icon icon="ph:images-square-bold" class="text-6xl text-slate-200 mx-auto mb-4" /><p class="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">No Assets Found</p></div>
					{:else}
						{#if viewMode === 'grid'}
							<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
								{#each recursiveFiles as asset}
									<div in:fade class="group relative flex flex-col items-center">
										<div class="relative aspect-square w-full overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-2 transition-all hover:border-rose-600 hover:shadow-2xl hover:-translate-y-2 cursor-pointer" onclick={() => selectedAsset = asset} role="button" tabindex="0">
											{#if asset.category === 'image'}<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt="" class="h-full w-full rounded-[1.5rem] object-cover transition-transform duration-500 group-hover:scale-110" />{:else}<div class="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-300"><Icon icon="ph:file-bold" class="text-4xl" /><span class="mt-1 text-[8px] font-black uppercase">{asset.file_path.split('.').pop()}</span></div>{/if}
										</div>
										<button class="absolute right-4 top-4 h-6 w-6 z-10 rounded-full border-2 border-white flex items-center justify-center transition-all {selectedIds.has(asset.id) ? 'bg-rose-600 scale-110 shadow-lg' : 'bg-black/20 opacity-0 group-hover:opacity-100 hover:bg-black/40'}" onclick={(e) => { e.stopPropagation(); toggleSelect(asset.id); }}>{#if selectedIds.has(asset.id)}<Icon icon="ph:check-bold" class="text-white text-xs" />{/if}</button>
										<div class="mt-3 w-full px-2 text-center"><p class="truncate text-[10px] font-black tracking-tighter text-slate-900">{asset.original_name}</p><p class="truncate text-[8px] font-bold text-slate-300 uppercase tracking-tighter italic">{getFileRelativePath(asset.file_path)}</p></div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white"><table class="w-full text-left"><thead class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400"><tr><th class="px-8 py-4 w-12"></th><th class="px-8 py-4">Name & Path</th><th class="px-8 py-4">Size</th><th class="px-8 py-4">Created</th><th class="px-8 py-4 text-right">Actions</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold">{#each recursiveFiles as asset}<tr class="group hover:bg-slate-50/50 transition-colors cursor-pointer" onclick={() => selectedAsset = asset}><td class="px-8 py-6"><button class="h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all {selectedIds.has(asset.id) ? 'bg-rose-600 border-rose-600 shadow-lg' : 'border-slate-200'}" onclick={(e) => { e.stopPropagation(); toggleSelect(asset.id); }}>{#if selectedIds.has(asset.id)}<Icon icon="ph:check-bold" class="text-white text-xs" />{/if}</button></td><td class="px-8 py-6"><div class="flex items-center gap-4"><div class="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{#if asset.category === 'image'}<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt="" class="h-full w-full object-cover" />{:else}<div class="flex h-full w-full items-center justify-center text-slate-300"><Icon icon="ph:file-bold" /></div>{/if}</div><div class="min-w-0"><div class="text-sm font-black text-slate-900 truncate max-w-xs">{asset.original_name}</div><div class="text-[9px] font-bold text-slate-300 uppercase truncate">{asset.file_path}</div></div></div></td><td class="px-8 py-6 text-xs text-slate-400 font-mono">{formatBytes(asset.file_size)}</td><td class="px-8 py-6 text-[10px] text-slate-400 font-mono">{new Date(asset.created_at).toLocaleDateString()}</td><td class="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-opacity"><button class="btn btn-square btn-ghost btn-sm text-slate-400 hover:text-rose-600" onclick={(e) => { e.stopPropagation(); downloadSingleFile(asset); }}><Icon icon="ph:download-simple-bold" /></button></td></tr>{/each}</tbody></table></div>
						{/if}
					{/if}
				</section>
			{/if}
		</main>
	</div>
</div>

<!-- [v3.2] GC 예약 모달 -->
{#if gcModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
		<div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" in:fly={{ y: 20 }}>
			<div class="p-8">
				<div class="flex items-center gap-3 mb-6">
					<div class="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
						<Icon icon="mdi:broom" class="text-2xl" />
					</div>
					<div>
						<h3 class="text-xl font-black text-slate-900 uppercase italic">System Optimize</h3>
						<p class="text-xs font-bold text-slate-400">시스템 가비지 컬렉션 예약</p>
					</div>
				</div>

				<div class="space-y-4">
					<div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
						<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">정리 대상 항목</p>
						<ul class="text-xs font-bold text-slate-600 space-y-1">
							<li>• 고립 파일 및 유령 레코드 정리</li>
							<li>• 원본 없는 썸네일 파일 삭제</li>
							<li>• 만료된 삭제 폴더 영구 제거</li>
							<li>• 시스템 내 모든 빈 폴더 청소</li>
						</ul>
					</div>

					<!-- [v3.2] 실행 모드 선택 (라디오 버튼) -->
					<div class="space-y-3">
						<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">실행 모드 선택</p>
						<div class="grid grid-cols-2 gap-3">
							<button 
								onclick={() => gcRunMode = 'now'}
								class="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all {gcRunMode === 'now' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}"
							>
								<Icon icon="mdi:flash" class="text-lg" />
								<span class="text-xs font-black uppercase">즉시 실행</span>
							</button>
							<button 
								onclick={() => gcRunMode = 'later'}
								class="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all {gcRunMode === 'later' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}"
							>
								<Icon icon="mdi:calendar-clock" class="text-lg" />
								<span class="text-xs font-black uppercase">예약 실행</span>
							</button>
						</div>
					</div>

					{#if gcRunMode === 'later'}
						<div in:slide>
							<label for="gc-time" class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">예약 시간 설정</label>
							<input 
								id="gc-time"
								type="datetime-local" 
								bind:value={gcScheduledAt}
								class="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
							/>
						</div>
					{/if}
				</div>

				<div class="flex gap-3 mt-8">
					<button 
						onclick={() => gcModalOpen = false}
						class="flex-1 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 transition-all uppercase text-xs tracking-widest"
					>
						Cancel
					</button>
					<button 
						onclick={handleRunGC}
						class="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 uppercase text-xs tracking-widest"
					>
						Schedule
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 상세 정보 모달 -->
{#if selectedAsset}
	<div transition:fade class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
		<div transition:fly={{ y: 100 }} class="relative w-full max-w-6xl overflow-hidden rounded-[3rem] bg-white shadow-2xl flex flex-col md:flex-row">
			<button class="absolute top-6 right-6 z-10 btn btn-circle btn-ghost text-slate-400 hover:text-black hover:bg-slate-100" onclick={() => selectedAsset = null}><Icon icon="ph:x-bold" class="text-2xl" /></button>
			<!-- 이미지 영역 (2/3 비중, LG 고해상도 썸네일 표시) -->
			<div class="md:w-2/3 bg-slate-950 flex items-center justify-center p-2 min-h-[500px]">
				{#if selectedAsset.category === 'image'}
					<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg')} alt="" class="w-full h-full max-h-[85vh] rounded-2xl object-contain shadow-2xl shadow-black/50" />
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
								<span class="h-2 w-2 rounded-full {selectedAsset.access_level === 'PUBLIC' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
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
						<code class="block bg-slate-50 p-4 rounded-2xl text-[10px] font-bold text-slate-400 break-all border border-slate-100">{selectedAsset.file_path}</code>
					</div>
				</div>
				<div class="pt-8 flex flex-col gap-3">
					<button onclick={() => downloadSingleFile(selectedAsset)} class="btn h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest hover:bg-rose-600 transition-all border-none">
						<Icon icon="ph:download-simple-bold" class="text-xl mr-2" /> Download
					</button>
					<div class="flex gap-2">
						<button onclick={() => handleBackup([selectedAsset.id])} class="flex-1 btn h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-900 hover:border-rose-600 hover:text-rose-600 transition-all">
							<Icon icon="ph:copy-bold" class="text-lg" />
						</button>
						<button onclick={() => deleteAsset(selectedAsset.id)} class="flex-1 btn h-12 rounded-xl border-2 border-slate-200 bg-white text-rose-300 hover:bg-rose-50 hover:border-rose-600 hover:text-rose-600 transition-all">
							<Icon icon="ph:trash-bold" class="text-lg" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) { background-color: #fcfcfc; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
