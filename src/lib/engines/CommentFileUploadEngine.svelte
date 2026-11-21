<script>
	/**
	 * CommentEngine.svelte
	 * @description 댓글 엔진 컴포넌트. BoardEngine의 서비스 바인딩으로 마운트됨. (DaisyUI 스타일 적용)
	 * @prop {{ id: number }} post - 부모 게시물 객체 (id 필수)
	 */
	import * as commentApi from '$lib/api/comment';
	import { uploadFiles, publishAssets, deleteAsset } from '$lib/services/mediaService';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { env } from '$env/dynamic/public';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDateTime } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import PersonalMediaPickerModal from '$lib/components/PersonalMediaPickerModal.svelte';
	import Icon from '@iconify/svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

	// --- [Svelte 5 Props] ---
	let { post, config = {}, accessLevel = 'PUBLIC', boardSlug = '' } = $props();

	const targetTier = $derived((accessLevel || 'PUBLIC').toUpperCase() === 'PROTECTED' ? 'PROTECTED' : 'PUBLIC');
	const commentSubPath = $derived(boardSlug ? `BOARDS/${boardSlug}/COMMENTS/${post?.id}` : `COMMENTS/${post?.id}`);

	// --- [상태 관리] ---
	let comments = $state(/** @type {any[]} */ ([]));
	let newComment = $state('');
	let loading = $state(true);
	let uploading = $state(false);
	let submitting = $state(false);
	let pendingAssets = $state(/** @type {any[]} */ ([]));
	let fileInputEl = $state(/** @type {HTMLInputElement | null} */ (null));

	// --- [댓글 수정 상태] ---
	let editingId = $state(/** @type {number | null} */ (null));
	let editContent = $state('');
	let editAttachments = $state(/** @type {any[]} */ ([]));
	let editPendingAssets = $state(/** @type {any[]} */ ([]));
	let removeMediaIds = $state(/** @type {number[]} */ ([]));
	let savingEdit = $state(false);
	let uploadingEdit = $state(false);
	let editFileInputEl = $state(/** @type {HTMLInputElement | null} */ (null));
	let showPersonalPicker = $state(false);
	let pickerMode = $state(/** @type {'create' | 'edit'} */ ('create'));

	// --- [이미지 미리보기 모달 상태 (PWA 친화적)] ---
	let previewImages = $state(/** @type {any[]} */ ([]));
	let previewIndex = $state(-1);
	const activePreview = $derived(
		previewIndex >= 0 && previewIndex < previewImages.length ? previewImages[previewIndex] : null
	);

	/**
	 * @param {any[]} assets
	 * @param {any} targetAsset
	 */
	function openImagePreview(assets, targetAsset) {
		const imgs = (assets || []).filter((a) => a?.mime_type?.startsWith('image/'));
		if (imgs.length === 0) return;
		const idx = imgs.findIndex((a) => a.id === targetAsset?.id);
		previewImages = imgs;
		previewIndex = idx >= 0 ? idx : 0;
	}

	function closeImagePreview() {
		previewIndex = -1;
		previewImages = [];
	}

	function prevPreviewImage() {
		if (previewImages.length <= 1) return;
		previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length;
	}

	function nextPreviewImage() {
		if (previewImages.length <= 1) return;
		previewIndex = (previewIndex + 1) % previewImages.length;
	}

	/** @param {KeyboardEvent} e */
	function handlePreviewKeydown(e) {
		if (!activePreview) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			closeImagePreview();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prevPreviewImage();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			nextPreviewImage();
		}
	}

	// --- [데이터 로드] ---
	async function loadComments() {
		if (!post?.id) return;
		loading = true;
		try {
			comments = await commentApi.getComments(post.id);
		} catch (e) {
			console.error('[CommentEngine] 댓글 로딩 실패:', e);
		} finally {
			loading = false;
		}
	}

	/**
	 * 1단계: 댓글 작성 전 본인 계정(PRIVATE) 보관함으로 파일 임시 업로드
	 * @param {Event} event
	 */
	async function handleFileSelect(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const files = input?.files ? Array.from(input.files) : [];
		if (files.length === 0) return;

		uploading = true;
		try {
			const userSubPath = auth.user?.id ? `USERS/${auth.user.id}/COMMENT_TEMP` : '';
			const res = await uploadFiles(files, {
				app_id: 'personal_vault',
				access_level: 'PRIVATE',
				sub_path: userSubPath
			});
			const uploaded = Array.isArray(res?.assets) ? res.assets : Array.isArray(res) ? res : [];
			pendingAssets = [...pendingAssets, ...uploaded];
			toast.success(`${uploaded.length}개 파일이 개인 보관함에 임시 업로드되었습니다.`);
		} catch (e) {
			toast.error('파일 업로드 실패: ' + formatApiError(e, '업로드 오류'));
		} finally {
			uploading = false;
			if (input) input.value = '';
		}
	}

	/** @param {number} assetId */
	async function removePendingAsset(assetId) {
		const target = pendingAssets.find((a) => a.id === assetId);
		pendingAssets = pendingAssets.filter((a) => a.id !== assetId);
		if (target?._fromPersonalVault) return;
		try {
			await deleteAsset(assetId);
		} catch (e) {
			console.error('[CommentFileUploadEngine] 임시 파일 삭제 실패:', e);
		}
	}

	/** @param {any[]} pickedAssets */
	function handlePersonalPicked(pickedAssets) {
		if (!Array.isArray(pickedAssets) || pickedAssets.length === 0) return;
		const tagged = pickedAssets.map((a) => ({ ...a, _fromPersonalVault: true }));
		if (pickerMode === 'edit') {
			const existingIds = new Set(editPendingAssets.map((a) => a.id));
			const uniqueNew = tagged.filter((a) => !existingIds.has(a.id));
			editPendingAssets = [...editPendingAssets, ...uniqueNew];
		} else {
			const existingIds = new Set(pendingAssets.map((a) => a.id));
			const uniqueNew = tagged.filter((a) => !existingIds.has(a.id));
			pendingAssets = [...pendingAssets, ...uniqueNew];
		}
		toast.success(`내 파일함에서 ${tagged.length}개 파일을 선택했습니다.`);
	}

	// --- [댓글 등록 핸들러: 2단계 물리 복사 배포 및 댓글 연결] ---
	/** @param {Event} event */
	async function handleCommentSubmit(event) {
		event.preventDefault();
		if (submitting || uploading) return;
		if (!newComment.trim() && pendingAssets.length === 0) return;

		submitting = true;
		try {
			/** @type {number[]} */
			let publishedIds = [];
			if (pendingAssets.length > 0) {
				const publishedList = await publishAssets({
					asset_ids: pendingAssets.map((a) => a.id),
					access_level: targetTier,
					app_id: 'comment',
					sub_path: commentSubPath
				});
				publishedIds = (Array.isArray(publishedList) ? publishedList : [])
					.map((a) => Number(a?.id))
					.filter((id) => Number.isFinite(id) && id > 0);
			}

			await commentApi.createComment(post.id, {
				content: newComment.trim() || '(첨부파일)',
				media_ids: publishedIds
			});
			newComment = '';
			pendingAssets = [];
			await loadComments();
		} catch (e) {
			toast.error('댓글 작성 실패: ' + formatApiError(e, '오류'));
		} finally {
			submitting = false;
		}
	}

	/** @param {any} comment */
	function canModify(comment) {
		if (!auth.user) return false;
		return comment.user_id === auth.user.id || (auth.user.rank_level ?? 0) >= 4;
	}

	/** @param {any} comment */
	function startEdit(comment) {
		editingId = comment.id;
		editContent = comment.content || '';
		editAttachments = [...(comment.attachments || [])];
		editPendingAssets = [];
		removeMediaIds = [];
	}

	/** @param {boolean} [cleanupPending=true] */
	async function cancelEdit(cleanupPending = true) {
		const assetsToClean = cleanupPending ? [...editPendingAssets] : [];
		editingId = null;
		editContent = '';
		editAttachments = [];
		editPendingAssets = [];
		removeMediaIds = [];
		if (assetsToClean.length > 0) {
			const tempOnly = assetsToClean.filter((a) => !a._fromPersonalVault);
			if (tempOnly.length > 0) {
				await Promise.allSettled(tempOnly.map((a) => deleteAsset(a.id)));
			}
		}
	}

	/** @param {number} assetId */
	function removeExistingAttachment(assetId) {
		editAttachments = editAttachments.filter((a) => a.id !== assetId);
		if (!removeMediaIds.includes(assetId)) {
			removeMediaIds = [...removeMediaIds, assetId];
		}
	}

	/** @param {number} assetId */
	async function removeEditPendingAsset(assetId) {
		const target = editPendingAssets.find((a) => a.id === assetId);
		editPendingAssets = editPendingAssets.filter((a) => a.id !== assetId);
		if (target?._fromPersonalVault) return;
		try {
			await deleteAsset(assetId);
		} catch (e) {
			console.error('[CommentFileUploadEngine] 수정 임시 파일 삭제 실패:', e);
		}
	}

	/** @param {Event} event */
	async function handleEditFileSelect(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const files = input?.files ? Array.from(input.files) : [];
		if (files.length === 0) return;

		uploadingEdit = true;
		try {
			const userSubPath = auth.user?.id ? `USERS/${auth.user.id}/COMMENT_TEMP` : '';
			const res = await uploadFiles(files, {
				app_id: 'personal_vault',
				access_level: 'PRIVATE',
				sub_path: userSubPath
			});
			const uploaded = Array.isArray(res?.assets) ? res.assets : Array.isArray(res) ? res : [];
			editPendingAssets = [...editPendingAssets, ...uploaded];
			toast.success(`${uploaded.length}개 파일이 개인 보관함에 임시 업로드되었습니다.`);
		} catch (e) {
			toast.error('파일 업로드 실패: ' + formatApiError(e, '업로드 오류'));
		} finally {
			uploadingEdit = false;
			if (input) input.value = '';
		}
	}

	/** @param {number} commentId */
	async function saveEdit(commentId) {
		if (savingEdit || uploadingEdit) return;
		if (!editContent.trim() && editAttachments.length === 0 && editPendingAssets.length === 0) return;

		savingEdit = true;
		try {
			/** @type {number[]} */
			let publishedIds = [];
			if (editPendingAssets.length > 0) {
				const publishedList = await publishAssets({
					asset_ids: editPendingAssets.map((a) => a.id),
					access_level: targetTier,
					app_id: 'comment',
					sub_path: commentSubPath
				});
				publishedIds = (Array.isArray(publishedList) ? publishedList : [])
					.map((a) => Number(a?.id))
					.filter((id) => Number.isFinite(id) && id > 0);
			}

			await commentApi.updateComment(commentId, {
				content: editContent.trim() || '(첨부파일)',
				media_ids: publishedIds,
				remove_media_ids: removeMediaIds
			});
			toast.success('댓글이 수정되었습니다.');
			await cancelEdit(false);
			await loadComments();
		} catch (e) {
			toast.error('댓글 수정 실패: ' + formatApiError(e, '오류'));
		} finally {
			savingEdit = false;
		}
	}

	/** @param {number} commentId */
	async function handleDelete(commentId) {
		if (!confirm('댓글을 삭제하시겠습니까?')) return;
		try {
			await commentApi.deleteComment(commentId);
			toast.success('댓글이 삭제되었습니다.');
			await loadComments();
		} catch (e) {
			toast.error('댓글 삭제 실패: ' + formatApiError(e, '오류'));
		}
	}

	// 🔄 게시물(post.id) 변경 시마다 댓글 목록 자동 재조회
	$effect(() => {
		if (post?.id) {
			loadComments();
		}
	});
</script>

<!-- ================================================================== -->
<!-- 댓글 엔진 (DaisyUI 스타일) -->
<!-- ================================================================== -->
<div class="comment-engine mt-4">
	<h4 class="mb-4 flex items-center gap-2 text-lg font-bold">
		<Icon icon="lucide:message-circle" class="text-primary" />
		댓글
		<span class="badge badge-sm badge-neutral">{comments.length}</span>
	</h4>

	<!-- 댓글 작성 폼 -->
	<div class="card mb-5 border border-base-300 bg-base-200">
		<div class="card-body p-4">
			<form onsubmit={handleCommentSubmit}>
				<textarea
					class="textarea-bordered textarea w-full resize-none"
					rows="3"
					bind:value={newComment}
					placeholder="댓글을 입력하세요..."
				></textarea>

				{#if pendingAssets.length > 0}
					<div class="mt-2.5 flex flex-wrap gap-2">
						{#each pendingAssets as asset (asset.id)}
							<div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-xs">
								{#if asset.mime_type?.startsWith('image/')}
									<button
										type="button"
										onclick={() => openImagePreview(pendingAssets, asset)}
										class="shrink-0 overflow-hidden rounded-md"
										aria-label="이미지 미리보기"
									>
										<img
											src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')}
											alt={asset.original_name}
											class="h-7 w-7 object-cover"
										/>
									</button>
								{:else}
									<Icon icon="ph:file-bold" class="h-4 w-4 text-slate-500" />
								{/if}
								<span class="max-w-[160px] truncate font-medium text-slate-700">{asset.original_name}</span>
								<button
									type="button"
									onclick={() => removePendingAsset(asset.id)}
									class="rounded-full p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
									aria-label="첨부 삭제"
								>
									<Icon icon="ph:x-bold" class="h-3.5 w-3.5" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<div class="mt-2.5 flex items-center justify-between gap-2">
					{#if config?.allow_upload !== false}
						<div class="flex flex-wrap items-center gap-1.5">
							<input
								bind:this={fileInputEl}
								type="file"
								multiple
								onchange={handleFileSelect}
								class="hidden"
							/>
							<button
								type="button"
								disabled={uploading}
								onclick={() => fileInputEl?.click()}
								class="btn btn-sm btn-ghost border border-slate-300 text-xs font-bold"
							>
								<Icon icon={uploading ? 'ph:spinner-gap-bold' : 'ph:paperclip-bold'} class="mr-1 {uploading ? 'animate-spin' : ''}" />
								{uploading ? '업로드 중...' : '파일 첨부'}
							</button>
							{#if auth.user?.id}
								<button
									type="button"
									disabled={uploading}
									onclick={() => {
										pickerMode = 'create';
										showPersonalPicker = true;
									}}
									class="btn btn-sm btn-ghost border border-indigo-200 bg-indigo-50/70 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
								>
									<Icon icon="ph:folder-user-bold" class="mr-1" />
									내 파일함(/USERS)
								</button>
							{/if}
						</div>
					{:else}
						<div></div>
					{/if}
					<button
						type="submit"
						disabled={submitting || uploading}
						class="btn btn-sm btn-primary"
					>
						<Icon icon={submitting ? 'ph:spinner-gap-bold' : 'lucide:send'} class="mr-1 {submitting ? 'animate-spin' : ''}" />
						{submitting ? '등록 중...' : '댓글 등록'}
					</button>
				</div>
			</form>
		</div>
	</div>

	<!-- 댓글 목록 -->
	<div class="comment-list space-y-4">
		{#if loading}
			<!-- 로딩 표시 -->
			<div class="flex justify-center py-6">
				<span class="loading loading-md loading-dots text-primary"></span>
			</div>
		{:else if comments.length === 0}
			<!-- 빈 상태 -->
			<div class="py-8 text-center text-base-content/50">
				<Icon icon="lucide:message-square-dashed" class="mx-auto mb-2 text-4xl" />
				<p class="text-sm">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
			</div>
		{:else}
			<!-- 댓글 목록 -->
			{#each comments as comment (comment.id)}
				<div class="flex gap-3">
					<!-- 아바타 -->
					<div class="placeholder avatar flex-shrink-0">
						<div class="h-10 w-10 rounded-full bg-neutral text-neutral-content">
							<span class="text-sm">{(comment.user?.username || '?')[0].toUpperCase()}</span>
						</div>
					</div>
					<!-- 내용 -->
					<div class="flex-1">
						<div class="mb-1 flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span class="text-sm font-bold">{comment.user?.username || '익명'}</span>
								<span class="text-xs text-base-content/40">
									{formatDateTime(comment.create_date)}
								</span>
							</div>
							{#if canModify(comment) && editingId !== comment.id}
								<div class="flex items-center gap-1.5 text-xs">
									<button
										type="button"
										onclick={() => startEdit(comment)}
										class="font-bold text-blue-600 hover:underline"
									>
										수정
									</button>
									<button
										type="button"
										onclick={() => handleDelete(comment.id)}
										class="font-bold text-rose-500 hover:underline"
									>
										삭제
									</button>
								</div>
							{/if}
						</div>

						{#if editingId === comment.id}
							<div class="space-y-2.5 rounded-lg border border-slate-200 bg-base-200 p-3">
								<textarea
									rows="3"
									bind:value={editContent}
									class="textarea-bordered textarea w-full resize-none text-sm"
								></textarea>

								{#if editAttachments.length > 0 || editPendingAssets.length > 0}
									<div class="flex flex-wrap gap-2">
										{#each editAttachments as att (att.id)}
											<div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-xs">
												{#if att.mime_type?.startsWith('image/')}
													<img
														src={getSecureMediaUrl(PUBLIC_SERVER_URL, att, 'sm')}
														alt={att.original_name}
														class="h-7 w-7 rounded-md object-cover"
													/>
												{:else}
													<Icon icon="ph:file-bold" class="h-4 w-4 text-slate-500" />
												{/if}
												<span class="max-w-[140px] truncate font-medium text-slate-700">{att.original_name}</span>
												<button
													type="button"
													onclick={() => removeExistingAttachment(att.id)}
													class="rounded-full p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
													aria-label="기존 첨부 삭제"
												>
													<Icon icon="ph:x-bold" class="h-3.5 w-3.5" />
												</button>
											</div>
										{/each}
										{#each editPendingAssets as asset (asset.id)}
											<div class="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs shadow-xs">
												{#if asset.mime_type?.startsWith('image/')}
													<img
														src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')}
														alt={asset.original_name}
														class="h-7 w-7 rounded-md object-cover"
													/>
												{:else}
													<Icon icon="ph:file-bold" class="h-4 w-4 text-blue-500" />
												{/if}
												<span class="max-w-[140px] truncate font-medium text-blue-700">{asset.original_name}</span>
												<button
													type="button"
													onclick={() => removeEditPendingAsset(asset.id)}
													class="rounded-full p-0.5 text-blue-400 hover:bg-rose-50 hover:text-rose-500"
													aria-label="새 첨부 삭제"
												>
													<Icon icon="ph:x-bold" class="h-3.5 w-3.5" />
												</button>
											</div>
										{/each}
									</div>
								{/if}

								<div class="flex items-center justify-between gap-2">
									{#if config?.allow_upload !== false}
										<div class="flex flex-wrap items-center gap-1.5">
											<input
												bind:this={editFileInputEl}
												type="file"
												multiple
												onchange={handleEditFileSelect}
												class="hidden"
											/>
											<button
												type="button"
												disabled={uploadingEdit}
												onclick={() => editFileInputEl?.click()}
												class="btn btn-xs btn-ghost border border-slate-300 font-bold"
											>
												<Icon icon={uploadingEdit ? 'ph:spinner-gap-bold' : 'ph:paperclip-bold'} class="mr-1 {uploadingEdit ? 'animate-spin' : ''}" />
												{uploadingEdit ? '업로드 중...' : '파일 추가'}
											</button>
											{#if auth.user?.id}
												<button
													type="button"
													disabled={uploadingEdit}
													onclick={() => {
														pickerMode = 'edit';
														showPersonalPicker = true;
													}}
													class="btn btn-xs btn-ghost border border-indigo-200 bg-indigo-50/70 font-bold text-indigo-700 hover:bg-indigo-100"
												>
													<Icon icon="ph:folder-user-bold" class="mr-1" />
													내 파일함
												</button>
											{/if}
										</div>
									{:else}
										<div></div>
									{/if}
									<div class="flex gap-1.5">
										<button type="button" onclick={() => cancelEdit()} class="btn btn-xs btn-ghost">취소</button>
										<button
											type="button"
											disabled={savingEdit || uploadingEdit}
											onclick={() => saveEdit(comment.id)}
											class="btn btn-xs btn-primary"
										>
											{savingEdit ? '저장 중...' : '저장'}
										</button>
									</div>
								</div>
							</div>
						{:else}
							<p class="rounded-lg bg-base-200 p-3 text-sm text-base-content/80">
								{comment.content}
							</p>
							{#if comment.attachments && comment.attachments.length > 0}
								<div class="mt-2 flex flex-wrap gap-2">
									{#each comment.attachments as att (att.id)}
										{#if att.mime_type?.startsWith('image/')}
											<button
												type="button"
												onclick={() => openImagePreview(comment.attachments, att)}
												class="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-blue-400"
												title={att.original_name}
												aria-label="{att.original_name} 미리보기"
											>
												<img
													src={getSecureMediaUrl(PUBLIC_SERVER_URL, att, 'sm')}
													alt={att.original_name}
													class="h-20 w-20 object-cover transition group-hover:scale-105"
												/>
											</button>
										{:else}
											<a
												href={getSecureMediaUrl(PUBLIC_SERVER_URL, att)}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-blue-400 hover:text-blue-600"
											>
												<Icon icon="ph:paperclip-bold" class="h-3.5 w-3.5 text-slate-400" />
												<span class="max-w-[180px] truncate">{att.original_name}</span>
											</a>
										{/if}
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<svelte:window onkeydown={handlePreviewKeydown} />

<PersonalMediaPickerModal
	bind:open={showPersonalPicker}
	multiple={true}
	title="댓글 첨부용 내 파일함 (/USERS) 선택"
	onSelect={handlePersonalPicked}
/>

{#if activePreview}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 p-3 backdrop-blur-xs sm:p-6"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeImagePreview();
		}}
		role="dialog"
		aria-modal="true"
		aria-label="이미지 미리보기"
	>
		<!-- 상단 바 -->
		<div class="mb-3 flex w-full max-w-4xl items-center justify-between gap-3 text-white">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate text-sm font-bold">{activePreview.original_name || '이미지 미리보기'}</span>
				{#if previewImages.length > 1}
					<span class="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
						{previewIndex + 1} / {previewImages.length}
					</span>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<a
					href={getSecureMediaUrl(PUBLIC_SERVER_URL, activePreview)}
					download={activePreview.original_name || 'image'}
					class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
					title="다운로드"
					aria-label="이미지 다운로드"
				>
					<Icon icon="ph:download-simple-bold" class="h-4 w-4" />
				</a>
				<button
					type="button"
					onclick={closeImagePreview}
					class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
					title="닫기 (ESC)"
					aria-label="미리보기 닫기"
				>
					<Icon icon="ph:x-bold" class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- 이미지 본문 영역 -->
		<div class="relative flex w-full max-w-4xl flex-1 items-center justify-center overflow-hidden">
			{#if previewImages.length > 1}
				<button
					type="button"
					onclick={prevPreviewImage}
					class="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
					aria-label="이전 이미지"
				>
					<Icon icon="ph:caret-left-bold" class="h-5 w-5" />
				</button>
			{/if}

			<img
				src={getSecureMediaUrl(PUBLIC_SERVER_URL, activePreview, 'lg') || getSecureMediaUrl(PUBLIC_SERVER_URL, activePreview)}
				alt={activePreview.original_name || '이미지'}
				class="max-h-[82dvh] max-w-full rounded-xl object-contain shadow-2xl"
			/>

			{#if previewImages.length > 1}
				<button
					type="button"
					onclick={nextPreviewImage}
					class="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
					aria-label="다음 이미지"
				>
					<Icon icon="ph:caret-right-bold" class="h-5 w-5" />
				</button>
			{/if}
		</div>
	</div>
{/if}
