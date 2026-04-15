<script>
	import { onMount } from 'svelte';
	import { fastApi } from '$lib/api';
	import { env } from '$env/dynamic/public';
	import { getMediaUrl, getThumbnailUrl } from '$lib/config/media';
	import { fade } from 'svelte/transition';
	import ImageUploader from '$lib/components/ImageUploader.svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	let stats = $state({ total_count: 0, total_size_bytes: 0, tier_summary: {}, folder_physical_summary: {} });
	let mediaList = $state([]);
	let totalItems = $state(0);
	let currentPage = $state(1);
	
	let isLoadingStats = $state(true);
	let isLoadingMedia = $state(true);
	
	let selectedAsset = $state(null);
	let uploadedInSession = $state([]);
	let selectedAccessLevel = $state('PUBLIC');

	async function handleUploadSuccess() {
		await Promise.all([loadStats(), loadMedia(1)]);
		uploadedInSession = [];
	}

	async function loadStats() {
		isLoadingStats = true;
		try {
			stats = await fastApi('GET', '/api/media/admin/stats');
		} catch (err) {
			console.error('Stats load failed', err);
		} finally {
			isLoadingStats = false;
		}
	}

	async function loadMedia(page = 1) {
		isLoadingMedia = true;
		try {
			const res = await fastApi('GET', `/api/media/admin/all?page=${page}&size=24`);
			mediaList = res.items;
			totalItems = res.total;
			currentPage = page;
		} catch (err) {
			console.error('Media list load failed', err);
		} finally {
			isLoadingMedia = false;
		}
	}

	async function deleteAsset(id) {
		if (!confirm('정말로 이 파일을 삭제(격리)하시겠습니까?')) return;
		try {
			await fastApi('DELETE', `/api/media/delete/${id}`);
			selectedAsset = null;
			loadStats();
			loadMedia(currentPage);
		} catch (err) {
			alert('삭제 실패: ' + (err.detail || '오류'));
		}
	}

	function formatBytes(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	onMount(() => {
		loadStats();
		loadMedia();
	});
</script>

<div class="p-6 max-w-7xl mx-auto space-y-8">
	<!-- 1. 통계 및 요약 -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="stats shadow bg-base-100 border border-base-200">
			<div class="stat">
				<div class="stat-title">전체 자산</div>
				<div class="stat-value text-2xl">{stats.total_count}</div>
				<div class="stat-desc">총 물리 용량: {formatBytes(stats.total_size_bytes)}</div>
			</div>
		</div>
		<div class="col-span-2 bg-base-100 p-4 rounded-2xl border border-base-200 shadow-sm flex items-center justify-around">
			{#each ['PUBLIC', 'PROTECTED', 'PRIVATE', 'SYSTEM', 'TMP'] as tier}
				<div class="text-center">
					<div class="text-[10px] font-bold uppercase opacity-50">{tier === 'TMP' ? 'STAGING(TMP)' : tier}</div>
					<div class="font-mono text-sm font-bold">
						{tier === 'TMP' ? (stats.folder_physical_summary?.tmp?.count || 0) : (stats.tier_summary[tier]?.count || 0)} files
					</div>
					<div class="text-[10px] text-base-content/60">
						{formatBytes(tier === 'TMP' ? (stats.folder_physical_summary?.tmp?.size || 0) : (stats.tier_summary[tier]?.size || 0))}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- 2. 직접 업로드 -->
	<div class="collapse bg-base-100 border border-base-200 shadow-sm rounded-2xl overflow-visible">
		<input type="checkbox" /> 
		<div class="collapse-title text-sm font-bold flex items-center gap-2">
			📤 시스템 직접 업로드 <span class="badge badge-sm badge-outline">Admin Only</span>
		</div>
		<div class="collapse-content px-6 pb-6 overflow-visible">
			<select class="select select-bordered select-sm mb-4" bind:value={selectedAccessLevel}>
				{#each ['PUBLIC', 'PROTECTED', 'PRIVATE', 'SYSTEM'] as tier} <option value={tier}>{tier}</option> {/each}
			</select>
			<ImageUploader app_id="admin" access_level={selectedAccessLevel} bind:uploadedAssets={uploadedInSession} onUpload={handleUploadSuccess} />
		</div>
	</div>

	<!-- 3. 탐색기 -->
	<div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
		<div class="p-4 border-b border-base-200 flex justify-between items-center bg-base-200/30">
			<h2 class="font-bold flex items-center gap-2">📂 전역 라이브러리</h2>
			<button class="btn btn-sm btn-ghost" onclick={() => loadMedia(currentPage)}>🔄</button>
		</div>
		{#if isLoadingMedia}
			<div class="h-64 flex items-center justify-center"><span class="loading loading-spinner"></span></div>
		{:else}
			<div class="grid grid-cols-2 md:grid-cols-6 gap-2 p-4">
				{#each mediaList as asset}
					<button class="group p-2 rounded-xl hover:bg-base-200 text-left" onclick={() => selectedAsset = asset}>
						<div class="aspect-square bg-base-300 rounded-lg overflow-hidden border">
							{#if asset.category === 'image'}
								<img src={getThumbnailUrl(PUBLIC_SERVER_URL, asset, 'md')} alt="" class="w-full h-full object-cover" />
							{:else}
								<div class="flex items-center justify-center h-full text-2xl">📄</div>
							{/if}
						</div>
						<p class="text-[10px] truncate mt-1">{asset.original_name}</p>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- 상세 정보 모달 (Windows 속성 창 스타일) -->
{#if selectedAsset}
	<div class="modal modal-open modal-bottom sm:modal-middle" transition:fade={{duration: 150}}>
		<div class="modal-box max-w-2xl p-0 overflow-hidden border border-base-300 shadow-2xl bg-base-100">
			<div class="bg-base-200 p-4 flex justify-between items-center border-b border-base-300">
				<h3 class="font-bold text-lg flex items-center gap-2">🔍 Media Properties</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={() => selectedAsset = null}>✕</button>
			</div>
			
			<div class="flex flex-col md:flex-row p-6 gap-6">
				<div class="md:w-1/2 aspect-square bg-base-300 rounded-xl overflow-hidden shadow-inner flex items-center justify-center border border-base-200">
					{#if selectedAsset.category === 'image'}
						<img src={getMediaUrl(PUBLIC_SERVER_URL, selectedAsset.file_path)} alt="" class="max-w-full max-h-full object-contain" />
					{:else}
						<span class="text-9xl">📄</span>
					{/if}
				</div>
				
				<div class="md:w-1/2 space-y-4">
					<div>
						<label class="text-[10px] font-bold uppercase opacity-40">Original Filename</label>
						<p class="font-bold break-all">{selectedAsset.original_name}</p>
					</div>
					
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="text-[10px] font-bold uppercase opacity-40">Asset ID</label>
							<p class="text-sm">#{selectedAsset.id}</p>
						</div>
						<div>
							<label class="text-[10px] font-bold uppercase opacity-40">Category</label>
							<p class="text-sm capitalize">{selectedAsset.category}</p>
						</div>
						<div>
							<label class="text-[10px] font-bold uppercase opacity-40">Uploader ID</label>
							<p class="text-sm text-primary font-bold">User #{selectedAsset.user_id}</p>
						</div>
						<div>
							<label class="text-[10px] font-bold uppercase opacity-40">Size</label>
							<p class="text-sm">{formatBytes(selectedAsset.file_size)}</p>
						</div>
					</div>

					<div>
						<label class="text-[10px] font-bold uppercase opacity-40">Physical Path</label>
						<div class="p-2 bg-base-200 rounded text-[10px] break-all font-mono border border-base-300">
							{selectedAsset.file_path}
						</div>
					</div>

					<div class="divider">ACTIONS</div>
					
					<div class="flex flex-col gap-2">
						<a href={getMediaUrl(PUBLIC_SERVER_URL, selectedAsset.file_path)} target="_blank" class="btn btn-sm btn-block">🌐 원본 주소로 열기</a>
						<button class="btn btn-sm btn-error btn-outline btn-block" onclick={() => deleteAsset(selectedAsset.id)}>🗑️ 영구 삭제 (격리)</button>
					</div>
				</div>
			</div>
			<div class="bg-base-200/50 p-3 text-[10px] text-center opacity-50">
				Uploaded at: {new Date(selectedAsset.created_at).toLocaleString()}
			</div>
		</div>
		<form method="dialog" class="modal-backdrop bg-black/60 backdrop-blur-sm">
			<button onclick={() => selectedAsset = null}>close</button>
		</form>
	</div>
{/if}
