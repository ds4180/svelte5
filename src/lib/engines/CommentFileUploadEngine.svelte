<script>
	/**
	 * CommentEngine.svelte
	 * @description 댓글 엔진 컴포넌트. BoardEngine의 서비스 바인딩으로 마운트됨. (DaisyUI 스타일 적용)
	 * @prop {{ id: number }} post - 부모 게시물 객체 (id 필수)
	 */
	import * as commentApi from '$lib/api/comment';
	import {
		uploadCommentTempFiles,
		mergePickedPersonalAssets,
		cleanupTempAssets,
		submitNewComment,
		submitEditedComment,
		countTotalComments,
		getCommentDisplayName,
		buildReplyTarget,
		submitReplyComment
	} from '$lib/services/commentService';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { env } from '$env/dynamic/public';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDateTime } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import PersonalMediaPickerModal from '$lib/components/PersonalMediaPickerModal.svelte';
	import ImageZoomLightbox from '$lib/components/ImageZoomLightbox.svelte';
	import ServiceLockNotice from '$lib/components/ServiceLockNotice.svelte';
	import { resolveServicePermission } from '$lib/utils/servicePermission';
	import Icon from '@iconify/svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

	// --- [Svelte 5 Props] ---
	let { post, config = {}, accessLevel = 'PUBLIC', boardSlug = '', permissions = null } = $props();
	const perm = $derived(resolveServicePermission(permissions, auth.user));

	const targetTier = $derived(
		(accessLevel || 'PUBLIC').toUpperCase() === 'PROTECTED' ? 'PROTECTED' : 'PUBLIC'
	);
	const commentSubPath = $derived(
		boardSlug ? `BOARDS/${boardSlug}/COMMENTS/${post?.id}` : `COMMENTS/${post?.id}`
	);

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
	let replyTo = $state(/** @type {{ rootId: number; targetName: string } | null} */ (null));
	let replyContent = $state('');
	let replySubmitting = $state(false);
	const totalCommentCount = $derived(countTotalComments(comments));

	// --- [이미지 미리보기 모달 상태 (PWA 친화적)] ---
	let previewImages = $state(/** @type {any[]} */ ([]));
	let previewIndex = $state(-1);
	const lightboxImages = $derived(
		previewImages.map((a) => {
			const original = getSecureMediaUrl(PUBLIC_SERVER_URL, a);
			const lg = getSecureMediaUrl(PUBLIC_SERVER_URL, a, 'lg');
			return {
				src: a.meta_info?.has_original === false ? lg || original : original || lg,
				alt: a.original_name || '이미지',
				downloadUrl: original || lg,
				downloadName: a.original_name || 'image'
			};
		})
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
	 * 1단계: 댓글 작성/수정 전 본인 계정(PRIVATE) 보관함으로 파일 임시 업로드
	 * @param {Event} event
	 * @param {'create' | 'edit'} [targetMode='create']
	 */
	async function handleFileUpload(event, targetMode = 'create') {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const files = input?.files ? Array.from(input.files) : [];
		if (files.length === 0) return;

		if (targetMode === 'edit') uploadingEdit = true;
		else uploading = true;
		try {
			const uploaded = await uploadCommentTempFiles(files, auth.user?.id);
			if (targetMode === 'edit') editPendingAssets = [...editPendingAssets, ...uploaded];
			else pendingAssets = [...pendingAssets, ...uploaded];
			toast.success(`${uploaded.length}개 파일이 개인 보관함에 임시 업로드되었습니다.`);
		} catch (e) {
			toast.error('파일 업로드 실패: ' + formatApiError(e, '업로드 오류'));
		} finally {
			if (targetMode === 'edit') uploadingEdit = false;
			else uploading = false;
			if (input) input.value = '';
		}
	}

	/** @param {Event} event */
	const handleFileSelect = (event) => handleFileUpload(event, 'create');

	/** @param {Event} event */
	const handleEditFileSelect = (event) => handleFileUpload(event, 'edit');

	/** @param {number} assetId */
	async function removePendingAsset(assetId) {
		const target = pendingAssets.find((a) => a.id === assetId);
		pendingAssets = pendingAssets.filter((a) => a.id !== assetId);
		if (target) await cleanupTempAssets([target]);
	}

	/** @param {any[]} pickedAssets */
	function handlePersonalPicked(pickedAssets) {
		const current = pickerMode === 'edit' ? editPendingAssets : pendingAssets;
		const { nextAssets, addedCount } = mergePickedPersonalAssets(current, pickedAssets);
		if (addedCount === 0) return;
		if (pickerMode === 'edit') editPendingAssets = nextAssets;
		else pendingAssets = nextAssets;
		toast.success(`내 파일함에서 ${addedCount}개 파일을 선택했습니다.`);
	}

	// --- [댓글 등록 핸들러: 2단계 물리 복사 배포 및 댓글 연결] ---
	/** @param {Event} event */
	async function handleCommentSubmit(event) {
		event.preventDefault();
		if (submitting || uploading) return;
		if (!newComment.trim() && pendingAssets.length === 0) return;

		submitting = true;
		try {
			await submitNewComment({
				postId: post.id,
				content: newComment,
				pendingAssets,
				targetTier,
				commentSubPath
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
		if (!auth.user || !perm.can_write) return false;
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
			await cleanupTempAssets(assetsToClean);
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
		if (target) await cleanupTempAssets([target]);
	}

	/** @param {number} commentId */
	async function saveEdit(commentId) {
		if (savingEdit || uploadingEdit) return;
		if (!editContent.trim() && editAttachments.length === 0 && editPendingAssets.length === 0)
			return;

		savingEdit = true;
		try {
			await submitEditedComment({
				commentId,
				content: editContent,
				editPendingAssets,
				removeMediaIds,
				targetTier,
				commentSubPath
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

	/**
	 * @param {any} rootComment
	 * @param {any} [targetComment=null]
	 */
	function startReply(rootComment, targetComment = null) {
		const info = buildReplyTarget(rootComment, targetComment);
		replyTo = { rootId: info.rootId, targetName: info.targetName };
		replyContent = info.initialContent;
	}

	function cancelReply() {
		replyTo = null;
		replyContent = '';
	}

	/** @param {Event} [event] */
	async function handleReplySubmit(event) {
		if (event) event.preventDefault();
		if (!replyTo || replySubmitting || !replyContent.trim()) return;
		replySubmitting = true;
		try {
			await submitReplyComment({
				postId: post.id,
				parentId: replyTo.rootId,
				content: replyContent
			});
			cancelReply();
			await loadComments();
		} catch (e) {
			toast.error('답글 작성 실패: ' + formatApiError(e, '오류'));
		} finally {
			replySubmitting = false;
		}
	}

	/**
	 * @param {KeyboardEvent} e
	 * @param {() => void} onSubmit
	 */
	function handleCtrlEnter(e, onSubmit) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			onSubmit();
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
		<span class="badge badge-sm badge-neutral">{totalCommentCount}</span>
	</h4>

	<!-- 댓글 작성 폼 (권한 부족 시 잠금 안내 표시) -->
	{#if perm.can_write}
		<div class="card mb-5 border border-base-300 bg-base-200">
			<div class="card-body p-4">
				<form onsubmit={handleCommentSubmit}>
					<textarea
						class="textarea-bordered textarea w-full resize-none"
						rows="3"
						bind:value={newComment}
						onkeydown={(e) => handleCtrlEnter(e, () => handleCommentSubmit(e))}
						placeholder="댓글을 입력하세요... (Ctrl+Enter 등록)"
					></textarea>

					{#if pendingAssets.length > 0}
						<div class="mt-2.5 flex flex-wrap gap-2">
							{#each pendingAssets as asset (asset.id)}
								<div
									class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-xs"
								>
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
									<span class="max-w-[160px] truncate font-medium text-slate-700"
										>{asset.original_name}</span
									>
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
									class="btn border border-slate-300 btn-ghost text-xs font-bold btn-sm"
								>
									<Icon
										icon={uploading ? 'ph:spinner-gap-bold' : 'ph:paperclip-bold'}
										class="mr-1 {uploading ? 'animate-spin' : ''}"
									/>
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
										class="btn border border-indigo-200 bg-indigo-50/70 btn-ghost text-xs font-bold text-indigo-700 btn-sm hover:bg-indigo-100"
									>
										<Icon icon="ph:folder-user-bold" class="mr-1" />
										내 파일함(/USERS)
									</button>
								{/if}
							</div>
						{:else}
							<div></div>
						{/if}
						<button type="submit" disabled={submitting || uploading} class="btn btn-primary btn-sm">
							<Icon
								icon={submitting ? 'ph:spinner-gap-bold' : 'lucide:send'}
								class="mr-1 {submitting ? 'animate-spin' : ''}"
							/>
							{submitting ? '등록 중...' : '댓글 등록'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{:else}
		<div class="mb-5">
			<ServiceLockNotice permission={perm} serviceLabel="댓글" />
		</div>
	{/if}

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
								<span class="text-sm font-bold">{getCommentDisplayName(comment)}</span>
								<span class="text-xs text-base-content/40">
									{formatDateTime(comment.create_date)}
								</span>
							</div>
							<div class="flex items-center gap-2 text-xs">
								{#if perm.can_write && editingId !== comment.id}
									<button
										type="button"
										onclick={() => startReply(comment)}
										class="font-bold text-slate-500 hover:text-blue-600 hover:underline"
									>
										답글
									</button>
								{/if}
								{#if canModify(comment) && editingId !== comment.id}
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
								{/if}
							</div>
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
											<div
												class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-xs"
											>
												{#if att.mime_type?.startsWith('image/')}
													<img
														src={getSecureMediaUrl(PUBLIC_SERVER_URL, att, 'sm')}
														alt={att.original_name}
														class="h-7 w-7 rounded-md object-cover"
													/>
												{:else}
													<Icon icon="ph:file-bold" class="h-4 w-4 text-slate-500" />
												{/if}
												<span class="max-w-[140px] truncate font-medium text-slate-700"
													>{att.original_name}</span
												>
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
											<div
												class="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs shadow-xs"
											>
												{#if asset.mime_type?.startsWith('image/')}
													<img
														src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')}
														alt={asset.original_name}
														class="h-7 w-7 rounded-md object-cover"
													/>
												{:else}
													<Icon icon="ph:file-bold" class="h-4 w-4 text-blue-500" />
												{/if}
												<span class="max-w-[140px] truncate font-medium text-blue-700"
													>{asset.original_name}</span
												>
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
												class="btn border border-slate-300 btn-ghost font-bold btn-xs"
											>
												<Icon
													icon={uploadingEdit ? 'ph:spinner-gap-bold' : 'ph:paperclip-bold'}
													class="mr-1 {uploadingEdit ? 'animate-spin' : ''}"
												/>
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
													class="btn border border-indigo-200 bg-indigo-50/70 btn-ghost font-bold text-indigo-700 btn-xs hover:bg-indigo-100"
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
										<button type="button" onclick={() => cancelEdit()} class="btn btn-ghost btn-xs"
											>취소</button
										>
										<button
											type="button"
											disabled={savingEdit || uploadingEdit}
											onclick={() => saveEdit(comment.id)}
											class="btn btn-primary btn-xs"
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

						<!-- 2단 대댓글 목록 (파일 첨부 없음) -->
						{#if comment.sub_comments && comment.sub_comments.length > 0}
							<div class="mt-3 space-y-2.5 border-l-2 border-slate-200 pl-3 sm:pl-4">
								{#each comment.sub_comments as reply (reply.id)}
									<div class="flex gap-2.5">
										<div class="placeholder avatar shrink-0">
											<div class="h-8 w-8 rounded-full bg-slate-200 text-slate-700">
												<span class="text-xs font-bold"
													>{getCommentDisplayName(reply)[0].toUpperCase()}</span
												>
											</div>
										</div>
										<div class="min-w-0 flex-1">
											<div class="mb-1 flex items-center justify-between gap-2">
												<div class="flex items-center gap-2">
													<span class="text-xs font-bold">{getCommentDisplayName(reply)}</span>
													<span class="text-[11px] text-base-content/40">
														{formatDateTime(reply.create_date)}
													</span>
												</div>
												<div class="flex items-center gap-2 text-[11px]">
													{#if perm.can_write && editingId !== reply.id}
														<button
															type="button"
															onclick={() => startReply(comment, reply)}
															class="font-bold text-slate-500 hover:text-blue-600 hover:underline"
														>
															답글
														</button>
													{/if}
													{#if canModify(reply) && editingId !== reply.id}
														<button
															type="button"
															onclick={() => startEdit(reply)}
															class="font-bold text-blue-600 hover:underline"
														>
															수정
														</button>
														<button
															type="button"
															onclick={() => handleDelete(reply.id)}
															class="font-bold text-rose-500 hover:underline"
														>
															삭제
														</button>
													{/if}
												</div>
											</div>
											{#if editingId === reply.id}
												<div class="space-y-2 rounded-lg border border-slate-200 bg-base-200 p-2.5">
													<textarea
														rows="2"
														bind:value={editContent}
														class="textarea-bordered textarea w-full resize-none text-xs"
													></textarea>
													<div class="flex justify-end gap-1.5">
														<button
															type="button"
															onclick={() => cancelEdit()}
															class="btn btn-ghost btn-xs">취소</button
														>
														<button
															type="button"
															disabled={savingEdit}
															onclick={() => saveEdit(reply.id)}
															class="btn btn-primary btn-xs"
														>
															{savingEdit ? '저장 중...' : '저장'}
														</button>
													</div>
												</div>
											{:else}
												<p
													class="rounded-lg bg-slate-100 p-2.5 text-xs whitespace-pre-wrap text-slate-700"
												>
													{reply.content}
												</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- 2단 인라인 답글 입력 폼 -->
						{#if perm.can_write && replyTo?.rootId === comment.id}
							<form
								onsubmit={handleReplySubmit}
								class="mt-3 space-y-2 rounded-xl border border-blue-200 bg-blue-50/40 p-3"
							>
								<div class="flex items-center justify-between text-[11px] font-bold text-blue-700">
									<span>↳ {replyTo?.targetName}님에게 답글 작성</span>
									<button
										type="button"
										onclick={cancelReply}
										class="text-slate-400 hover:text-slate-700">취소</button
									>
								</div>
								<textarea
									rows="2"
									bind:value={replyContent}
									onkeydown={(e) => handleCtrlEnter(e, () => handleReplySubmit())}
									placeholder="답글을 입력하세요... (Ctrl+Enter 등록)"
									class="textarea-bordered textarea w-full resize-none bg-white text-xs"
								></textarea>
								<div class="flex justify-end gap-1.5">
									<button type="button" onclick={cancelReply} class="btn btn-ghost btn-xs"
										>취소</button
									>
									<button
										type="submit"
										disabled={replySubmitting || !replyContent.trim()}
										class="btn btn-primary btn-xs"
									>
										{replySubmitting ? '등록 중...' : '답글 등록'}
									</button>
								</div>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<PersonalMediaPickerModal
	bind:open={showPersonalPicker}
	multiple={true}
	title="댓글 첨부용 내 파일함 (/USERS) 선택"
	onSelect={handlePersonalPicked}
/>

<ImageZoomLightbox
	images={lightboxImages}
	bind:index={previewIndex}
	ariaLabel="댓글 이미지 상세 보기"
/>
