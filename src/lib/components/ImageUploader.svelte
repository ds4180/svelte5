<script>
	/**
	 * [MediaEngine 전용 스마트 업로더 v2.0]
	 * - 새로운 MediaAsset 엔진(/api/media/upload)과 100% 호환됩니다.
	 */
	import { onDestroy, tick } from 'svelte';
	import { fastApi } from '$lib/api';
	import { env } from '$env/dynamic/public';
	import { getThumbnailUrl } from '$lib/config/media';
	import { slide } from 'svelte/transition';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// --- [Props 정의] ---
	let {
		multiple = true,
		app_id = 'general',      
		target_id = null,         
		access_level = 'PUBLIC',  // 👈 추가: 보안 계층 선택
		onUpload = undefined,     
		uploadedAssets = $bindable([]) 
	} = $props();

	// --- [내부 상태 관리] ---
	let files = $state([]);           
	let previewUrls = $state([]);     
	let isLoading = $state(false);    
	let errorMessage = $state('');

	function handleFileChange(e) {
		const selectedFiles = Array.from(e.target.files);
		files = multiple ? [...files, ...selectedFiles] : selectedFiles;
		updatePreviews();
	}

	function updatePreviews() {
		previewUrls.forEach((url) => URL.revokeObjectURL(url));
		previewUrls = files.map((file) => URL.createObjectURL(file));
	}

	function removeSelected(index) {
		const url = previewUrls[index];
		if (url) URL.revokeObjectURL(url);
		files = files.filter((_, i) => i !== index);
		previewUrls = previewUrls.filter((_, i) => i !== index);
	}

	function removeAsset(id) {
		uploadedAssets = uploadedAssets.filter((a) => a.id !== id);
	}

	/**
	 * [핵심] 서버로 미디어 업로드 실행
	 */
	async function uploadToMediaEngine() {
		if (files.length === 0 || isLoading) return;

		isLoading = true;
		errorMessage = '';

		try {
			const formData = new FormData();
			files.forEach((file) => formData.append('files', file));
			
			// ⚠️ access_level 파라미터 주입
			let url = `/api/media/upload?app_id=${app_id}&access_level=${access_level}`;
			if (target_id) url += `&target_id=${target_id}`;

			// 1. API 호출
			const newAssets = await fastApi('POST', url, formData);

			// 2. 상태 초기화
			isLoading = false; 
			previewUrls.forEach((url) => URL.revokeObjectURL(url));
			files = [];
			previewUrls = [];

			await tick();

			if (newAssets) {
				const assetsToAdd = Array.isArray(newAssets) ? newAssets : [newAssets];
				uploadedAssets = [...uploadedAssets, ...assetsToAdd];
				
				if (onUpload) {
					onUpload(newAssets); 
				}
			}
		} catch (err) {
			console.error('Media upload failed:', err);
			errorMessage = err?.detail || '업로드 중 오류가 발생했습니다.';
		} finally {
			isLoading = false;
		}
	}

	onDestroy(() => {
		previewUrls.forEach((url) => URL.revokeObjectURL(url));
	});
</script>

<div class="space-y-4">
	{#if uploadedAssets.length > 0}
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
			{#each uploadedAssets as asset (asset.id)}
				<div class="group relative aspect-square bg-base-200 rounded-lg border border-base-300 overflow-hidden shadow-sm">
					{#if asset.category === 'image'}
						<img src={getThumbnailUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt={asset.original_name} class="w-full h-full object-cover" />
					{:else}
						<div class="w-full h-full flex items-center justify-center text-3xl">📄</div>
					{/if}
					
					<button type="button" class="btn btn-circle btn-xs btn-error absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => removeAsset(asset.id)}>✕</button>
					<div class="absolute bottom-0 left-0 right-0 bg-black/40 text-[10px] text-white p-1 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
						{asset.original_name}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		<label class="btn btn-outline btn-sm gap-2">
			<span class="text-lg">📁</span> 파일 선택
			<input type="file" class="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" {multiple} onchange={handleFileChange} />
		</label>

		{#if files.length > 0}
			<div class="flex items-center gap-2" transition:slide>
				<button type="button" class="btn btn-primary btn-sm shadow-lg" onclick={uploadToMediaEngine} disabled={isLoading}>
					{#if isLoading} <span class="loading loading-spinner loading-xs"></span> {/if}
					☁️ 서버 전송 ({files.length})
				</button>
				<button type="button" class="btn btn-ghost btn-sm text-error" onclick={() => { files = []; updatePreviews(); }}>취소</button>
			</div>
		{/if}
	</div>

	{#if files.length > 0 && !isLoading}
		<div class="flex flex-wrap gap-2 pt-2 border-t border-dashed border-base-300">
			{#each previewUrls as url, i}
				<div class="relative w-16 h-16 rounded-md overflow-hidden border border-base-300 bg-base-100">
					<img src={url} alt="preview" class="w-full h-full object-cover opacity-50" />
					<button type="button" class="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold opacity-0 hover:opacity-100 transition-opacity" onclick={() => removeSelected(i)}>✕</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if errorMessage}
		<div class="alert alert-error py-2 text-sm"><span>⚠️ {errorMessage}</span></div>
	{/if}
</div>
