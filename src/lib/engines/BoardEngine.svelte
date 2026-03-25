<script>
    /**
     * BoardEngine.svelte
     * @description CMS 게시판 엔진 컴포넌트 (DaisyUI 스타일 적용)
     *   - list / view / write / edit 4가지 모드를 단일 컴포넌트에서 처리
     *   - slug 파라미터를 파싱하여 모드 결정 (라우팅 표준 v2.0 준수)
     * @prop {string} slug  - URL 슬러그 (예: "notice", "notice/42", "notice/42/edit")
     * @prop {string} appId - 앱 인스턴스 ID
     */
    import { onMount, untrack } from "svelte";
    import { fade, fly } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import * as api from "$lib/board.api";
    import * as engines from "$lib/index";
    import TiptapEditor from "$lib/components/TiptapEditor.svelte";
    import { browser } from "$app/environment";

    /** @type {{ slug: string, appId: string, initialData?: any }} */
    let { slug, appId, initialData = null } = $props();

    // --- [상태 관리] ---
    let mode      = $state("list"); // 'list' | 'view' | 'write' | 'edit'
    let boardSlug = $state("");
    let postId    = $state(null);

    // 🛡️ [하이드레이션 방어] 서버에서 이미 데이터가 왔다면 즉시 주입하고 로딩 완료 처리
    let posts    = $state(initialData?.posts || []);
    let board    = $state(initialData?.board || null);
    let post     = $state(initialData?.post || null);
    let bindings = $state(initialData?.bindings || []);
    let total    = $state(initialData?.total || 0);
    let isLoading  = $state(!initialData); 
    let errorMessage = $state("");

    // 작성/수정 폼 데이터
    let editForm = $state({
        title: "",
        content: "",
        content_json: null,
        extra_data: {},
        status: "published",
    });

    // 페이징 및 검색
    let currentPage = $state(0);
    let pageSize    = $state(10);
    let keyword     = $state("");

    // --- [경로 파싱] ---
    /**
     * slug를 파싱하여 boardSlug, postId, mode를 결정
     * 라우팅 규격: /Slug | /Slug/write | /Slug/postId | /Slug/postId/edit
     */
    function parsePath() {
        if (!slug) return; // ⚠️ browser 체크 제거 (서버에서도 분석 가능해야 함)

        const parts = slug.split("/");
        boardSlug = parts[0];

        if (parts.length === 1) {
            mode = "list";
        } else if (parts[1] === "write") {
            mode = "write";
        } else if (parts[1] && !isNaN(parts[1])) {
            postId = parts[1];
            mode = parts[2] === "edit" ? "edit" : "view";
        } else {
            mode = "list";
        }
    }

    // --- [데이터 로드] ---
    async function loadData() {
        // 🕵️ [하이드레이션 방어] 서버 데이터가 이미 주입되었다면 중복 로드 방지
        if (initialData && (mode === 'list' ? posts.length > 0 : post)) {
            console.log("🚀 [BoardEngine] SSR Initial Data Hydrated");
            return; 
        }

        isLoading = true;
        errorMessage = "";
        try {
            if (mode === "list") {
                const data = await api.getBoardPosts(boardSlug, currentPage, pageSize, keyword);
                posts = data.posts || [];
                board = data.board || null;
                total = data.total || 0;
            } else if (mode === "view") {
                const data = await api.getPostDetail(postId);
                post     = data.post;
                board    = data.board;
                bindings = data.bindings;
            } else if (mode === "edit") {
                const data = await api.getPostDetail(postId);
                post = data.post;
                editForm = {
                    title:        post.title,
                    content:      post.content,
                    content_json: post.content_json,
                    extra_data:   post.extra_data || {},
                    status:       post.status || "published",
                };
            }
        } catch (e) {
            console.error("[BoardEngine] 로드 실패:", e);
            errorMessage = e.message;
        } finally {
            isLoading = false;
        }
    }

    // --- [저장 핸들러] ---
    async function handleSave() {
        if (!editForm.title.trim()) return alert("제목을 입력하세요.");
        try {
            isLoading = true;
            if (mode === "write") {
                await api.createPost(boardSlug, editForm);
            } else if (mode === "edit") {
                await api.updatePost(postId, editForm);
            }
            location.href = `/v1/app/${appId}/${boardSlug}`;
        } catch (e) {
            alert("저장 실패: " + e.message);
        } finally {
            isLoading = false;
        }
    }

    // --- [삭제 핸들러] ---
    async function handleDelete() {
        if (!confirm("정말 이 게시물을 삭제하시겠습니까?")) return;
        try {
            isLoading = true;
            await api.deletePost(postId);
            alert("게시물이 삭제되었습니다.");
            location.href = `/v1/app/${appId}/${boardSlug}`;
        } catch (e) {
            alert("삭제 실패: " + e.message);
        } finally {
            isLoading = false;
        }
    }

    /** 수정 페이지로 이동 */
    function goToEdit() {
        location.href = `/v1/app/${appId}/${boardSlug}/${postId}/edit`;
    }

    /** 검색 핸들러 */
    function handleSearch(e) {
        e.preventDefault();
        currentPage = 0;
        loadData();
    }

    /** 페이지 변경 */
    function changePage(p) {
        currentPage = p;
        loadData();
    }

    // --- [반응형 로직] ---
    // 🕵️ [하이드레이션 방어] 현재 슬러그를 추적하여 변경 시에만 초기화
    let currentSlug = $state(slug);

    $effect(() => {
        // slug가 실제로 변했을 때만 실행 (초기 로드 시에는 SSR 데이터를 지우지 않음)
        if (slug !== currentSlug) {
            console.log("🔄 [BoardEngine] Slug Changed, Reloading...", slug);
            untrack(() => {
                currentSlug = slug;
                posts = []; board = null; post = null;
                isLoading = true; 
                errorMessage = "";
                parsePath();
                loadData();
            });
        }
    });

    /** 날짜 포맷 표준화 (하이드레이션 방어용) */
    function formatDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    }
</script>

<div class="engine-container" in:fade>

    <!-- ============================================================ -->
    <!-- 로딩 상태 -->
    <!-- ============================================================ -->
    {#if isLoading && (mode === "list" ? !board : !post)}
        <div class="flex flex-col items-center justify-center py-20 gap-3">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-base-content/50 text-sm">엔진 가동 중...</p>
        </div>

    <!-- ============================================================ -->
    <!-- 에러 상태 -->
    <!-- ============================================================ -->
    {:else if errorMessage}
        <div class="container mx-auto max-w-2xl py-10">
            <div class="alert alert-warning shadow-sm gap-3">
                <Icon icon="lucide:triangle-alert" class="text-2xl flex-shrink-0" />
                <div class="flex-1">
                    <h4 class="font-bold">앱 실행 오류</h4>
                    <p class="text-sm opacity-70">{errorMessage}</p>
                </div>
                <button class="btn btn-sm btn-ghost" onclick={() => history.back()}>뒤로가기</button>
            </div>
        </div>

    <!-- ============================================================ -->
    <!-- 리스트 뷰 -->
    <!-- ============================================================ -->
    {:else if mode === "list" && board}
        <div class="container mx-auto max-w-5xl px-4 py-6" in:fly={{ y: -20, duration: 500 }}>

            <!-- 헤더 -->
            <div class="flex justify-between items-end mb-6">
                <div>
                    <nav class="text-xs text-base-content/40 uppercase font-bold mb-1">
                        APP ENGINE / {board.name}
                    </nav>
                    <h1 class="text-2xl font-extrabold">{board.name}</h1>
                    <p class="text-sm text-base-content/50 mt-1">
                        {board.description || "앱 엔진으로 구동 중입니다."}
                    </p>
                </div>
                <a
                    href="/v1/app/{appId}/{boardSlug}/write"
                    class="btn btn-primary rounded-full shadow-sm gap-2">
                    <Icon icon="lucide:pencil" /> 글쓰기
                </a>
            </div>

            <!-- 검색 바 -->
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-4">
                <div class="card-body py-3 px-4">
                    <form onsubmit={handleSearch} class="flex items-center gap-3">
                        <span class="text-sm text-base-content/50">
                            Total <strong>{total}</strong>
                        </span>
                        <div class="flex-1"></div>
                        <div class="join">
                            <input
                                type="text"
                                class="input input-bordered input-sm join-item w-48"
                                placeholder="검색어 입력..."
                                bind:value={keyword}
                            />
                            <button class="btn btn-primary btn-sm join-item" type="submit">
                                <Icon icon="lucide:search" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 게시글 테이블 -->
            <div class="card bg-base-100 shadow-sm border border-base-300 overflow-hidden mb-4">
                <div class="overflow-x-auto">
                    <table class="table table-hover align-middle">
                        <thead class="bg-primary text-primary-content text-xs uppercase">
                            <tr>
                                <th class="hidden md:table-cell w-16">ID</th>
                                <th>제목</th>
                                <th class="w-28">작성자</th>
                                <th class="hidden sm:table-cell w-28 text-center">작성일</th>
                                <th class="hidden md:table-cell w-16 text-center">조회</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each posts as it (it.id)}
                                <tr
                                    class="cursor-pointer hover"
                                    onclick={() => (location.href = `/v1/app/${appId}/${boardSlug}/${it.id}`)}>
                                    <td class="hidden md:table-cell text-base-content/40 text-sm">{it.id}</td>
                                    <td>
                                        <div class="flex flex-col sm:flex-row sm:items-center gap-1">
                                            <div class="flex items-center gap-2">
                                                <!-- 안 읽은 글 표시 -->
                                                {#if !it.is_read}
                                                    <span class="badge badge-error badge-xs p-0 w-2 h-2 rounded-full"></span>
                                                {/if}
                                                <span class="font-bold">{it.title}</span>
                                                {#if it.comment_count > 0}
                                                    <span class="badge badge-primary badge-sm rounded-full">{it.comment_count}</span>
                                                {/if}
                                            </div>
                                            <!-- 모바일 날짜 -->
                                            <span class="sm:hidden text-xs text-base-content/40 flex items-center gap-1">
                                                <Icon icon="lucide:clock" class="text-xs" />
                                                {formatDate(it.create_date)} · 조회 {it.view_count}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <div class="avatar placeholder hidden sm:flex">
                                                <div class="bg-neutral text-neutral-content rounded-full w-7">
                                                    <span class="text-xs">{(it.user_name || it.user?.username || '?')[0]}</span>
                                                </div>
                                            </div>
                                            <span class="text-sm font-semibold">
                                                {it.user_name || it.user?.username || "익명"}
                                            </span>
                                        </div>
                                    </td>
                                    <td class="hidden sm:table-cell text-center text-sm text-base-content/50">
                                        {formatDate(it.create_date)}
                                    </td>
                                    <td class="hidden md:table-cell text-center text-sm text-base-content/40">
                                        {it.view_count}
                                    </td>
                                </tr>
                            {:else}
                                <tr>
                                    <td colspan="5" class="py-12 text-center text-base-content/40">
                                        게시물이 없습니다.
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 페이지네이션 -->
            {#if total > pageSize}
                <div class="flex justify-center">
                    <div class="join">
                        {#each Array(Math.ceil(total / pageSize)) as _, i}
                            <button
                                class="join-item btn btn-sm {currentPage === i ? 'btn-primary' : 'btn-ghost'}"
                                onclick={() => changePage(i)}>
                                {i + 1}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

    <!-- ============================================================ -->
    <!-- 상세 뷰 -->
    <!-- ============================================================ -->
    {:else if mode === "view" && post}
        <div class="container mx-auto max-w-4xl px-4 py-8" in:fade={{ duration: 400 }}>

            <!-- 상단 액션바 -->
            <div class="flex justify-between items-center mb-6 pb-3 border-b border-base-300">
                <div class="flex items-center gap-3">
                    <a
                        href="/v1/app/{appId}/{boardSlug}"
                        class="btn btn-sm btn-ghost rounded-full gap-1">
                        <Icon icon="lucide:arrow-left" /> 목록으로
                    </a>
                    <div class="divider divider-horizontal m-0 h-5 opacity-30"></div>
                    <nav class="hidden md:block text-xs text-base-content/40 uppercase">
                        App / {post.board?.name}
                    </nav>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-sm btn-ghost btn-circle" title="공유">
                        <Icon icon="lucide:share" />
                    </button>
                    <button class="btn btn-sm btn-ghost btn-circle" title="좋아요">
                        <Icon icon="lucide:heart" />
                    </button>
                </div>
            </div>

            <!-- 아티클 카드 -->
            <article class="card bg-base-100 shadow-xl border border-base-200 rounded-3xl overflow-hidden">

                <!-- 아티클 헤더 -->
                <header class="card-body pb-0">
                    <div class="mb-3">
                        <span class="badge badge-primary badge-lg">
                            {post.board?.name || "기본 게시판"}
                        </span>
                    </div>
                    <h1 class="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-4">
                        {post.title}
                    </h1>

                    <!-- 메타 정보 -->
                    <div class="flex flex-wrap justify-between items-center py-4 border-t border-b border-base-200 gap-4">
                        <div class="flex items-center gap-3">
                            <div class="avatar placeholder">
                                <div class="bg-primary text-primary-content rounded-full w-12">
                                    <Icon icon="lucide:user" class="text-xl" />
                                </div>
                            </div>
                            <div>
                                <div class="font-bold leading-none mb-1">
                                    {post.user?.real_name || post.user?.username || "익명 사용자"}
                                </div>
                                <div class="text-xs text-base-content/40">Post Author</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-6 text-base-content/50">
                            <div class="text-center">
                                <div class="text-xs font-bold uppercase opacity-60">DATE</div>
                                <div class="font-bold text-sm text-base-content">
                                    {new Date(post.create_date).toLocaleDateString()}
                                </div>
                            </div>
                            <div class="text-center">
                                <div class="text-xs font-bold uppercase opacity-60">VIEWS</div>
                                <div class="font-bold text-sm text-base-content">
                                    {post.view_count?.toLocaleString()} 회
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="card-body pt-6">
                    <!-- 커스텀 필드 (Extra Data) -->
                    {#if post.extra_data && Object.keys(post.extra_data).length > 0}
                        <div class="bg-primary/5 border-l-4 border-primary rounded-xl p-4 mb-6">
                            <h6 class="font-bold text-primary mb-3 flex items-center gap-2">
                                <Icon icon="lucide:info" /> Additional Information
                            </h6>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {#each Object.entries(post.extra_data) as [key, value]}
                                    <div>
                                        <div class="text-xs uppercase font-bold text-base-content/40 mb-1">{key}</div>
                                        <div class="font-bold">{value}</div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- 본문 -->
                    <div class="tiptap-content prose max-w-none">
                        {@html post.content || '<p class="text-center text-base-content/30 py-10 italic">내용이 비어 있습니다.</p>'}
                    </div>

                    <!-- 태그 -->
                    {#if post.tags && post.tags.length > 0}
                        <div class="flex flex-wrap gap-2 mt-6 pt-4 border-t border-base-200">
                            {#each post.tags as tag}
                                <span class="badge badge-outline hover:badge-primary cursor-pointer transition-colors">
                                    # {tag.name}
                                </span>
                            {/each}
                        </div>
                    {/if}

                    <!-- 하단 관리 버튼 -->
                    <div class="flex flex-wrap justify-between items-center mt-6 pt-4 border-t border-base-200 gap-2">
                        <button class="btn btn-ghost btn-sm text-base-content/40">
                            <Icon icon="lucide:flag" /> 신고
                        </button>
                        <div class="flex gap-2">
                            <button class="btn btn-neutral btn-sm rounded-full gap-2" onclick={goToEdit}>
                                <Icon icon="lucide:pencil" /> Edit Post
                            </button>
                            <button class="btn btn-error btn-outline btn-sm rounded-full gap-2" onclick={handleDelete}>
                                <Icon icon="lucide:trash-2" /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </article>

            <!-- 서비스 바인딩 영역 (댓글 등 레고 서비스) -->
            <div class="mt-8">
                {#if post && post.bindings}
                    {#each post.bindings as binding (binding.id)}
                        <div class="card bg-base-100 shadow-sm border border-base-300 mb-4">
                            <div class="card-body">
                                <!-- svelte-ignore svelte_component_deprecated -->
                                <svelte:component this={engines[binding.engine.frontend_plugin]} {post} />
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- 이전글/다음글 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div class="p-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 opacity-60">
                    <div class="text-xs font-bold text-base-content/40 mb-1">PREVIOUS POST</div>
                    <div class="font-bold text-sm">이전 글이 없습니다.</div>
                </div>
                <div class="p-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 opacity-60 text-right">
                    <div class="text-xs font-bold text-base-content/40 mb-1">NEXT POST</div>
                    <div class="font-bold text-sm">다음 글이 없습니다.</div>
                </div>
            </div>
        </div>

    <!-- ============================================================ -->
    <!-- 작성/수정 뷰 -->
    <!-- ============================================================ -->
    {:else if (mode === "write" || mode === "edit") && (mode === "write" || post)}
        <div class="container mx-auto max-w-4xl px-4 py-8" in:fade={{ duration: 400 }}>

            <!-- 헤더 -->
            <div class="flex justify-between items-center mb-6">
                <div>
                    <nav class="text-xs text-base-content/40 uppercase font-bold mb-1">
                        APP ENGINE / {mode === "write" ? "새 글 작성" : "글 수정"}
                    </nav>
                    <h2 class="text-2xl font-extrabold">
                        {mode === "write" ? "Create New Post" : "Edit Post"}
                    </h2>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-ghost btn-sm rounded-full" onclick={() => history.back()}>취소</button>
                    <button class="btn btn-primary btn-sm rounded-full gap-2 shadow-sm" onclick={handleSave}>
                        <Icon icon="lucide:check" />
                        {mode === "write" ? "등록하기" : "수정완료"}
                    </button>
                </div>
            </div>

            <!-- 작성 폼 카드 -->
            <div class="card bg-base-100 shadow-lg border border-base-200 rounded-3xl overflow-hidden">
                <div class="card-body p-6 md:p-8 gap-6">

                    <!-- 제목 입력 -->
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text text-xs font-bold uppercase text-base-content/50">Title</span>
                        </label>
                        <input
                            id="post-title-input"
                            type="text"
                            class="input input-ghost text-2xl font-bold border-0 border-b border-base-300 rounded-none px-0 focus:outline-none"
                            placeholder="제목을 입력하세요"
                            bind:value={editForm.title}
                        />
                    </div>

                    <!-- 에디터 -->
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text text-xs font-bold uppercase text-base-content/50">Content</span>
                        </label>
                        <TiptapEditor
                            bind:content={editForm.content}
                            bind:content_json={editForm.content_json}
                        />
                    </div>

                    <!-- 상태 선택 -->
                    <div class="form-control w-48">
                        <label class="label">
                            <span class="label-text text-xs font-bold uppercase text-base-content/50">Status</span>
                        </label>
                        <select
                            id="post-status-select"
                            class="select select-bordered select-sm"
                            bind:value={editForm.status}>
                            <option value="published">공개 (Published)</option>
                            <option value="draft">임시저장 (Draft)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    /* TipTap 본문 스타일 */
    .tiptap-content :global(p) {
        margin-bottom: 1.5rem;
        line-height: 1.8;
        font-size: 1.05rem;
    }
    .tiptap-content :global(h1),
    .tiptap-content :global(h2),
    .tiptap-content :global(h3) {
        font-weight: 800;
        margin-top: 2.5rem;
        margin-bottom: 1.25rem;
        letter-spacing: -0.02em;
    }
    .tiptap-content :global(img) {
        max-width: 100%;
        border-radius: 1rem;
        margin: 2rem 0;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    .tiptap-content :global(blockquote) {
        border-left: 4px solid oklch(var(--p));
        padding: 1rem 1.5rem;
        background: oklch(var(--p) / 0.05);
        border-radius: 0 0.5rem 0.5rem 0;
        font-style: italic;
        margin: 1.5rem 0;
    }
    .tiptap-content :global(pre) {
        background: oklch(var(--n));
        color: oklch(var(--nc));
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
    }
</style>
