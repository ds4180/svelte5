<script>
	/**
	 * [MediaEngine 전용 스마트 업로더 v2.0]
	 * - 새로운 MediaAsset 엔진(/api/media/upload)과 100% 호환됩니다.
	 */
	import { onDestroy, tick } from 'svelte';
	import { publishAssets, uploadFiles } from '$lib/services/mediaService';
	import { env } from '$env/dynamic/public';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import PersonalMediaPickerModal from '$lib/components/PersonalMediaPickerModal.svelte';
	import { slide } from 'svelte/transition';
	import { formatApiError } from '$lib/utils/error';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

	// --- [Props 정의] ---
	let {
		multiple = true,
		app_id = 'general',      
		target_id = null,         
		access_level = 'PUBLIC',  
		sub_path = '',
		allowPersonalPicker = true,
		onlyImages = false,
		onUpload = undefined,     
		uploadedAssets = $bindable([]),
		uploadedFiles = $bindable([])
	} = $props();

	let showPersonalPicker = $state(false);

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
		uploadedFiles = uploadedFiles.filter((a) => a.id !== id);
	}

	/**
	 * [핵심] 서버로 미디어 업로드 실행 (엔진 호출)
	 */
	async function uploadToMediaEngine() {
		if (files.length === 0 || isLoading) return;

		isLoading = true;
		errorMessage = '';

		try {
			// 1. 서비스 엔진 호출
			const newAssets = await uploadFiles(files, { app_id, access_level, sub_path, target_id });

			// 2. 상태 초기화
			isLoading = false; 
			previewUrls.forEach((url) => URL.revokeObjectURL(url));
			files = [];
			previewUrls = [];

			await tick();

			if (newAssets) {
				const assetsToAdd = Array.isArray(newAssets) ? newAssets : [newAssets];
				uploadedAssets = [...uploadedAssets, ...assetsToAdd];
				uploadedFiles = [...uploadedFiles, ...assetsToAdd];
				
				if (onUpload) {
					onUpload(newAssets); 
				}
			}
		} catch (err) {
			console.error('Media upload failed:', err);
			errorMessage = formatApiError(err, '업로드 중 오류가 발생했습니다.');
		} finally {
			isLoading = false;
		}
	}

	/**
	 * [개인 보관함(/USERS) 선택 파일 반영]
	 * - 호스트가 PRIVATE이면 원본 자산 그대로 연결하고,
	 *   PUBLIC/PROTECTED 등 공용 대상이면 서비스 영역으로 안전 복사(Publish)합니다.
	 * @param {any[]} pickedAssets
	 */
	async function handlePersonalPicked(pickedAssets) {
		if (!Array.isArray(pickedAssets) || pickedAssets.length === 0) return;
		isLoading = true;
		errorMessage = '';
		try {
			const tierUpper = String(access_level || 'PUBLIC').toUpperCase();
			let resolvedAssets = pickedAssets;
			if (tierUpper !== 'PRIVATE') {
				const publishTier = tierUpper === 'SYSTEM' ? 'PROTECTED' : tierUpper;
				const assetIds = pickedAssets.map((a) => Number(a.id)).filter((id) => Number.isFinite(id) && id > 0);
				if (assetIds.length > 0) {
					resolvedAssets = await publishAssets({
						asset_ids: assetIds,
						app_id: app_id || 'general',
						target_id: target_id ? String(target_id) : null,
						access_level: publishTier,
						sub_path: sub_path || undefined
					});
				}
			}

			const assetsToAdd = Array.isArray(resolvedAssets) ? resolvedAssets : [resolvedAssets];
			uploadedAssets = multiple ? [...uploadedAssets, ...assetsToAdd] : assetsToAdd;
			uploadedFiles = multiple ? [...uploadedFiles, ...assetsToAdd] : assetsToAdd;
			if (onUpload) {
				await onUpload(assetsToAdd);
			}
		} catch (err) {
			console.error('Personal media pick failed:', err);
			errorMessage = formatApiError(err, '개인 파일함 선택 중 오류가 발생했습니다.');
		} finally {
			isLoading = false;
		}
	}

	onDestroy(() => {
		previewUrls.forEach((url) => URL.revokeObjectURL(url));
	});
</script>

<PersonalMediaPickerModal
	bind:open={showPersonalPicker}
	{multiple}
	{onlyImages}
	onSelect={handlePersonalPicked}
/>

<div class="space-y-4">
	{#if uploadedAssets.length > 0}
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
			{#each uploadedAssets as asset (asset.id)}
				<div class="group relative aspect-square bg-base-200 rounded-lg border border-base-300 overflow-hidden shadow-sm">
					{#if asset.category === 'image'}
						<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt={asset.original_name} class="w-full h-full object-cover" />
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

	<div class="flex flex-wrap items-center gap-2">
		<label class="btn btn-outline btn-sm gap-2">
			<span class="text-lg">📁</span> 파일 선택
			<input type="file" class="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" {multiple} onchange={handleFileChange} />
		</label>

		{#if allowPersonalPicker && auth.user?.id}
			<button
				type="button"
				class="btn btn-outline btn-sm gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
				onclick={() => (showPersonalPicker = true)}
				disabled={isLoading}
			>
				<span>🗂️</span>
				<span>내 파일함(/USERS)</span>
			</button>
		{/if}

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
