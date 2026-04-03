<script>
    /**
     * @file BoardEngine.svelte
     * @description Svelte 5 기반의 범용 게시판 엔진 (목록, 상세, 쓰기, 수정 통합)
     * @prop {string} slug  - URL 슬러그 (예: "notice", "notice/42", "notice/42/edit")
     * @prop {string} appId - 앱 인스턴스 ID
     */
    import { untrack } from "svelte";
    import { fade, fly } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import * as api from "$lib/api/board";
    import * as engines from "$lib/index";
    import { goto } from "$app/navigation";
    import TiptapEditor from "$lib/components/TiptapEditor.svelte";

    /** @type {{ slug: string, appId: string, initialData?: any }} */
    let { slug, appId, initialData = null } = $props();

    // --- [라우팅 및 모드 분석] ---
    let mode      = $state("list"); // list, view, write, edit
    let boardSlug = $state("");
    let postId    = $state(null);
    let currentPage = $state(1);
    let pageSize    = $state(10);
    let keyword     = $state("");

    // --- [데이터 상태] ---
    let posts    = $state(initialData?.posts || []);
    let board    = $state(initialData?.board || null);
    let post     = $state(initialData?.post || null);
    let bindings = $state(initialData?.bindings || []);
    let total    = $state(initialData?.total || 0);
    let isLoading  = $state(!initialData); 
    let errorMessage = $state("");

    // --- [폼 상태] ---
    let editForm = $state({
        title: "",
        content: "",
        content_json: null,
        extra_data: {},
        status: "published"
    });

    /** 경로 파싱 함수 */
    function parsePath() {
        const parts = slug.split("/").filter(p => p !== "");
        boardSlug = parts[0] || "";
        
        if (parts.length === 1) {
            mode = "list";
        } else if (parts[1] === "write") {
            mode = "write";
        } else if (parts.length >= 2) {
            postId = parts[1];
            if (parts[2] === "edit") {
                mode = "edit";
            } else {
                mode = "view";
            }
        }
    }

    // 초기 파싱
    parsePath();

    // --- [데이터 로드] ---
    async function loadData() {
        if (!boardSlug) {
            errorMessage = "잘못된 접근입니다. 게시판 주소(Slug)를 입력해 주세요.";
            isLoading = false;
            return;
        }
        isLoading = true;
        errorMessage = "";
        try {
            // [하이드레이션] 서버에서 가져온 초기 데이터가 있으면 사용
            if (initialData && (mode === 'list' ? posts.length > 0 : post)) {
                console.log("🚀 [BoardEngine] SSR Initial Data Hydrated");
                if (mode === "edit" && post) {
                    editForm = {
                        title: post.title,
                        content: post.content,
                        content_json: post.content_json,
                        extra_data: post.extra_data || {},
                        status: post.status || "published",
                    };
                }
                isLoading = false; 
                return; 
            }

            if (mode === "list") {
                const data = await api.getBoardPosts(boardSlug, currentPage, pageSize, keyword);
                posts = data.posts || [];
                board = data.board || null;
                total = data.total || 0;
            } else if (mode === "view" || mode === "edit") {
                const data = await api.getPostDetail(postId);
                post = data.post;
                board = data.board;
                bindings = data.bindings || [];
                
                if (mode === "edit" && post) {
                    editForm = {
                        title: post.title,
                        content: post.content,
                        content_json: post.content_json,
                        extra_data: post.extra_data || {},
                        status: post.status || "published",
                    };
                }
            }
        } catch (e) {
            alert("데이터 로딩 실패: " + e.message);
        } finally {
            isLoading = false;
        }
    }

    // --- [액션 핸들러] ---
    async function handleSave() {
        try {
            isLoading = true;
            if (mode === "write") {
                await api.createPost(boardSlug, editForm);
            } else if (mode === "edit") {
                await api.updatePost(postId, editForm);
            }
            goto(`/v1/app/${appId}/${boardSlug}`, { invalidateAll: true });
        } catch (e) {
            alert("저장 실패: " + e.message);
        } finally {
            isLoading = false;
        }
    }

    async function handleDelete() {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            isLoading = true;
            await api.deletePost(postId);
            window.alert("게시물이 삭제되었습니다.");
            goto(`/v1/app/${appId}/${boardSlug}`, { invalidateAll: true });
        } catch (e) {
            alert("삭제 실패: " + e.message);
        } finally {
            isLoading = false;
        }
    }

    function goToEdit() {
        goto(`/v1/app/${appId}/${boardSlug}/${postId}/edit`);
    }

    function handlePageChange(p) {
        currentPage = p;
        loadData();
    }

    function handleSearch() {
        currentPage = 1;
        loadData();
    }

    // 🔄 슬러그 변경 감지 (Svelte 5 Effect)
    let currentSlug = $state(slug);
    $effect(() => {
        if (slug !== currentSlug) {
            untrack(() => {
                currentSlug = slug;
                parsePath();
                loadData();
            });
        }
    });

    /** 날짜 포맷팅 */
    function formatDate(dateStr) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleDateString();
    }

</script>

<!-- 🎨 메인 디자인 컨테이너 -->
<div class="board-engine-container w-full min-h-screen bg-[#fafafa] font-['Outfit'] text-black p-4 md:p-8">
    
    {#if isLoading && !initialData}
        <div class="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6">
            <div class="w-16 h-16 border-8 border-black border-t-blue-600 rounded-full animate-spin"></div>
            <p class="font-black italic uppercase tracking-widest text-sm opacity-40">Synchronizing Data...</p>
        </div>
    {/if}

    {#if errorMessage}
        <div class="max-w-4xl mx-auto mb-10 p-10 border-4 border-black bg-red-50 flex items-center gap-6 animate-shake">
            <Icon icon="ph:warning-circle-bold" class="w-14 h-14 text-red-600 flex-shrink-0" />
            <div>
                <h3 class="text-2xl font-black uppercase italic">System Fault</h3>
                <p class="font-bold opacity-60">{errorMessage}</p>
            </div>
        </div>
    {/if}

    <div class="max-w-6xl mx-auto space-y-12">
        
        {#if !boardSlug}
            <div class="h-[60vh] border-8 border-black bg-white flex flex-col items-center justify-center p-20 text-center gap-8 shadow-[30px_30px_0_rgba(239,68,68,0.1)]">
                <Icon icon="ph:map-pin-line-bold" class="w-24 h-24 text-red-600 animate-bounce" />
                <div class="space-y-4">
                    <h2 class="text-6xl font-black uppercase tracking-tighter italic">Address <span class="text-red-600 NOT-ITALIC">Fault</span></h2>
                    <p class="text-lg font-bold opacity-40 max-w-md italic leading-relaxed">
                        요청하신 경로가 불완전합니다. <br/>서비스를 이용하려면 유효한 게시판 주소로 접속해 주십시오.
                    </p>
                </div>
                <a href="/v1/admin/boards" class="h-16 px-10 bg-black text-white font-black uppercase flex items-center justify-center hover:bg-blue-600 transition-all italic">
                    Open Cluster Registry
                </a>
            </div>
        {:else}
            <!-- 📑 HEADER AREA -->
        <header class="border-b-8 border-black pb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div class="space-y-4">
                <div class="flex items-center gap-4">
                    <span class="px-4 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest italic">{mode} MODE</span>
                    <span class="text-[10px] font-bold opacity-30 uppercase tracking-[0.3em]">Board Engine v2.0 / {boardSlug}</span>
                </div>
                <h1 class="text-6xl font-black tracking-tighter uppercase italic leading-[0.8] mb-2">
                    {board?.name || boardSlug || "Loading..."}
                </h1>
                <p class="text-xs font-bold opacity-40 max-w-lg leading-relaxed italic">{board?.description || '게시판 데이터를 동기화하는 중입니다.'}</p>
            </div>

            <div class="flex items-center gap-4">
                {#if mode === 'list'}
                    <div class="flex border-4 border-black h-16 group focus-within:ring-4 focus-within:ring-blue-100 transition-all">
                        <input 
                            type="text" 
                            bind:value={keyword} 
                            placeholder="SEARCH POSTS..."
                            class="bg-white border-none focus:outline-none px-6 font-black uppercase text-sm w-48 md:w-64"
                            onkeydown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button class="bg-black text-white px-6 hover:bg-blue-600 transition-all flex items-center justify-center" onclick={handleSearch}>
                            <Icon icon="ph:magnifying-glass-bold" class="w-6 h-6" />
                        </button>
                    </div>
                {/if}
                
                <div class="flex gap-4">
                    {#if mode === 'list'}
                        <a href="/v1/app/{appId}/{boardSlug}/write" class="h-16 px-10 bg-blue-600 text-white border-4 border-black font-black text-lg flex items-center justify-center hover:bg-black transition-all shadow-[8px_8px_0_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none uppercase italic">
                            New Post
                        </a>
                    {:else}
                        <a href="/v1/app/{appId}/{boardSlug}" class="h-16 px-10 bg-white text-black border-4 border-black font-black text-lg flex items-center justify-center hover:bg-slate-100 transition-all uppercase italic">
                            ← List
                        </a>
                    {/if}
                </div>
            </div>
        </header>

        <!-- 📄 MAIN CONTENT AREA -->
        <main class="animate-fade-in">
            {#if mode === 'list'}
                <div class="flex flex-col gap-6">
                    {#if posts.length === 0 && !isLoading}
                        <div class="h-80 border-4 border-black border-dashed flex flex-col items-center justify-center opacity-20 grayscale gap-4">
                            <Icon icon="ph:article-bold" class="w-20 h-20" />
                            <p class="font-black uppercase italic tracking-widest">No Posts Found in Cluster</p>
                        </div>
                    {:else}
                        <div class="grid grid-cols-1 gap-6">
                            {#each posts as p}
                                <a href="/v1/app/{appId}/{boardSlug}/{p.id}" class="group block border-4 border-black p-8 bg-white transition-all hover:bg-slate-50 hover:shadow-[12px_12px_0_rgba(37,99,235,1)] hover:-translate-x-1 hover:-translate-y-1 relative overflow-hidden">
                                    <div class="flex justify-between items-start mb-6">
                                        <div class="flex items-center gap-3">
                                            <span class="text-[10px] font-black font-mono px-2 py-1 bg-slate-100 rounded">NO.{p.id}</span>
                                            <span class="text-[10px] font-black opacity-30 uppercase tracking-widest">{formatDate(p.created_at)}</span>
                                        </div>
                                        <span class="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                            Read Article <Icon icon="ph:arrow-right-bold" />
                                        </span>
                                    </div>
                                    <h3 class="text-3xl font-black tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1 uppercase mb-3">
                                        {p.title}
                                    </h3>
                                    <p class="text-xs font-bold opacity-40 line-clamp-2 max-w-3xl leading-relaxed italic">
                                        {p.content.replace(/<[^>]*>/g, '') || '본문 내용이 없습니다.'}
                                    </p>
                                </a>
                            {/each}
                        </div>

                        <!-- 🔢 PAGINATION -->
                        {#if total > pageSize}
                            <div class="pt-12 flex justify-center items-center gap-2">
                                {#each Array(Math.ceil(total / pageSize)) as _, i}
                                    <button 
                                        class="w-14 h-14 border-4 border-black font-black text-lg transition-all {currentPage === i + 1 ? 'bg-black text-white' : 'bg-white hover:bg-slate-100'}"
                                        onclick={() => handlePageChange(i + 1)}
                                    >
                                        {i + 1}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    {/if}
                </div>
            {:else if mode === 'view' && post}
                <article class="max-w-4xl mx-auto">
                    <div class="mb-12 space-y-6">
                        <div class="flex items-center gap-4">
                             <a href="/v1/app/{appId}/{boardSlug}" class="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                                <Icon icon="ph:caret-left-bold" /> Back
                             </a>
                        </div>
                        <h1 class="text-6xl font-black tracking-tighter uppercase leading-[0.9] border-l-8 border-black pl-8 mb-6">
                            {post.title}
                        </h1>
                        <div class="flex flex-wrap items-center gap-x-8 gap-y-4 pt-4 opacity-40 font-bold text-xs italic">
                            <div class="flex items-center gap-2"><Icon icon="ph:user-bold" /> <span class="bg-black text-white px-2 py-0.5 NOT-ITALIC">AUTHOR</span> {post.author_name || 'ANONYMOUS'}</div>
                            <div class="flex items-center gap-2"><Icon icon="ph:calendar-blank-bold" /> {formatDate(post.created_at)}</div>
                            <div class="flex items-center gap-2"><Icon icon="ph:eye-bold" /> {post.view_count || 0} VIEWS</div>
                        </div>
                    </div>

                    <div class="border-4 border-black p-10 md:p-16 bg-white shadow-[20px_20px_0_rgba(0,0,0,0.05)] mb-12">
                        <div class="prose prose-xl max-w-none font-medium leading-relaxed font-['Noto_Sans_KR']">
                            {@html post.content}
                        </div>
                    </div>

                    <footer class="flex justify-between items-center bg-slate-100 p-8 border-4 border-black">
                        <div class="flex gap-4">
                            <button class="h-14 px-8 border-2 border-black font-black uppercase text-xs hover:bg-black hover:text-white transition-all flex items-center gap-2" onclick={goToEdit}>
                                <Icon icon="ph:pencil-simple-bold" /> Modify
                            </button>
                            <button class="h-14 px-8 border-2 border-red-600 text-red-600 font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all flex items-center gap-2" onclick={handleDelete}>
                                <Icon icon="ph:trash-bold" /> Destroy
                            </button>
                        </div>
                        <a href="/v1/app/{appId}/{boardSlug}" class="h-14 px-8 bg-black text-white font-black uppercase text-xs hover:bg-slate-800 transition-all flex items-center gap-2">
                             Return to Archive
                        </a>
                    </footer>

                    <!-- 💬 Dynamic Binding Area (Comments etc) -->
                    {#if bindings && bindings.length > 0}
                        <div class="mt-20 space-y-12 pb-20">
                            {#each bindings as binding}
                                {#if engines[binding.service_component]}
                                    <div class="animate-slide-up">
                                        <svelte:component 
                                            this={engines[binding.service_component]} 
                                            appId={appId}
                                            instanceId={postId}
                                            config={binding.config}
                                        />
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </article>
            {:else if (mode === 'write' || mode === 'edit')}
                <div class="max-w-5xl mx-auto">
                    <div class="border-8 border-black p-10 md:p-16 bg-white">
                        <div class="mb-12 border-b-4 border-black pb-6 flex justify-between items-baseline">
                            <h2 class="text-4xl font-black uppercase tracking-tighter italic">Cluster Entry / <span class="text-blue-600">{mode}</span></h2>
                            <span class="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">Protocol_v2.0</span>
                        </div>

                        <div class="space-y-10">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                                    <Icon icon="ph:text-t-bold" class="w-4 h-4" /> Entry Title
                                </label>
                                <input 
                                    type="text" 
                                    bind:value={editForm.title} 
                                    class="w-full h-20 border-4 border-black px-8 font-black text-3xl bg-[#fafafa] focus:bg-white focus:outline-none focus:ring-8 focus:ring-blue-100 transition-all uppercase placeholder:opacity-20" 
                                    placeholder="TYPE YOUR TITLE..." 
                                />
                            </div>

                            <div class="space-y-3">
                                <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                                    <Icon icon="ph:article-bold" class="w-4 h-4" /> Entry Content
                                </label>
                                <div class="border-4 border-black min-h-[500px]">
                                    <TiptapEditor bind:content={editForm.content} />
                                </div>
                            </div>

                            <div class="pt-10 flex flex-col md:flex-row gap-6">
                                <button 
                                    class="flex-1 h-24 bg-blue-600 text-white font-black text-2xl uppercase tracking-[0.2em] border-4 border-black hover:bg-black transition-all flex items-center justify-center gap-4 group disabled:opacity-50" 
                                    onclick={handleSave}
                                    disabled={isLoading}
                                >
                                    {#if isLoading}
                                        <span class="loading loading-spinner"></span> SYNCING...
                                    {:else}
                                        <Icon icon="ph:paper-plane-tilt-bold" class="w-8 h-8 group-hover:rotate-12 transition-transform" /> 
                                        {mode === 'write' ? 'Authorize Entry' : 'Update Record'}
                                    {/if}
                                </button>
                                <a href="/v1/app/{appId}/{boardSlug}" class="h-24 px-10 border-4 border-black font-black uppercase text-xs tracking-[0.3em] flex items-center justify-center hover:bg-slate-100 transition-all">
                                    Abort Process
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </main>
    {/if}
</div>
</div>

<style>
    :global(.prose) {
        max-width: none;
    }
    :global(.prose img) {
        border: 4px solid black;
        box-shadow: 15px 15px 0 rgba(0,0,0,0.05);
    }
</style>
