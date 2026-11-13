<script lang="ts">
	/**
	 * @file (app)/v1/pages/uploadfile/+page.svelte
	 * @description Svelte 5 프론트엔드 + SvelteKit 백엔드 청크 분할/스트리밍 테스트 업로더
	 *              (대용량 동영상·문서 테스트를 위해 File.slice 분할 전송 + 실시간 청크 진행률 지원)
	 */
	import { onDestroy, onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatBytes, formatDateTime } from '$lib/utils';

	interface PendingFile {
		id: string;
		file: File;
		previewUrl: string | null;
	}

	interface StoredFile {
		name: string;
		size: number;
		mimeType: string;
		isImage: boolean;
		isVideo?: boolean;
		updatedAt: string;
	}

	interface UploadApiResponse {
		success?: boolean;
		mode?: string;
		uploadDir?: string;
		uploadedBy?: string;
		count?: number;
		files?: unknown[];
		message?: string;
		detail?: string;
	}

	const ENDPOINT = '/v1/pages/uploadfile/files';
	const CHUNK_SIZE_OPTIONS = [
		{ label: '1 MB (분할 확인용)', bytes: 1 * 1024 * 1024 },
		{ label: '5 MB', bytes: 5 * 1024 * 1024 },
		{ label: '10 MB (기본 권장)', bytes: 10 * 1024 * 1024 },
		{ label: '20 MB', bytes: 20 * 1024 * 1024 }
	];

	let selectedFiles = $state<PendingFile[]>([]);
	let serverFiles = $state<StoredFile[]>([]);
	let uploadDir = $state('/app/uploads/svelte_test');
	let maxFileSize = $state(2 * 1024 * 1024 * 1024);
	let selectedChunkBytes = $state(10 * 1024 * 1024);
	let lastResponse = $state<UploadApiResponse | null>(null);

	let isDragging = $state(false);
	let isUploading = $state(false);
	let isLoadingList = $state(false);
	let deletingName = $state<string | null>(null);
	let uploadProgress = $state(0);
	let uploadStatusText = $state('');
	let errorMessage = $state<string | null>(null);

	let fileInputEl: HTMLInputElement | null = null;
	let activeXhr: XMLHttpRequest | null = null;
	let uploadAbortController: AbortController | null = null;
	let listAbortController: AbortController | null = null;

	const totalSelectedBytes = $derived(
		selectedFiles.reduce((sum, item) => sum + item.file.size, 0)
	);
	const totalStoredBytes = $derived(serverFiles.reduce((sum, file) => sum + file.size, 0));

	function getEstimatedChunks(size: number): number {
		if (size <= 0) return 0;
		return Math.max(1, Math.ceil(size / selectedChunkBytes));
	}

	function getFileUrl(name: string, download = false): string {
		const params = new URLSearchParams({ name });
		if (download) params.set('download', '1');
		return `${ENDPOINT}?${params.toString()}`;
	}

	function revokePendingUrl(url: string | null) {
		if (url && typeof URL !== 'undefined') {
			URL.revokeObjectURL(url);
		}
	}

	/**
	 * 서버의 svelte_test 폴더 목록 조회
	 */
	async function fetchServerFiles() {
		if (listAbortController) {
			listAbortController.abort();
		}
		const controller = new AbortController();
		listAbortController = controller;
		isLoadingList = true;

		try {
			const res = await fetch(ENDPOINT, {
				method: 'GET',
				signal: controller.signal
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				const msg =
					res.status === 401
						? '로그인이 필요한 테스트 페이지입니다.'
						: data?.message || `목록 조회 실패 (HTTP ${res.status})`;
				errorMessage = msg;
				return;
			}

			uploadDir = data.uploadDir || uploadDir;
			maxFileSize = data.maxFileSize || maxFileSize;
			serverFiles = Array.isArray(data.files) ? data.files : [];
			errorMessage = null;
		} catch (err) {
			if ((err as Error)?.name === 'AbortError') return;
			errorMessage = '네트워크 오류로 저장 파일 목록을 불러오지 못했습니다.';
			console.error('❌ [UploadPage] Fetch list error:', err);
		} finally {
			if (listAbortController === controller) {
				listAbortController = null;
				isLoadingList = false;
			}
		}
	}

	/**
	 * 대기열에 파일 추가 (중복 선택 방지 및 이미지 즉시 미리보기 생성)
	 */
	function addFiles(incoming: FileList | File[]) {
		errorMessage = null;
		const items: PendingFile[] = [];

		for (const file of Array.from(incoming)) {
			if (file.size === 0) continue;
			if (file.size > maxFileSize) {
				toast.warning(
					`${file.name}: 최대 크기(${formatBytes(maxFileSize)})를 초과해 제외했습니다.`
				);
				continue;
			}

			const isDuplicate = selectedFiles.some(
				(existing) =>
					existing.file.name === file.name &&
					existing.file.size === file.size &&
					existing.file.lastModified === file.lastModified
			);
			if (isDuplicate) continue;

			const previewUrl =
				typeof URL !== 'undefined' && file.type.startsWith('image/')
					? URL.createObjectURL(file)
					: null;

			items.push({
				id: `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 7)}`,
				file,
				previewUrl
			});
		}

		if (items.length > 0) {
			selectedFiles = [...selectedFiles, ...items];
		}
	}

	function handleFileInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			addFiles(input.files);
		}
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (isUploading) return;
		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			addFiles(event.dataTransfer.files);
		}
	}

	function removePendingFile(id: string) {
		if (isUploading) return;
		const target = selectedFiles.find((item) => item.id === id);
		if (target) revokePendingUrl(target.previewUrl);
		selectedFiles = selectedFiles.filter((item) => item.id !== id);
	}

	function clearPendingFiles() {
		if (isUploading) return;
		for (const item of selectedFiles) {
			revokePendingUrl(item.previewUrl);
		}
		selectedFiles = [];
	}

	function cancelUpload() {
		uploadAbortController?.abort();
		activeXhr?.abort();
	}

	/**
	 * XHR로 단일 청크 조각 전송 (조각 내부 바이트 진행률 실시간 반영)
	 */
	function sendChunkPart(
		uploadId: string,
		index: number,
		chunkBlob: Blob,
		originalName: string,
		onChunkProgress: (loadedBytes: number) => void
	): Promise<void> {
		return new Promise((resolve, reject) => {
			if (uploadAbortController?.signal.aborted) {
				reject(new Error('ABORTED'));
				return;
			}

			const fd = new FormData();
			fd.append('uploadId', uploadId);
			fd.append('index', String(index));
			fd.append('chunk', chunkBlob, `${originalName}.part`);

			const xhr = new XMLHttpRequest();
			activeXhr = xhr;
			xhr.open('POST', `${ENDPOINT}?action=chunk`, true);

			xhr.upload.onprogress = (progressEvent) => {
				if (progressEvent.lengthComputable) {
					onChunkProgress(Math.min(progressEvent.loaded, chunkBlob.size));
				}
			};

			xhr.onload = () => {
				let parsed: UploadApiResponse = {};
				try {
					parsed = JSON.parse(xhr.responseText || '{}');
				} catch {
					parsed = {};
				}

				if (xhr.status >= 200 && xhr.status < 300) {
					resolve();
				} else {
					reject(
						new Error(parsed.message || parsed.detail || `청크 오류 (HTTP ${xhr.status})`)
					);
				}
			};

			xhr.onerror = () => reject(new Error('네트워크 오류로 청크 전송이 실패했습니다.'));
			xhr.onabort = () => reject(new Error('ABORTED'));
			xhr.send(fd);
		});
	}

	/**
	 * 단일 파일을 청크 분할(init -> chunk*N -> complete)로 업로드
	 */
	async function uploadSingleFileChunked(
		file: File,
		fileIndex: number,
		fileCount: number,
		completedTotalBytesBefore: number,
		grandTotalBytes: number
	): Promise<UploadApiResponse> {
		const chunkSize = selectedChunkBytes;
		const controller = uploadAbortController!;

		const initRes = await fetch(`${ENDPOINT}?action=init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				originalName: file.name,
				totalSize: file.size,
				chunkSize,
				mimeType: file.type
			}),
			signal: controller.signal
		});

		const initData = await initRes.json().catch(() => ({}));
		if (!initRes.ok) {
			throw new Error(initData?.message || `업로드 초기화 실패 (HTTP ${initRes.status})`);
		}

		const uploadId: string = initData.uploadId;
		const totalChunks: number = initData.totalChunks;

		try {
			for (let idx = 0; idx < totalChunks; idx++) {
				const start = idx * chunkSize;
				const end = Math.min(start + chunkSize, file.size);
				const chunkBlob = file.slice(start, end);

				uploadStatusText = `파일 ${fileIndex + 1}/${fileCount} · 청크 ${idx + 1}/${totalChunks} 전송 중 (${file.name})`;

				await sendChunkPart(uploadId, idx, chunkBlob, file.name, (chunkLoaded) => {
					const overallLoaded = completedTotalBytesBefore + start + chunkLoaded;
					uploadProgress = Math.min(99, Math.round((overallLoaded / grandTotalBytes) * 100));
				});

				const overallAfterChunk = completedTotalBytesBefore + end;
				uploadProgress = Math.min(99, Math.round((overallAfterChunk / grandTotalBytes) * 100));
			}

			uploadStatusText = `파일 ${fileIndex + 1}/${fileCount} · 서버에서 청크 병합 중...`;

			const completeRes = await fetch(`${ENDPOINT}?action=complete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uploadId }),
				signal: controller.signal
			});

			const completeData = await completeRes.json().catch(() => ({}));
			if (!completeRes.ok) {
				throw new Error(
					completeData?.message || `청크 병합 실패 (HTTP ${completeRes.status})`
				);
			}

			return completeData;
		} catch (err) {
			// 중단/오류 시 서버 임시 청크 폴더 정리
			await fetch(`${ENDPOINT}?uploadId=${encodeURIComponent(uploadId)}`, {
				method: 'DELETE'
			}).catch(() => {});
			throw err;
		}
	}

	/**
	 * 선택된 파일 전체를 순차 청크 업로드
	 */
	async function handleUpload(event: SubmitEvent) {
		event.preventDefault();
		if (isUploading) return;

		if (selectedFiles.length === 0) {
			errorMessage = '업로드할 파일을 먼저 선택하거나 끌어다 놓아 주세요.';
			toast.warning(errorMessage);
			return;
		}

		isUploading = true;
		uploadProgress = 0;
		uploadStatusText = '업로드 준비 중...';
		errorMessage = null;
		uploadAbortController = new AbortController();

		const queueSnapshot = [...selectedFiles];
		const grandTotalBytes = Math.max(
			1,
			queueSnapshot.reduce((sum, item) => sum + item.file.size, 0)
		);
		const uploadedResults: unknown[] = [];
		let completedBytes = 0;

		try {
			for (let i = 0; i < queueSnapshot.length; i++) {
				const item = queueSnapshot[i];
				const resData = await uploadSingleFileChunked(
					item.file,
					i,
					queueSnapshot.length,
					completedBytes,
					grandTotalBytes
				);
				completedBytes += item.file.size;
				if (Array.isArray(resData.files)) {
					uploadedResults.push(...resData.files);
				}
			}

			uploadProgress = 100;
			lastResponse = {
				success: true,
				mode: 'chunked',
				uploadDir,
				count: uploadedResults.length,
				files: uploadedResults
			};

			for (const item of selectedFiles) {
				revokePendingUrl(item.previewUrl);
			}
			selectedFiles = [];
			toast.success(`${uploadedResults.length}개 파일이 청크 병합 후 저장되었습니다.`);
			await fetchServerFiles();
		} catch (err) {
			const errName = (err as Error)?.name;
			const msg = (err as Error)?.message || '업로드 중 알 수 없는 오류가 발생했습니다.';
			if (msg === 'ABORTED' || errName === 'AbortError') {
				toast.info('청크 업로드를 취소했습니다.');
			} else {
				errorMessage = msg;
				toast.error(msg);
			}
		} finally {
			activeXhr = null;
			uploadAbortController = null;
			isUploading = false;
			uploadProgress = 0;
			uploadStatusText = '';
		}
	}

	/**
	 * 서버 폴더에서 테스트 파일 삭제
	 */
	async function handleDelete(name: string) {
		if (deletingName || isUploading) return;
		deletingName = name;
		errorMessage = null;

		try {
			const res = await fetch(getFileUrl(name), {
				method: 'DELETE'
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				const msg = data?.message || `삭제 실패 (HTTP ${res.status})`;
				errorMessage = msg;
				toast.error(msg);
				return;
			}

			serverFiles = serverFiles.filter((file) => file.name !== name);
			lastResponse = data;
			toast.success(`삭제 완료: ${name}`);
		} catch (err) {
			const msg = '네트워크 오류로 파일 삭제에 실패했습니다.';
			errorMessage = msg;
			toast.error(msg);
			console.error('❌ [UploadPage] Delete error:', err);
		} finally {
			deletingName = null;
		}
	}

	onMount(() => {
		fetchServerFiles();
	});

	onDestroy(() => {
		uploadAbortController?.abort();
		activeXhr?.abort();
		listAbortController?.abort();
		for (const item of selectedFiles) {
			revokePendingUrl(item.previewUrl);
		}
	});
</script>

<svelte:head>
	<title>{getSiteTitle('파일 업로드 (SvelteKit 청크 테스트)')}</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 px-4 pb-24 md:px-6">
	<!-- 헤더 -->
	<div class="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<div class="mb-1.5 flex flex-wrap items-center gap-2">
				<span class="badge badge-primary badge-sm font-semibold">SvelteKit 청크 스트리밍 테스트</span>
				<span class="badge badge-ghost badge-sm font-mono text-xs">{uploadDir}</span>
			</div>
			<h1 class="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
				<Icon icon="mdi:cloud-upload-outline" class="h-7 w-7 text-blue-600" />
				<span>Svelte 청크 파일 업로드</span>
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				선택한 파일을 브라우저에서 쪼개(<code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">File.slice</code>) SvelteKit 백엔드(<code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ENDPOINT}</code>)에서 스트림 병합 저장합니다.
			</p>
		</div>

		<button
			type="button"
			class="btn btn-outline btn-sm gap-1.5 self-start sm:self-auto"
			onclick={fetchServerFiles}
			disabled={isLoadingList || isUploading}
		>
			<Icon icon="mdi:refresh" class={`h-4 w-4 ${isLoadingList ? 'animate-spin' : ''}`} />
			목록 새로고침
		</button>
	</div>

	{#if errorMessage}
		<div role="alert" class="alert alert-error rounded-2xl text-sm shadow-sm">
			<Icon icon="mdi:alert-circle-outline" class="h-5 w-5 shrink-0" />
			<span>{errorMessage}</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- 좌측: 업로드 폼 -->
		<form
			onsubmit={handleUpload}
			class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5"
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-base font-bold text-slate-900">1. 파일 선택 & 분할 설정</h2>
				<span class="text-xs text-slate-400">최대 {formatBytes(maxFileSize)}</span>
			</div>

			<!-- 청크 단위 선택 -->
			<label class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
				<span class="font-semibold text-slate-600">청크 분할 크기</span>
				<select
					bind:value={selectedChunkBytes}
					disabled={isUploading}
					class="select select-bordered select-xs bg-white font-medium"
				>
					{#each CHUNK_SIZE_OPTIONS as opt (opt.bytes)}
						<option value={opt.bytes}>{opt.label}</option>
					{/each}
				</select>
			</label>

			<input
				bind:this={fileInputEl}
				type="file"
				multiple
				class="hidden"
				onchange={handleFileInput}
				disabled={isUploading}
			/>

			<!-- 드래그 앤 드롭 영역 -->
			<div
				role="button"
				tabindex="0"
				aria-label="파일 선택 또는 드래그 앤 드롭"
				class={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
					isDragging
						? 'border-blue-500 bg-blue-50/70'
						: 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-slate-50'
				} ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
				onclick={() => fileInputEl?.click()}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						fileInputEl?.click();
					}
				}}
				ondragover={(e) => {
					e.preventDefault();
					if (!isUploading) isDragging = true;
				}}
				ondragleave={() => {
					isDragging = false;
				}}
				ondrop={handleDrop}
			>
				<Icon icon="mdi:file-upload-outline" class="mb-2 h-10 w-10 text-blue-500" />
				<p class="text-sm font-semibold text-slate-700">
					파일을 여기로 끌어다 놓거나 클릭하세요
				</p>
				<p class="mt-1 text-xs text-slate-400">문서·압축·대용량 동영상 청크 분할 지원</p>
			</div>

			<!-- 대기 중인 파일 목록 -->
			{#if selectedFiles.length > 0}
				<div class="space-y-2">
					<div class="flex items-center justify-between text-xs text-slate-500">
						<span>선택됨 {selectedFiles.length}개 ({formatBytes(totalSelectedBytes)})</span>
						<button
							type="button"
							class="link link-hover text-slate-400"
							onclick={clearPendingFiles}
							disabled={isUploading}
						>
							비우기
						</button>
					</div>

					<ul class="max-h-60 space-y-2 overflow-y-auto pr-1">
						{#each selectedFiles as item (item.id)}
							<li class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
								{#if item.previewUrl}
									<img
										src={item.previewUrl}
										alt={item.file.name}
										class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
									/>
								{:else}
									<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
										<Icon icon="mdi:file-document-outline" class="h-5 w-5" />
									</div>
								{/if}

								<div class="min-w-0 flex-1">
									<p class="truncate text-xs font-semibold text-slate-800">{item.file.name}</p>
									<p class="text-[11px] text-slate-400">
										{formatBytes(item.file.size)} · {getEstimatedChunks(item.file.size)}조각
									</p>
								</div>

								<button
									type="button"
									class="btn btn-ghost btn-xs text-slate-400 hover:text-error"
									onclick={() => removePendingFile(item.id)}
									disabled={isUploading}
									aria-label="대기 파일 제거"
								>
									<Icon icon="mdi:close" class="h-4 w-4" />
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if isUploading}
				<div class="space-y-1.5">
					<div class="flex items-center justify-between gap-2 text-xs font-medium text-blue-600">
						<span class="truncate">{uploadStatusText}</span>
						<span class="shrink-0">{uploadProgress}%</span>
					</div>
					<progress class="progress progress-primary w-full" value={uploadProgress} max="100"
					></progress>
				</div>
			{/if}

			<div class="flex gap-2 pt-1">
				<button
					type="submit"
					class="btn btn-primary flex-1 gap-2"
					disabled={isUploading || selectedFiles.length === 0}
				>
					{#if isUploading}
						<span class="loading loading-spinner loading-xs"></span>
						청크 전송 중...
					{:else}
						<Icon icon="mdi:upload" class="h-4 w-4" />
						청크 업로드 시작
					{/if}
				</button>

				{#if isUploading}
					<button type="button" class="btn btn-outline btn-error" onclick={cancelUpload}>
						취소
					</button>
				{/if}
			</div>
		</form>

		<!-- 우측: 서버 저장 폴더 파일 목록 -->
		<div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-base font-bold text-slate-900">2. 저장된 폴더 목록</h2>
				<span class="text-xs text-slate-500">
					총 {serverFiles.length}개 · {formatBytes(totalStoredBytes)}
				</span>
			</div>

			{#if isLoadingList && serverFiles.length === 0}
				<div class="flex flex-col items-center justify-center py-14 text-slate-400">
					<span class="loading loading-spinner loading-md mb-2"></span>
					<p class="text-sm">폴더 목록을 불러오는 중...</p>
				</div>
			{:else if serverFiles.length === 0}
				<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-14 text-center text-slate-400">
					<Icon icon="mdi:folder-open-outline" class="mb-2 h-10 w-10 text-slate-300" />
					<p class="text-sm font-medium text-slate-500">저장된 테스트 파일이 없습니다.</p>
					<p class="mt-0.5 text-xs">좌측에서 파일을 업로드하면 여기에 바로 표시됩니다.</p>
				</div>
			{:else}
				<ul class="max-h-[460px] space-y-2.5 overflow-y-auto pr-1">
					{#each serverFiles as file (file.name)}
						<li class="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
							<div class="flex items-center gap-3">
								{#if file.isImage}
									<a
										href={getFileUrl(file.name)}
										target="_blank"
										rel="noopener noreferrer"
										class="shrink-0"
										title="새 창으로 보기"
									>
										<img
											src={getFileUrl(file.name)}
											alt={file.name}
											class="h-12 w-12 rounded-lg border border-slate-200 object-cover"
										/>
									</a>
								{:else if file.isVideo}
									<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
										<Icon icon="mdi:video-outline" class="h-6 w-6" />
									</div>
								{:else}
									<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
										<Icon icon="mdi:file-outline" class="h-6 w-6" />
									</div>
								{/if}

								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-semibold text-slate-800" title={file.name}>
										{file.name}
									</p>
									<p class="text-xs text-slate-400">
										{formatBytes(file.size)} · {formatDateTime(file.updatedAt, true)}
									</p>
								</div>

								<div class="flex shrink-0 items-center gap-1">
									<a
										href={getFileUrl(file.name, true)}
										download={file.name}
										class="btn btn-ghost btn-xs text-slate-600"
										title="다운로드"
									>
										<Icon icon="mdi:download" class="h-4 w-4" />
									</a>

									<button
										type="button"
										class="btn btn-ghost btn-xs text-error"
										onclick={() => handleDelete(file.name)}
										disabled={deletingName === file.name || isUploading}
										title="삭제"
									>
										{#if deletingName === file.name}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<Icon icon="mdi:delete-outline" class="h-4 w-4" />
										{/if}
									</button>
								</div>
							</div>

							{#if file.isVideo}
								<video
									controls
									preload="metadata"
									src={getFileUrl(file.name)}
									class="max-h-56 w-full rounded-lg bg-black"
								>
									<track kind="captions" />
								</video>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<!-- 최근 서버 응답 JSON -->
	{#if lastResponse}
		<div class="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-emerald-400 shadow-sm">
			<div class="mb-2 flex items-center justify-between text-slate-400">
				<span class="font-semibold">SvelteKit Server Response (SHA-256 & Chunk Info)</span>
				<button
					type="button"
					class="text-xs hover:text-white"
					onclick={() => (lastResponse = null)}
				>
					닫기
				</button>
			</div>
			<pre class="overflow-x-auto font-mono whitespace-pre-wrap">{JSON.stringify(lastResponse, null, 2)}</pre>
		</div>
	{/if}
</div>
