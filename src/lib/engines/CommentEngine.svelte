<script>
	/**
	 * CommentEngine.svelte
	 * @description 댓글 엔진 컴포넌트. BoardEngine의 서비스 바인딩으로 마운트됨. (DaisyUI 스타일 적용)
	 * @prop {{ id: number }} post - 부모 게시물 객체 (id 필수)
	 */
	import * as commentApi from '$lib/api/comment';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDateTime } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import ServiceLockNotice from '$lib/components/ServiceLockNotice.svelte';
	import { resolveServicePermission } from '$lib/utils/servicePermission';
	import {
		countTotalComments,
		getCommentDisplayName,
		buildReplyTarget,
		submitReplyComment
	} from '$lib/services/commentService';
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();

	// --- [Svelte 5 Props] ---
	let { post, config: _config = {}, permissions = null } = $props();
	const perm = $derived(resolveServicePermission(permissions, auth.user));

	// --- [상태 관리] ---
	let comments = $state(/** @type {any[]} */ ([]));
	let newComment = $state('');
	let loading = $state(true);
	let submitting = $state(false);
	let editingId = $state(/** @type {number | null} */ (null));
	let editContent = $state('');
	let savingEdit = $state(false);
	let replyTo = $state(/** @type {{ rootId: number; targetName: string } | null} */ (null));
	let replyContent = $state('');
	let replySubmitting = $state(false);
	const totalCommentCount = $derived(countTotalComments(comments));

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

	/** @param {Event} [event] */
	async function handleCommentSubmit(event) {
		if (event) event.preventDefault();
		if (submitting || !newComment.trim()) return;
		submitting = true;
		try {
			await commentApi.createComment(post.id, { content: newComment.trim() });
			newComment = ''; // 입력창 초기화
			await loadComments(); // 댓글 목록 새로고침
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
	}

	function cancelEdit() {
		editingId = null;
		editContent = '';
	}

	/** @param {number} commentId */
	async function saveEdit(commentId) {
		if (!editContent.trim() || savingEdit) return;
		savingEdit = true;
		try {
			await commentApi.updateComment(commentId, { content: editContent.trim() });
			toast.success('댓글이 수정되었습니다.');
			cancelEdit();
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
						onkeydown={(e) => handleCtrlEnter(e, () => handleCommentSubmit())}
						placeholder="댓글을 입력하세요... (Ctrl+Enter 등록)"
					></textarea>
					<div class="mt-2 flex justify-end">
						<button type="submit" disabled={submitting} class="btn btn-primary btn-sm">
							<Icon icon="lucide:send" class="mr-1" />
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
							<div class="space-y-2 rounded-lg border border-slate-200 bg-base-200 p-3">
								<textarea
									rows="3"
									bind:value={editContent}
									class="textarea-bordered textarea w-full resize-none text-sm"
								></textarea>
								<div class="flex justify-end gap-1.5">
									<button type="button" onclick={cancelEdit} class="btn btn-ghost btn-xs"
										>취소</button
									>
									<button
										type="button"
										disabled={savingEdit}
										onclick={() => saveEdit(comment.id)}
										class="btn btn-primary btn-xs"
									>
										{savingEdit ? '저장 중...' : '저장'}
									</button>
								</div>
							</div>
						{:else}
							<p class="rounded-lg bg-base-200 p-3 text-sm text-base-content/80">
								{comment.content}
							</p>
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
														<button type="button" onclick={cancelEdit} class="btn btn-ghost btn-xs"
															>취소</button
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
