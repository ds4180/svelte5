<script>
    /**
     * @file (app)/v1/admin/boards/+page.svelte
     * @description 게시판 인스턴스(공지, 자유 등) 통합 관리자
     */
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { fade } from "svelte/transition";

    let boards = $state([]);
    let loading = $state(true);
    let editingBoard = $state({
        id: null, slug: "", name: "", description: "", layout_type: "list", items_per_page: 10
    });

    async function loadBoards() {
        loading = true;
        try {
            boards = await api.adminGetBoards();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(loadBoards);

    function resetForm() {
        editingBoard = { id: null, slug: "", name: "", description: "", layout_type: "list", items_per_page: 10 };
    }

    async function handleSave() {
        if (!editingBoard.slug || !editingBoard.name) {
            alertState.send("슬러그와 이름은 필수입니다.", { level: 2, style: 'warning' });
            return;
        }
        try {
            if (!editingBoard.id) {
                await api.adminCreateBoard(editingBoard);
                alertState.send(`[${editingBoard.name}] 게시판이 생성되었습니다.`, { level: 1, style: 'success' });
            } else {
                await api.adminUpdateBoard(editingBoard.id, editingBoard);
                alertState.send("게시판 설정이 업데이트되었습니다.", { level: 1, style: 'success' });
            }
            resetForm();
            await loadBoards();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }

    function startEdit(b) {
        editingBoard = { ...b };
    }
</script>

<div class="space-y-10 animate-fade-in text-black font-['Noto_Sans_KR'] pb-40 max-w-7xl mx-auto px-4">
    
    <!-- 📄 헤더 -->
    <div class="border-b-4 border-black pb-8 flex justify-between items-end">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Board Cluster Registry</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">게시판 <span class="text-blue-600 NOT-ITALIC">마스터</span></h1>
            <p class="text-xs font-bold opacity-40 mt-3">공지사항, 자유게시판 등 시스템에서 가동할 실제 게시판들을 설계합니다.</p>
        </div>
        <div class="flex gap-4">
             <a href="/v1/admin" class="btn btn-outline border-black rounded-none px-8 h-14 font-black">← 대시보드</a>
             <button class="btn btn-black rounded-none px-10 h-14 font-black" onclick={loadBoards}>목록 갱신</button>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        <!-- 📑 등록된 게시판 목록 -->
        <div class="lg:col-span-5 space-y-4">
            <h3 class="text-xl font-black italic border-b-2 border-black pb-2 mb-6">활성 게시판 목록</h3>
            
            {#if loading}
                <div class="h-60 border border-black border-dashed flex items-center justify-center grayscale opacity-10 font-black italic uppercase">엔진 스캔 중...</div>
            {:else}
                <div class="grid grid-cols-1 gap-4">
                    {#each boards as b}
                        <button class="border-2 border-black p-6 bg-white text-left transition-all hover:bg-slate-50 flex justify-between items-center group {editingBoard.id === b.id ? 'border-blue-600 ring-2 ring-blue-600' : ''}" onclick={() => startEdit(b)}>
                            <div>
                                <div class="text-[9px] font-black opacity-30 uppercase tracking-widest mb-1 italic">/{b.slug}</div>
                                <h4 class="text-xl font-black tracking-tight">{b.name}</h4>
                                <p class="text-[10px] font-bold opacity-40 mt-1">{b.description || '설명이 없습니다.'}</p>
                            </div>
                            <span class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 font-black">EDIT →</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- 📝 생성/수정 폼 -->
        <div class="lg:col-span-7">
            <div class="border-2 border-black p-10 bg-white shadow-[15px_15px_0_rgba(0,0,0,0.05)] sticky top-24">
                <div class="mb-10 border-b-2 border-black pb-4 flex justify-between items-baseline">
                    <h3 class="text-3xl font-black italic">{editingBoard.id ? '게시판 엔진 수정' : '새 게시판 엔진 개발'}</h3>
                    <span class="text-[9px] font-black opacity-40 uppercase italic tracking-widest">Type: Board_v1.2</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase tracking-widest opacity-30">게시판 주소 (Slug / ID)</label>
                        <input type="text" bind:value={editingBoard.slug} class="w-full h-14 border border-black px-5 font-black text-blue-600 bg-slate-50 focus:bg-white focus:outline-none transition-all" placeholder="예: notice, free, gallery" />
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase tracking-widest opacity-30">게시판 이름</label>
                        <input type="text" bind:value={editingBoard.name} class="w-full h-14 border border-black px-5 font-black bg-slate-50 focus:bg-white focus:outline-none transition-all" placeholder="예: 공지사항" />
                    </div>
                </div>

                <div class="space-y-8">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase tracking-widest opacity-30">게시판 설명</label>
                        <input type="text" bind:value={editingBoard.description} class="w-full h-14 border border-black px-5 font-bold bg-white focus:outline-none transition-all" placeholder="사용자에게 보여줄 짧은 설명" />
                    </div>

                    <div class="grid grid-cols-2 gap-8">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black uppercase tracking-widest opacity-30">레이아웃 스타일</label>
                            <select bind:value={editingBoard.layout_type} class="w-full h-14 border border-black px-4 font-black bg-slate-50 text-sm">
                                <option value="list">리스트형 (표준)</option>
                                <option value="gallery">갤러리형 (이미지 위주)</option>
                                <option value="blog">블로그형 (본문 요약)</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black uppercase tracking-widest opacity-30">페이지당 게시물 수</label>
                            <input type="number" bind:value={editingBoard.items_per_page} class="w-full h-14 border border-black px-5 font-black bg-white" />
                        </div>
                    </div>

                    <div class="pt-8 flex gap-4">
                        <button class="flex-1 h-20 bg-black text-white font-black text-xl uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all" onclick={handleSave}>
                            {editingBoard.id ? '게시판 설정 저장' : '게시판 신규 생성'}
                        </button>
                        <button class="w-24 h-20 border-2 border-black font-black uppercase text-[10px] hover:bg-slate-100 transition-all" onclick={resetForm}>초기화</button>
                    </div>

                    <div class="mt-6 p-4 bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-600 leading-relaxed italic">
                        * 게시판을 생성한 후 [메뉴 마스터]로 이동하여 이 게시판을 하위 메뉴로 등록하면 최종 노출됩니다.
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
