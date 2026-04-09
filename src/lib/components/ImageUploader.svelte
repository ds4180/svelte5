<script>
	/**
	 * ImageUploader.svelte
	 * @description 파일 업로드 컴포넌트. 이미지 미리보기 및 에디터 삽입 기능 포함. (DaisyUI 스타일 적용)
	 * @prop {boolean} [multiple=true] - 여러 파일 선택 가능 여부
	 * @prop {Array}   uploadedFiles   - 업로드 완료된 파일 목록 (양방향 바인딩)
	 * @prop {Function} [onUpload]     - 업로드 성공 시 호출되는 콜백
	 * @prop {Function} [onInsert]     - 에디터 본문에 이미지를 삽입할 때 호출되는 콜백
	 */
	import { fastApi } from '$lib/api';
	import { onDestroy } from 'svelte';
	import { env } from '$env/dynamic/public';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL;

	// --- [Svelte 5 Props] ---
	let {
		multiple = true,
		onUpload = undefined,
		onInsert = undefined, // ⚠️ 원본에서 선언 없이 사용되던 버그 수정
		uploadedFiles = $bindable([])
	} = $props();

	// --- [상태 관리] ---
	let files = $state([]); // 선택된 파일 (업로드 대기 중)
	let previewUrls = $state([]); // 대기 중인 파일의 미리보기 URL
	let isLoading = $state(false);
	let errorMessage = $state('');

	// --- [파일 선택 핸들러] ---
	function handleFileChange(e) {
		const selectedFiles = Array.from(e.target.files);
		files = multiple ? [...files, ...selectedFiles] : selectedFiles;
		updatePreviews();
	}

	// 선택 대기 파일 미리보기 URL 재생성
	function updatePreviews() {
		previewUrls.forEach((url) => URL.revokeObjectURL(url));
		previewUrls = files.map((file) => URL.createObjectURL(file));
	}

	// 대기 중인 파일 제거
	function removeSelected(index) {
		files = files.filter((_, i) => i !== index);
		updatePreviews();
	}

	// 이미 업로드된 파일 제거
	function removeUploaded(index) {
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
	}

	// --- [서버 업로드] async/await 방식으로 변환 ---
	async function uploadFiles() {
		if (files.length === 0) return;

		isLoading = true;
		errorMessage = '';

		const formData = new FormData();
		files.forEach((file) => formData.append('files', file));

		try {
			// FormData는 fastApi가 Content-Type 헤더를 자동 처리함
			const json = await fastApi('POST', '/api/uploadfiles/', formData);

			// 대기 파일 초기화
			previewUrls.forEach((url) => URL.revokeObjectURL(url));
			files = [];
			previewUrls = [];

			// 업로드된 파일 목록에 추가 (바인딩)
			uploadedFiles = [...uploadedFiles, ...json];

			if (onUpload) onUpload(json);
		} catch (err) {
			errorMessage = err?.detail || '업로드에 실패했습니다.';
		} finally {
			isLoading = false;
		}
	}

	onDestroy(() => {
		previewUrls.forEach((url) => URL.revokeObjectURL(url));
	});
</script>

<!-- ================================================================== -->
<!-- 업로더 컨테이너 (DaisyUI 스타일) -->
<!-- ================================================================== -->
<div
	class="rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-5 transition-colors hover:border-base-content/40"
>
	<!-- 1. 업로드 완료된 파일 목록 -->
	{#if uploadedFiles.length > 0}
		<div class="mb-4">
			<p class="mb-2 text-sm text-base-content/60">첨부된 파일 ({uploadedFiles.length})</p>
			<div
				class="mb-3 grid grid-cols-3 gap-3 border-b border-base-300 pb-3 sm:grid-cols-4 md:grid-cols-6"
			>
				{#each uploadedFiles as img, i}
					<div
						class="group relative aspect-square overflow-hidden rounded-lg border border-base-300 shadow-sm"
					>
						{#if img.thumbnail_filename}
							<img
								src={`${PUBLIC_SERVER_URL}/uploads/thumbnails/${img.thumbnail_filename}`}
								alt={img.original_name}
								class="h-full w-full object-cover"
							/>
							<!-- 에디터 삽입 버튼 (onInsert prop이 있을 때만 표시) -->
							{#if onInsert}
								<button
									type="button"
									class="btn absolute right-0 bottom-0 left-0 rounded-none rounded-b-lg opacity-0 transition-opacity btn-xs btn-primary group-hover:opacity-100"
									onclick={() => onInsert(`${PUBLIC_SERVER_URL}/uploads/${img.filename}`)}
									title="본문에 삽입"
								>
									📥 삽입
								</button>
							{/if}
						{:else}
							<!-- 이미지 아닌 문서 파일 미리보기 -->
							<div
								class="flex h-full w-full flex-col items-center justify-center bg-base-200 p-1 text-center"
							>
								<span class="text-3xl">📄</span>
								<span class="mt-1 text-xs break-all text-base-content/60">{img.original_name}</span>
							</div>
						{/if}
						<!-- 삭제 버튼 -->
						<button
							type="button"
							class="btn absolute top-1 right-1 btn-circle opacity-0 transition-opacity btn-xs btn-error group-hover:opacity-100"
							onclick={() => removeUploaded(i)}
							title="삭제">✕</button
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 2. 파일 선택 및 업로드 버튼 -->
	<div class="flex items-center justify-center gap-3">
		<label class="btn cursor-pointer btn-sm btn-neutral">
			📁 파일 선택
			<input
				type="file"
				accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
				{multiple}
				onchange={handleFileChange}
				class="hidden"
			/>
		</label>

		{#if files.length > 0}
			<button
				type="button"
				class="btn btn-sm btn-primary"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					uploadFiles();
				}}
				disabled={isLoading}
			>
				{#if isLoading}
					<span class="loading loading-xs loading-spinner"></span> 업로드 중...
				{:else}
					☁️ 서버로 전송 ({files.length})
				{/if}
			</button>
		{/if}
	</div>

	<!-- 에러 메시지 -->
	{#if errorMessage}
		<div class="mt-3 alert py-2 text-sm alert-error">
			<span>⚠️ {errorMessage}</span>
		</div>
	{/if}

	<!-- 3. 선택 대기 중인 파일 미리보기 -->
	{#if files.length > 0}
		<div class="mt-4">
			<p class="mb-2 text-sm text-primary">업로드 대기 중... ({files.length})</p>
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
				{#each files as file, i}
					<div
						class="group relative aspect-square overflow-hidden rounded-lg border-2 border-primary/30 shadow-sm"
					>
						{#if file.type.startsWith('image/')}
							<img src={previewUrls[i]} alt="미리보기" class="h-full w-full object-cover" />
						{:else}
							<div
								class="flex h-full w-full flex-col items-center justify-center bg-base-200 p-1 text-center"
							>
								<span class="text-3xl">📄</span>
								<span class="mt-1 text-xs break-all text-base-content/60">{file.name}</span>
							</div>
						{/if}
						<button
							type="button"
							class="btn absolute top-1 right-1 btn-circle opacity-0 transition-opacity btn-xs btn-error group-hover:opacity-100"
							onclick={() => removeSelected(i)}>✕</button
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
