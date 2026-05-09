<script>
	/**
	 * @file lib/components/FileManager.svelte
	 * @description [v3.2] 미니 미디어 센터 - 통합 관리자 레이아웃 기반 개인 파일 관리
	 */
	import { onMount } from 'svelte';
	import { listUserAssets, listStaffAssets, createUserFolder, deleteAsset } from '$lib/services/mediaService';
	import { env } from '$env/dynamic/public';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { fade, slide, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import ImageUploader from './ImageUploader.svelte';
	import { auth } from '$lib/runes/auth.svelte.js';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// --- [Props] ---
	let { 
		app_id = 'personal_vault', 
		access_level = 'PRIVATE', 
		sub_path = '' 
	} = $props();

	// --- [States] ---
	let files = $state([]);
	let folders = $state([]);
	let currentTier = $state(access_level.toUpperCase());
	let currentSubPath = $state(sub_path); 
	let isLoading = $state(true);
	let selectedAsset = $state(null);
	let isUploading = $state(false);
	let viewMode = $state('grid'); // 'grid' or 'list'

	const userRank = $derived(auth.user?.rank_level || 0);

	// 접근 가능한 티어 목록 정의
	const availableTiers = $derived.by(() => {
		if (userRank >= 4) return ['PUBLIC', 'PROTECTED', 'PRIVATE', 'SYSTEM'];
		if (userRank >= 2) return ['PUBLIC', 'PROTECTED', 'PRIVATE', 'SYSTEM'];
		return ['PRIVATE'];
	});

	// --- [Functions] ---
	async function loadMedia() {
		isLoading = true;
		try {
			let res;
			if (userRank >= 2) {
				res = await listStaffAssets(currentTier, currentSubPath, false);
			} else {
				res = await listUserAssets(currentSubPath, false);
			}
			files = res.files || [];
			folders = res.folders || [];
		} catch (err) {
			console.error('Media list fail', err);
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateFolder() {
		const name = prompt('새 폴더 이름을 입력하세요:');
		if (!name) return;
		try {
			await createUserFolder(currentSubPath, name);
			await loadMedia();
		} catch (err) {
			alert('폴더 생성 실패: ' + (err.detail || '오류'));
		}
	}

	async function handleDelete(id) {
		if (!confirm('정말로 이 파일을 삭제하시겠습니까?')) return;
		try {
			await deleteAsset(id);
			selectedAsset = null;
			await loadMedia();
		} catch (err) {
			alert('삭제 실패: ' + (err.detail || '오류'));
		}
	}

	function enterFolder(path) {
		currentSubPath = path;
		loadMedia();
	}

	function goToParent() {
		if (!currentSubPath) return;
		
		// [v3.3] Rank 1-3의 PRIVATE 티어일 경우 본인 폴더 상위로 이동 불가
		if (userRank < 4 && currentTier === 'PRIVATE' && currentSubPath === `USERS/${auth.user.id}`) {
			return; 
		}

		const parts = currentSubPath.split('/').filter(p => p);
		parts.pop();
		currentSubPath = parts.join('/');
		loadMedia();
	}

	function formatBytes(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	onMount(loadMedia);
</script>

<div class="space-y-8 animate-fade-in font-['Outfit']">
	<!-- 미디어 센터 스타일 헤더 (Stats + Breadcrumbs) -->
	<div class="grid grid-cols-1 md:grid-cols-12 gap-6">
		<!-- Stats Box -->
		<div class="md:col-span-4 bg-black p-8 text-white shadow-[12px_12px_0_0_#3b82f6]">
			<span class="text-[10px] font-black tracking-[0.4em] uppercase opacity-50">Storage Usage</span>
			<div class="mt-4 flex items-end justify-between">
				<div>
					<div class="text-4xl font-black italic tracking-tighter">{files.length}</div>
					<p class="text-[9px] font-bold uppercase tracking-widest text-blue-400">Total Assets</p>
				</div>
				<div class="text-right">
					<div class="text-xl font-black">{formatBytes(files.reduce((acc, f) => acc + f.file_size, 0))}</div>
					<p class="text-[9px] font-bold uppercase tracking-widest opacity-40">Consumed</p>
				</div>
			</div>
		</div>

		<!-- Breadcrumb & Control Box -->
		<div class="md:col-span-8 bg-white border-4 border-black p-8 flex flex-col justify-between">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
					<button onclick={() => enterFolder('')} class="hover:text-blue-600 transition-colors">ROOT</button>
					{#each currentSubPath.split('/').filter(p => p) as part, i}
						<Icon icon="ph:caret-right-bold" />
						<button 
							onclick={() => {
								const parts = currentSubPath.split('/').filter(p => p).slice(0, i + 1);
								enterFolder(parts.join('/'));
							}}
							class="hover:text-blue-600 transition-colors {i === currentSubPath.split('/').filter(p => p).length - 1 ? 'text-black' : ''}"
						>
							{part}
						</button>
					{/each}
				</div>
				<div class="flex gap-2">
					<button onclick={() => viewMode = 'grid'} class="p-2 border-2 border-black {viewMode === 'grid' ? 'bg-black text-white' : 'bg-white text-black'}"><Icon icon="ph:grid-four-bold" /></button>
					<button onclick={() => viewMode = 'list'} class="p-2 border-2 border-black {viewMode === 'list' ? 'bg-black text-white' : 'bg-white text-black'}"><Icon icon="ph:list-bullets-bold" /></button>
				</div>
			</div>
			
			<div class="flex flex-wrap gap-3">
				<button 
					onclick={() => isUploading = !isUploading}
					class="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 bg-yellow-400 border-2 border-black font-black uppercase text-xs tracking-widest hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all shadow-[6px_6px_0_0_#000]"
				>
					<Icon icon={isUploading ? "ph:x-bold" : "ph:upload-simple-bold"} class="text-lg" />
					{isUploading ? 'Close' : 'Upload Files'}
				</button>
				<button 
					onclick={handleCreateFolder}
					class="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 bg-white border-2 border-black font-black uppercase text-xs tracking-widest hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all shadow-[6px_6px_0_0_#000]"
				>
					<Icon icon="ph:folder-plus-bold" class="text-lg" />
					New Folder
				</button>
				<button onclick={loadMedia} class="p-3 border-2 border-black hover:bg-slate-50 transition-all"><Icon icon="ph:arrows-clockwise-bold" class="text-xl" /></button>

				<!-- [v3.3] Rank 4 전용 어드민 도구 -->
				{#if userRank >= 4}
					<a 
						href="/v1/admin/media"
						class="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white border-2 border-black font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-[6px_6px_0_0_#000]"
					>
						<Icon icon="ph:gear-six-bold" /> Admin Dashboard
					</a>
				{/if}
			</div>
		</div>
	</div>
	<!-- Upload Area -->
	{#if isUploading}
		<div transition:slide class="bg-slate-50 border-4 border-dashed border-black p-10 animate-fade-in">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-sm font-black uppercase tracking-widest italic text-blue-600">파일 전송 터미널</h3>
				<span class="text-[10px] font-bold text-slate-400">Target: /PRIVATE/USERS/{auth.user?.id}/{currentSubPath}</span>
			</div>
			<ImageUploader 
				{app_id} 
				{access_level} 
				sub_path="USERS/{auth.user?.id}/{currentSubPath}" 
				onUpload={() => { isUploading = false; loadMedia(); }}
			/>
		</div>
	{/if}

	<!-- Main Content Area -->
	{#if isLoading}
		<div class="flex h-96 flex-col items-center justify-center border-4 border-dashed border-slate-200">
			<div class="h-16 w-16 animate-spin border-8 border-black border-t-blue-600"></div>
			<p class="mt-4 text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">Synchronizing Data...</p>
		</div>
	{:else}
		<section class="min-h-[600px]">
			{#if viewMode === 'grid'}
				<div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
					<!-- Up Button -->
					{#if currentSubPath}
						<button 
							onclick={goToParent}
							class="flex flex-col items-center justify-center aspect-square border-4 border-black bg-slate-50 hover:bg-blue-50 transition-all group p-6"
						>
							<Icon icon="ph:arrow-u-up-left-bold" class="text-4xl opacity-20 group-hover:opacity-100 group-hover:text-blue-600 mb-2" />
							<span class="text-[10px] font-black uppercase tracking-tighter">Go Up</span>
						</button>
					{/if}

					<!-- Folder Icons -->
					{#each folders as folder}
						<button 
							onclick={() => enterFolder(folder.path)}
							class="flex flex-col items-center justify-center aspect-square border-4 border-black bg-white hover:border-blue-600 transition-all group p-6 shadow-[8px_8px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
						>
							<Icon icon="ph:folder-duotone" class="text-5xl text-blue-600/20 group-hover:text-blue-600 transition-colors mb-2" />
							<span class="text-[11px] font-black uppercase truncate w-full text-center tracking-tighter">{folder.name}</span>
						</button>
					{/each}

					<!-- File Icons -->
					{#each files as asset}
						<div class="relative group aspect-square border-4 border-black bg-white overflow-hidden shadow-[8px_8px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
							<button onclick={() => selectedAsset = asset} class="w-full h-full">
								{#if asset.category === 'image'}
									<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt="" class="w-full h-full object-cover transition-all duration-500" />
								{:else}
									<div class="flex flex-col items-center justify-center w-full h-full bg-slate-50">
										<Icon icon="ph:file-bold" class="text-4xl opacity-10" />
										<span class="text-[9px] font-black uppercase mt-1 tracking-tighter text-slate-400">{asset.file_path.split('.').pop()}</span>
									</div>
								{/if}
							</button>
							
							<!-- Hover Actions -->
							<div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
								<p class="text-[10px] text-white font-black uppercase truncate w-full text-center tracking-tighter">{asset.original_name}</p>
								<div class="flex gap-2 mt-2">
									<button class="p-2 bg-white text-black hover:bg-blue-600 hover:text-white transition-all shadow-[4px_4px_0_0_#000] hover:shadow-none" title="Quick View" onclick={() => selectedAsset = asset}>
										<Icon icon="ph:magnifying-glass-bold" />
									</button>
									<button class="p-2 bg-white text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-[4px_4px_0_0_#000] hover:shadow-none" title="Delete" onclick={() => handleDelete(asset.id)}>
										<Icon icon="ph:trash-bold" />
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- List View -->
				<div class="border-4 border-black bg-white overflow-hidden shadow-[12px_12px_0_0_#000]">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="bg-black text-white text-[10px] font-black uppercase tracking-widest">
								<th class="px-6 py-4">Type</th>
								<th class="px-6 py-4">Name</th>
								<th class="px-6 py-4">Size</th>
								<th class="px-6 py-4">Date</th>
								<th class="px-6 py-4 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y-2 divide-black/5">
							{#if currentSubPath}
								<tr class="hover:bg-blue-50 cursor-pointer" onclick={goToParent}>
									<td class="px-6 py-4"><Icon icon="ph:arrow-u-up-left-bold" class="text-xl" /></td>
									<td class="px-6 py-4 font-black text-xs uppercase">.. (Go Up)</td>
									<td colspan="3"></td>
								</tr>
							{/if}
							{#each folders as folder}
								<tr class="hover:bg-blue-50 cursor-pointer group" onclick={() => enterFolder(folder.path)}>
									<td class="px-6 py-4"><Icon icon="ph:folder-fill" class="text-xl text-blue-600/40 group-hover:text-blue-600" /></td>
									<td class="px-6 py-4 font-black text-xs uppercase text-blue-600">{folder.name}</td>
									<td class="px-6 py-4 text-[10px] font-bold opacity-30">FOLDER</td>
									<td class="px-6 py-4">--</td>
									<td class="px-6 py-4 text-right">
										<Icon icon="ph:caret-right-bold" class="inline opacity-20" />
									</td>
								</tr>
							{/each}
							{#each files as asset}
								<tr class="hover:bg-slate-50 cursor-pointer group" onclick={() => selectedAsset = asset}>
									<td class="px-6 py-4"><Icon icon={asset.category === 'image' ? "ph:image-bold" : "ph:file-bold"} class="text-xl opacity-20" /></td>
									<td class="px-6 py-4 font-black text-xs uppercase">{asset.original_name}</td>
									<td class="px-6 py-4 font-mono text-[10px] font-bold opacity-40">{formatBytes(asset.file_size)}</td>
									<td class="px-6 py-4 font-mono text-[10px] font-bold opacity-40">{new Date(asset.created_at).toLocaleDateString()}</td>
									<td class="px-6 py-4 text-right space-x-2">
										<button class="text-rose-600 opacity-0 group-hover:opacity-100" onclick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}>
											<Icon icon="ph:trash-bold" />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if folders.length === 0 && files.length === 0}
				<div class="py-40 text-center border-4 border-dashed border-slate-100">
					<Icon icon="ph:folder-simple-dashed-bold" class="text-7xl mx-auto opacity-5 mb-6" />
					<p class="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">Empty Vault</p>
				</div>
			{/if}
		</section>
	{/if}
</div>

<!-- Asset Detail Modal (v3.2 Reverted) -->
{#if selectedAsset}
	<div transition:fade class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-6">
		<div 
			transition:fly={{ y: 100 }} 
			class="bg-white border-4 md:border-8 border-black max-w-5xl w-full max-h-[90vh] overflow-y-auto md:overflow-hidden shadow-[20px_20px_0_0_#3b82f6] flex flex-col md:flex-row relative"
		>
			<!-- Close Button (Mobile Floating) -->
			<button 
				onclick={() => selectedAsset = null} 
				class="absolute top-4 right-4 z-[110] p-2 bg-white border-2 border-black hover:bg-yellow-400 transition-all shadow-[4px_4px_0_0_#000] md:hidden"
			>
				<Icon icon="ph:x-bold" class="text-xl" />
			</button>

			<!-- Preview Area -->
			<div class="md:w-3/5 bg-slate-950 flex items-center justify-center min-h-[300px] md:min-h-[400px] border-b-4 md:border-b-0 md:border-r-4 border-black relative">
				<button 
					onclick={() => selectedAsset = null} 
					class="hidden md:block absolute top-6 left-6 z-10 p-3 bg-white border-4 border-black hover:bg-yellow-400 transition-all shadow-[6px_6px_0_0_#000]"
				>
					<Icon icon="ph:x-bold" class="text-2xl" />
				</button>
				
				{#if selectedAsset.category === 'image'}
					<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg')} alt="" class="max-w-full max-h-full object-contain" />
				{:else}
					<div class="flex flex-col items-center text-white/20">
						<Icon icon="ph:file-bold" class="text-[80px] md:text-[120px] mb-6" />
						<span class="text-xl md:text-3xl font-black uppercase tracking-tighter">{selectedAsset.file_path.split('.').pop()} FILE</span>
					</div>
				{/if}
			</div>

			<!-- Info Area (Scrollable on mobile) -->
			<div class="md:w-2/5 p-6 md:p-12 flex flex-col justify-between bg-white overflow-y-auto">
				<div class="space-y-6 md:space-y-8">
					<header>
						<span class="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2 block">Asset Terminal</span>
						<h2 class="text-xl md:text-3xl font-black tracking-tighter uppercase italic break-all leading-tight">{selectedAsset.original_name}</h2>
					</header>

					<div class="grid grid-cols-2 gap-4 md:gap-8 border-y-4 border-black py-6 md:py-8">
						<div>
							<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Weight</span>
							<p class="text-sm md:text-lg font-black italic">{formatBytes(selectedAsset.file_size)}</p>
						</div>
						<div>
							<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ident</span>
							<p class="text-sm md:text-lg font-black italic">{selectedAsset.id}</p>
						</div>
					</div>

					<div class="space-y-2">
						<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">System Path</span>
						<code class="block bg-slate-100 p-3 md:p-4 border-2 border-black/5 text-[9px] md:text-[10px] font-bold text-slate-500 break-all">{selectedAsset.file_path}</code>
					</div>
				</div>

				<div class="pt-8 md:pt-10 space-y-3">
					<button class="w-full py-4 md:py-5 bg-black text-white font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-[6px_6px_0_0_#ccc] md:shadow-[8px_8px_0_0_#ccc] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
						<Icon icon="ph:download-simple-bold" class="inline mr-2" /> Download
					</button>
					<div class="flex gap-2">
						<button class="flex-1 py-3 md:py-4 border-2 md:border-4 border-black font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-slate-50 transition-all">
							<Icon icon="ph:share-network-bold" class="inline mr-1" /> Publish
						</button>
						<button onclick={() => handleDelete(selectedAsset.id)} class="flex-1 py-3 md:py-4 border-2 md:border-4 border-black text-rose-600 font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-rose-50 transition-all">
							<Icon icon="ph:trash-bold" class="inline mr-1" /> Delete
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
