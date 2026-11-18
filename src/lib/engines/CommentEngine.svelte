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
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();

	// --- [Svelte 5 Props] ---
	let { post } = $props();

	// --- [상태 관리] ---
	let comments = $state(/** @type {any[]} */ ([]));
	let newComment = $state('');
	let loading = $state(true);
	let editingId = $state(/** @type {number | null} */ (null));
	let editContent = $state('');
	let savingEdit = $state(false);

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

	/** @param {Event} event */
	async function handleCommentSubmit(event) {
		event.preventDefault();
		if (!newComment.trim()) return;
		try {
			await commentApi.createComment(post.id, { content: newComment });
			newComment = ''; // 입력창 초기화
			await loadComments(); // 댓글 목록 새로고침
		} catch (e) {
			toast.error('댓글 작성 실패: ' + formatApiError(e, '오류'));
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
				<div class="mt-2 flex justify-end">
					<button type="submit" class="btn btn-sm btn-primary">
						<Icon icon="lucide:send" class="mr-1" />
						댓글 등록
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
							<div class="space-y-2 rounded-lg border border-slate-200 bg-base-200 p-3">
								<textarea
									rows="3"
									bind:value={editContent}
									class="textarea-bordered textarea w-full resize-none text-sm"
								></textarea>
								<div class="flex justify-end gap-1.5">
									<button type="button" onclick={cancelEdit} class="btn btn-xs btn-ghost">취소</button>
									<button
										type="button"
										disabled={savingEdit}
										onclick={() => saveEdit(comment.id)}
										class="btn btn-xs btn-primary"
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
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
