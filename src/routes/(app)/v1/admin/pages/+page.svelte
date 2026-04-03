<script>
    /**
     * @file (app)/v1/admin/pages/+page.svelte
     * @description 순수 파일 시스템 기반 정적 페이지 내비게이터
     * @philosophy "파일의 존재가 곧 주소의 정의다." (No DB)
     */
    let { data } = $props();
    
    let searchQuery = $state("");
    let filteredPages = $derived(
        data.pages.filter(p => p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    function formatDate(date) {
        return new Date(date).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }
</script>

<div class="space-y-10 animate-fade-in text-black font-['Outfit'] pb-40 px-4 max-w-7xl mx-auto">
    
    <!-- 📄 Hero Section -->
    <div class="border-b-4 border-black pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Pure File-System Navigator</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">Pages <span class="text-blue-600 NOT-ITALIC">Master</span></h1>
            <p class="text-xs font-bold opacity-40 mt-3">DB 없이 /v1/pages 하위의 물리적 파일들을 실시간으로 스캔하여 관리합니다.</p>
        </div>
        <div class="w-full md:w-80">
            <input 
                type="text" 
                bind:value={searchQuery}
                placeholder="SEARCH SLUG..." 
                class="w-full h-14 border-2 border-black px-6 font-black uppercase tracking-widest bg-slate-50 focus:bg-white focus:outline-none transition-all placeholder:opacity-20"
            />
        </div>
    </div>

    <!-- 📦 Page List Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each filteredPages as page (page.slug)}
            <div class="border-2 border-black p-6 bg-white hover:bg-slate-50 transition-all group relative">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-xl">
                        📄
                    </div>
                    <a href={page.url} target="_blank" class="btn btn-xs btn-outline border-black rounded-none font-black text-[9px] uppercase hover:bg-black hover:text-white">
                        Open Live
                    </a>
                </div>

                <h3 class="text-2xl font-black tracking-tighter uppercase italic mb-1 truncate">{page.slug}</h3>
                <p class="text-[10px] font-mono font-bold text-blue-600 opacity-60 mb-6">{page.url}</p>

                <div class="space-y-3 border-t border-black/5 pt-4">
                    <div class="flex justify-between items-center text-[9px] font-bold">
                        <span class="opacity-20 uppercase">Last Sync</span>
                        <span>{formatDate(page.last_modified)}</span>
                    </div>
                    <div class="flex justify-between items-center text-[9px] font-bold">
                        <span class="opacity-20 uppercase">Source Path</span>
                        <span class="truncate max-w-[180px] font-mono">{page.path}</span>
                    </div>
                </div>

                <!-- Hover Decor -->
                <div class="absolute bottom-0 right-0 w-0 h-1 bg-black transition-all group-hover:w-full"></div>
            </div>
        {:else}
            <div class="col-span-full h-80 border-2 border-black border-dashed flex flex-col items-center justify-center grayscale opacity-20">
                <span class="text-4xl mb-4">🔍</span>
                <p class="font-black italic uppercase tracking-widest">No Pages Detected in /v1/pages/</p>
            </div>
        {/each}
    </div>

    <!-- 💡 안내 문구 -->
    <div class="p-8 border-2 border-black bg-slate-50">
        <h4 class="font-black uppercase text-sm mb-2">How to add a new page?</h4>
        <p class="text-xs font-bold opacity-50 leading-relaxed">
            별도의 등록 버튼이 없습니다. <code class="bg-black text-white px-1">src/routes/(app)/v1/pages/</code> 폴더 안에 새로운 폴더를 만들고 <code class="bg-black text-white px-1">+page.svelte</code> 파일을 생성하면 이곳에 자동으로 나타납니다.
        </p>
    </div>
</div>