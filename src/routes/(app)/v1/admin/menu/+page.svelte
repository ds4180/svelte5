<script>
    console.log('Menu page script initiated!'); // 추가된 로그

    /**
     * @file (app)/v1/admin/menu/+page.svelte
     * @description 시스템 메뉴 아키텍처 실시간 편집기 (한글화 세션)
     */
    import { onMount, untrack } from "svelte";
    import { fade, fly } from "svelte/transition";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { browser } from '$app/environment'; // browser import 추가


    let menus = $state([]);
    let apps = $state([]);
    let boards = $state([]);
    let loading = $state(true);

    let editingMenu = $state({
        id: "", parent_id: "", title: "", icon_name: "🚀", 
        link_type: "URL", external_url: "", app_id: "", 
        app_instance_id: "", order: 0, is_visible: true, min_rank: 0
    });

    // 🔗 [계단식 프리뷰] 부모의 경로를 추적하여 최종 합산 주소 계산
    function getRecursiveUrl(menu) {
        if (!menu) return "";
        if (menu.link_type === 'FOLDER') return "#"; // 그룹(폴더)은 링크가 없음
        let currentPath = "";

        if (menu.link_type === 'URL') currentPath = menu.external_url || "";
        else if (menu.link_type === 'APP' && menu.app_id) {
            const app = apps.find(a => a.app_id === menu.app_id);
            if (app) {
                currentPath = app.frontend_route || "";
                if (menu.app_id === 'board' && menu.app_instance_id) {
                    const board = boards.find(b => b.id === Number(menu.app_instance_id));
                    if (board) currentPath = currentPath.replace('[slug]', board.slug);
                }
                currentPath = currentPath.replace(/\/\[.*?\]/, '');
            }
        }

        // 부모가 있다면 부모의 주소를 먼저 가져와서 합칩니다.
        if (menu.parent_id) {
            // 전체 메뉴 목록에서 부모를 찾음 (중첩 트리 구조 고려)
            const findParent = (list, pid) => {
                for (let m of list) {
                    if (m.id === pid) return m;
                    if (m.sub_menus) {
                        const found = findParent(m.sub_menus, pid);
                        if (found) return found;
                    }
                }
                return null;
            };
            const parent = findParent(menus, menu.parent_id);
            if (parent) {
                const parentUrl = getRecursiveUrl(parent);
                // 주소 합치기 (슬래시 중복 방지)
                return (parentUrl.endsWith('/') ? parentUrl.slice(0, -1) : parentUrl) + 
                       (currentPath.startsWith('/') ? currentPath : '/' + currentPath);
            }
        }
        return currentPath;
    }

    let predictedUrl = $derived(getRecursiveUrl(editingMenu) || '(타입 선택 필요)');

    async function loadData() {
        console.log('loadData called, attempting API calls...');
        loading = true;
        try {
            const [m, a, b] = await Promise.all([
                api.adminGetMenus(),
                api.adminGetApps(),
                api.adminGetBoards()
            ]);
            menus = m;
            apps = a;
            boards = b;
            } catch (e) {
            let errorMessage = "알 수 없는 오류가 발생했습니다.";
            if (typeof e === 'object' && e !== null) {
                if (Array.isArray(e.detail) && e.detail.every(item => typeof item === 'object' && item.msg)) {
                    errorMessage = "유효성 검사 오류: " + e.detail.map(item => item.msg).join('; ');
                } else if (typeof e.detail === 'string') {
                    errorMessage = e.detail;
                } else if (e.message) { // Standard Error object
                    errorMessage = e.message;
                }
            } else { // Fallback for non-object errors
                errorMessage = String(e);
            }
            alertState.send(errorMessage, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        if (browser) { // 브라우저 환경에서만 실행되도록 보호 (하이드레이션 문제 방지)
            console.log('Menu page onMount is running!');
            loadData();
        }
    });

    function startEdit(m) {
        editingMenu = { ...m, 
            parent_id: m.parent_id || "", 
            app_id: m.app_id || "", 
            app_instance_id: m.app_instance_id || ""
        };
        document.getElementById("form-anchor")?.scrollIntoView({ behavior: 'smooth' });
    }

    function addSub(parentId) {
        resetForm();
        editingMenu.parent_id = parentId;
        document.getElementById("form-anchor")?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingMenu = { id: "", parent_id: "", title: "", icon_name: "🚀", link_type: "URL", external_url: "", app_id: "", app_instance_id: "", order: 0, is_visible: true, min_rank: 0 };
    }

    async function handleSave() {
        console.log('handleSave called!');
        try {
            const data = { ...editingMenu };
            for (const key in data) {
                if (data[key] === "") {
                    data[key] = null;
                }
            }
            console.log('handleSave - Data prepared:', $state.snapshot(data)); // Log 1
            if (!data.id) {
                delete data.id;
                console.log('handleSave - Calling adminCreateMenu with:', $state.snapshot(data)); // Log 2
                await api.adminCreateMenu(data);
                console.log('handleSave - adminCreateMenu succeeded!'); // Log 3
                alertState.send("새 메뉴가 등록되었습니다.", { level: 1, style: 'success' });
            } else {
                console.log('handleSave - Calling adminUpdateMenu with:', data.id, $state.snapshot(data)); // Log 4
                await api.adminUpdateMenu(data.id, data);
                console.log('handleSave - adminUpdateMenu succeeded!'); // Log 5
                alertState.send("메뉴 정보가 업데이트되었습니다.", { level: 1, style: 'success' });
            }
            resetForm();
            console.log('handleSave - Form reset, calling loadData...'); // Log 6
            await loadData();
            console.log('handleSave - loadData completed!'); // Log 7
        } catch (e) {
            console.error('handleSave - Error caught:', e); // Log 8
            let errorMessage = "알 수 없는 오류가 발생했습니다.";
            if (typeof e === 'object' && e !== null) {
                if (Array.isArray(e.detail) && e.detail.every(item => typeof item === 'object' && item.msg)) {
                    errorMessage = "유효성 검사 오류: " + e.detail.map(item => item.msg).join('; ');
                } else if (typeof e.detail === 'string') {
                    errorMessage = e.detail;
                } else if (e.message) { // Standard Error object
                    errorMessage = e.message;
                }
            } else { // Fallback for non-object errors
                errorMessage = String(e);
            }
            alertState.send(errorMessage, { level: 3, style: 'error' });
        }
    }

    async function handleDelete(menuId) {
        if (!confirm("정말로 이 메뉴를 삭제하시겠습니까? 관련 하위 메뉴도 모두 삭제됩니다.")) {
            return;
        }
        try {
            await api.adminDeleteMenu(menuId);
            alertState.send("메뉴가 성공적으로 삭제되었습니다.", { level: 1, style: 'success' });
            await loadData(); // 메뉴 목록 새로고침
        } catch (e) {
            console.error('handleDelete - Error caught:', e);
            let errorMessage = "메뉴 삭제 중 오류가 발생했습니다.";
            if (typeof e === 'object' && e !== null && e.detail) {
                if (Array.isArray(e.detail) && e.detail.every(item => typeof item === 'object' && item.msg)) {
                    errorMessage = "유효성 검사 오류: " + e.detail.map(item => item.msg).join('; ');
                } else if (typeof e.detail === 'string') {
                    errorMessage = e.detail;
                } else if (e.message) { // Standard Error object
                    errorMessage = e.message;
                }
            } else { // Fallback for non-object errors
                errorMessage = String(e);
            }
            alertState.send(errorMessage, { level: 3, style: 'error' });
        }
    }
</script>
<div class="space-y-10 animate-fade-in text-black font-['Noto_Sans_KR','Outfit'] pb-40 px-4 max-w-7xl mx-auto">
    
    <!-- 📄 상단 헤더 -->
    <div class="border-b-4 border-black pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Navigation Architecture</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">메뉴 <span class="text-blue-600 NOT-ITALIC">마스터</span></h1>
            <p class="text-xs font-bold opacity-40 mt-3">사용자 사이드바 메뉴와 연결된 서비스 엔진을 실시간으로 관리합니다.</p>
        </div>
        <div class="flex gap-2">
            <a href="/v1/admin" class="btn btn-outline border-black rounded-none px-8 h-14 font-black flex items-center gap-2">
                 <span>←</span> 대시보드
            </a>
            <button class="btn btn-black rounded-none px-10 h-14 font-black border border-black hover:bg-white hover:text-black transition-all" onclick={loadData}>
                데이터 갱신
            </button>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- 🌳 [Left] 메뉴 트리 레이아웃 -->
        <div class="lg:col-span-5 space-y-4">
            <div class="flex justify-between items-center mb-6 border-b-2 border-black pb-2">
                 <h3 class="text-xl font-black italic">현재 메뉴 구성</h3>
                 <button class="text-[10px] font-black underline opacity-40 hover:opacity-100 tracking-widest" onclick={resetForm}>+ 최상위 메뉴 추가</button>
            </div>

            {#if loading}
                <div class="h-80 border border-black border-dashed flex items-center justify-center grayscale opacity-10 font-black italic uppercase">아키텍처 분석 중...</div>
            {:else}
                <div class="space-y-4">
                    {#each menus as m (m.id)}
                        <div class="border-2 border-black p-4 bg-white transition-all group {editingMenu.id === m.id ? 'bg-blue-50 border-blue-600' : ''}">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-4">
                                    <span class="text-2xl">{m.icon_name || '🔹'}</span>
                                    <div>
                                        <div class="font-black text-lg tracking-tight leading-none">{m.title}</div>
                                        <div class="text-[9px] font-bold opacity-30 uppercase mt-1 tracking-widest">
                                            {m.link_type} | 등급 {m.min_rank} 이상
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button class="btn btn-xs btn-ghost border border-black/10 rounded-none font-black text-[9px]" onclick={() => addSub(m.id)}>하위 추가</button>
                                    <button class="btn btn-xs btn-ghost border border-black/10 rounded-none font-black text-[9px]" onclick={() => startEdit(m)}>수정</button>
                                    <button class="btn btn-xs btn-ghost border border-black/10 rounded-none font-black text-[9px] hover:bg-red-600 hover:text-white" onclick={() => handleDelete(m.id)}>삭제</button>
                                </div>
                            </div>

                            <!-- Recursive Sub Menus -->
                            {#if m.sub_menus && m.sub_menus.length > 0}
                                <div class="mt-4 pt-4 border-t border-black/5 space-y-2 ml-8">
                                    {#each m.sub_menus as sub (sub.id)}
                                        <div class="flex justify-between items-center p-2 border border-black/10 hover:border-black/50 transition-colors">
                                            <div class="flex items-center gap-3">
                                                <span class="text-xs opacity-50">└</span>
                                                <span class="font-bold text-sm">{sub.title}</span>
                                                <span class="text-[8px] font-black opacity-20 uppercase tracking-widest">{sub.link_type}</span>
                                            </div>
                                            <div class="flex gap-3">
                                                <button class="text-[9px] font-black underline" onclick={() => startEdit(sub)}>수정</button>
                                                <button class="text-[9px] font-black underline text-red-400" onclick={() => handleDelete(sub.id)}>삭제</button>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- 📝 [Right] 설정 폼 -->
        <div class="lg:col-span-7" id="form-anchor">
            <div class="border-2 border-black p-10 bg-white sticky top-24 shadow-[15px_15px_0_rgba(0,0,0,0.05)]">
                <div class="mb-12 border-b-2 border-black pb-4 flex justify-between items-baseline">
                    <h3 class="text-3xl font-black italic">
                        {editingMenu.id ? '메뉴 정보 수정' : '메뉴 신규 등록'}
                    </h3>
                    <span class="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] italic">Meta Engine v5.1</span>
                </div>

                {#if editingMenu.parent_id}
                    <div class="mb-8 p-4 bg-slate-900 text-white font-black text-xs flex justify-between items-center animate-pulse">
                        <span>상위 메뉴에 연결됨 (부모 ID: {editingMenu.parent_id})</span>
                        <button class="underline text-[10px]" onclick={() => editingMenu.parent_id = ""}>연결 해제</button>
                    </div>
                {/if}

                <div class="space-y-8">
                    <!-- Parent Selection (Grouping) -->
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase tracking-widest opacity-30">상위 메뉴 (소속 그룹)</label>
                        <select bind:value={editingMenu.parent_id} class="w-full h-14 border border-black px-4 font-black bg-white text-sm">
                            <option value="">-- 최상위 메뉴 (그룹 없음) --</option>
                            {#each menus as m}
                                {#if m.id !== editingMenu.id}
                                    <option value={m.id}>📂 {m.title} (ID: {m.id})</option>
                                    <!-- 2단계 메뉴까지만 후보로 노출 (너무 깊은 depth 방지) -->
                                    {#if m.sub_menus}
                                        {#each m.sub_menus as sub}
                                            {#if sub.id !== editingMenu.id}
                                                <option value={sub.id}>&nbsp;&nbsp;&nbsp;└ 📄 {sub.title}</option>
                                            {/if}
                                        {/each}
                                    {/if}
                                {/if}
                            {/each}
                        </select>
                        <p class="text-[9px] font-bold text-blue-600 opacity-60 italic">* 다른 메뉴의 하위로 들어가 그룹화하려면 상위 메뉴를 선택하세요.</p>
                    </div>

                    <!-- Title -->
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase tracking-widest opacity-30">표시될 메뉴 이름</label>
                        <input type="text" bind:value={editingMenu.title} class="w-full h-14 border border-black px-5 font-black text-xl bg-slate-50 focus:bg-white focus:outline-none transition-all" placeholder="예: 공지사항, 인사관리 등" />
                    </div>

                    <div class="grid grid-cols-2 gap-8">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black uppercase tracking-widest opacity-30">연결 방식 (타입)</label>
                            <select bind:value={editingMenu.link_type} class="w-full h-14 border border-black px-4 font-black bg-slate-50 text-sm">
                                <option value="FOLDER">📁 메뉴 그룹 (아코디언/폴더)</option>
                                <option value="URL">🔗 고정 주소 (외부/정적)</option>
                                <option value="APP">⚙️ 시스템 엔진 (앱 인스턴스)</option>
                                <option value="DIVIDER">➖ 구분선</option>
                            </select>
                            <p class="text-[9px] font-bold text-slate-400 mt-2 italic">* '메뉴 그룹'을 선택하면 하위 메뉴들을 담는 아코디언 역할을 합니다.</p>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black uppercase tracking-widest opacity-30">필요한 열람 등급</label>
                            <select bind:value={editingMenu.min_rank} class="w-full h-14 border border-black px-4 font-black bg-slate-50 text-sm">
                                <option value={0}>일반 방문자 (R0)</option>
                                <option value={1}>직원 레벨 (R1)</option>
                                <option value={2}>관리자 프로토콜 (R2)</option>
                                <option value={4}>최고 권한 (R4)</option>
                            </select>
                        </div>
                    </div>

                    <!-- DB Instance Selective Group -->
                    {#if editingMenu.link_type === 'APP'}
                        <div class="p-8 border-2 border-black bg-blue-50/50 space-y-6" in:fade>
                            <div class="space-y-2">
                                <label class="text-[9px] font-black uppercase tracking-widest text-blue-600">사용할 시스템 엔진</label>
                                <select bind:value={editingMenu.app_id} class="w-full h-12 border border-black px-4 font-black text-sm">
                                    <option value="">-- 엔진 선택 --</option>
                                    {#each apps as app}
                                        <option value={app.app_id}>{app.title || app.name} ({app.app_id})</option>
                                    {/each}
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="text-[9px] font-black uppercase tracking-widest text-blue-600">세부 인스턴스 선택 (ID/Slug)</label>
                                <select bind:value={editingMenu.app_instance_id} class="w-full h-12 border border-black px-4 font-black text-sm bg-white">
                                    <option value="">-- 기본 진입 (0) --</option>
                                    <option value={-1}>🛠️ 관리자 전용 모드 (-1)</option>
                                    <option disabled>──────────</option>
                                    {#if editingMenu.app_id === 'board'}
                                        {#each boards as b}
                                            <option value={b.id}>📑 게시판: {b.name} ({b.slug})</option>
                                        {/each}
                                    {/if}
                                </select>
                            </div>
                        </div>

                    {/if}

                    {#if editingMenu.link_type === 'URL'}
                        <div class="space-y-2 pt-6" in:fade> <!-- pt-6 for spacing -->
                            <label class="text-[10px] font-black uppercase tracking-widest text-black">고정 주소 (외부 또는 정적)</label>
                            <input type="text" bind:value={editingMenu.external_url} class="w-full h-14 border border-black px-5 font-bold bg-white text-black focus:outline-none placeholder:italic" placeholder="예: /v1/my-page 또는 https://example.com" />
                            <p class="text-[9px] font-bold opacity-40 italic">메뉴 클릭 시 연결될 정확한 URL을 입력하세요.</p>
                        </div>
                    {/if}

                    <!-- 🔗 URL Preview Banner -->
                    <div class="p-4 bg-slate-100 border border-black border-dashed flex flex-col gap-1">
                        <span class="text-[9px] font-black opacity-30 uppercase tracking-widest">최종 연결 예상 경로 (Final Endpoint)</span>
                        <code class="text-sm font-black text-blue-600 break-all">{predictedUrl}</code>
                    </div>

                    <div class="grid grid-cols-2 gap-8 pt-6">
                         <div class="space-y-2">
                            <label class="text-[10px] font-black uppercase tracking-widest text-black">정렬 순서</label>
                            <input type="number" bind:value={editingMenu.order} class="w-full h-12 border border-black px-4 font-black bg-white text-black" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black uppercase tracking-widest text-black">아이콘 (Emoji)</label>
                            <input type="text" bind:value={editingMenu.icon_name} class="w-full h-12 border border-black px-4 font-black text-center text-xl bg-white text-black" placeholder="Emoji" />
                        </div>
                    </div>
                    <div class="pt-6"> <!-- Separate div for Menu Exposure -->
                         <div class="form-control w-full"> <!-- Using form-control for consistency -->
                            <label class="label cursor-pointer justify-start gap-3">
                                <span class="label-text font-bold text-black">메뉴 노출 여부</span>
                                <input type="checkbox" bind:checked={editingMenu.is_visible} class="toggle toggle-primary" />
                            </label>
                        </div>
                    </div>

                    <div class="pt-10 flex gap-4">
                        <button class="flex-1 h-20 bg-black text-white font-black text-xl uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all" onclick={handleSave}>
                            {editingMenu.id ? '설정 변경 저장' : '새 메뉴 등록'}
                        </button>
                        <button class="w-24 h-20 border-2 border-black font-black uppercase text-[10px] hover:bg-red-50 hover:text-red-500 transition-all" onclick={resetForm}>
                            초기화
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
