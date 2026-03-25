<script>
    /**
     * CommentEngine.svelte
     * @description 댓글 엔진 컴포넌트. BoardEngine의 서비스 바인딩으로 마운트됨. (DaisyUI 스타일 적용)
     * @prop {{ id: number }} post - 부모 게시물 객체 (id 필수)
     */
    import { onMount } from 'svelte';
    import * as commentApi from '$lib/api/comment.api';
    import Icon from '@iconify/svelte';

    // --- [Svelte 5 Props] ---
    let { post } = $props();

    // --- [상태 관리] ---
    let comments   = $state([]);
    let newComment = $state('');
    let loading    = $state(true);

    // --- [데이터 로드] ---
    async function loadComments() {
        loading = true;
        try {
            comments = await commentApi.getComments(post.id);
        } catch (e) {
            console.error("[CommentEngine] 댓글 로딩 실패:", e);
        } finally {
            loading = false;
        }
    }

    // --- [댓글 등록 핸들러] ---
    async function handleCommentSubmit(event) {
        event.preventDefault();
        if (!newComment.trim()) return;
        try {
            await commentApi.createComment(post.id, { content: newComment });
            newComment = '';   // 입력창 초기화
            await loadComments(); // 댓글 목록 새로고침
        } catch (e) {
            alert("댓글 작성 실패: " + e.message);
        }
    }

    onMount(loadComments);
</script>

<!-- ================================================================== -->
<!-- 댓글 엔진 (DaisyUI 스타일) -->
<!-- ================================================================== -->
<div class="comment-engine mt-4">
    <h4 class="text-lg font-bold mb-4 flex items-center gap-2">
        <Icon icon="lucide:message-circle" class="text-primary" />
        댓글
        <span class="badge badge-neutral badge-sm">{comments.length}</span>
    </h4>

    <!-- 댓글 작성 폼 -->
    <div class="card bg-base-200 border border-base-300 mb-5">
        <div class="card-body p-4">
            <form onsubmit={handleCommentSubmit}>
                <textarea
                    class="textarea textarea-bordered w-full resize-none"
                    rows="3"
                    bind:value={newComment}
                    placeholder="댓글을 입력하세요..."
                ></textarea>
                <div class="flex justify-end mt-2">
                    <button type="submit" class="btn btn-primary btn-sm">
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
                <span class="loading loading-dots loading-md text-primary"></span>
            </div>
        {:else if comments.length === 0}
            <!-- 빈 상태 -->
            <div class="text-center py-8 text-base-content/50">
                <Icon icon="lucide:message-square-dashed" class="text-4xl mx-auto mb-2" />
                <p class="text-sm">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
            </div>
        {:else}
            <!-- 댓글 목록 -->
            {#each comments as comment (comment.id)}
                <div class="flex gap-3">
                    <!-- 아바타 -->
                    <div class="avatar placeholder flex-shrink-0">
                        <div class="bg-neutral text-neutral-content rounded-full w-10 h-10">
                            <span class="text-sm">{(comment.user?.username || '?')[0].toUpperCase()}</span>
                        </div>
                    </div>
                    <!-- 내용 -->
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-bold text-sm">{comment.user?.username || '익명'}</span>
                            <span class="text-xs text-base-content/40">
                                {new Date(comment.create_date).toLocaleString()}
                            </span>
                        </div>
                        <p class="text-sm text-base-content/80 bg-base-200 rounded-lg p-3">
                            {comment.content}
                        </p>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>
