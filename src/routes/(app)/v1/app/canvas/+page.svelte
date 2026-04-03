<script>
    /**
     * @file (app)/v1/app/canvas/+page.svelte
     * @description [Restored] Canvas 2D 드로잉 데모 및 약도 서비스 (Svelte 5 & DaisyUI)
     */
    import Canvas from "$lib/components/Canvas.svelte";
    import Icon from '@iconify/svelte';

    let buildingColor = $state("lightgray");
    let isPathHighlighted = $state(false);

    /**
     * @function toggleHighlight
     * @description 경로 강조 상태 토글
     */
    function toggleHighlight() {
        isPathHighlighted = !isPathHighlighted;
    }
</script>

<div class="space-y-12 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-5xl mx-auto">
    <!-- Header Section -->
    <div class="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Navigation Engine v1.0</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">약도 <span class="text-rose-600 NOT-ITALIC">도면 <Icon icon="mdi:drawing-box" class="inline-block align-text-bottom text-rose-600 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">2D 캔버스 API를 활용하여 정교한 위치 정보와 도면을 작성합니다.</p>
        </div>
        <div class="flex items-center gap-2">
            <button class="btn btn-lg {isPathHighlighted ? 'btn-neutral' : 'btn-ghost'} rounded-2xl px-8 font-black uppercase text-xs border-2 border-slate-900 shadow-xl transition-all" onclick={toggleHighlight}>
                 <Icon icon={isPathHighlighted ? "mdi:eye-off" : "mdi:eye-check"} class="w-5 h-5 mr-1" />
                 {isPathHighlighted ? 'Highlight Off' : 'Highlight Target'}
            </button>
        </div>
    </div>

    <!-- Drawing Board Content -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- Left: Canvas Area -->
        <div class="lg:col-span-8 bg-white border-2 border-slate-900 rounded-[3rem] p-8 md:p-14 shadow-2xl flex items-center justify-center min-h-[500px]">
             <Canvas {buildingColor} bind:isPathHighlighted />
        </div>

        <!-- Right: Control Panel Area -->
        <div class="lg:col-span-4 space-y-6">
            <div class="bg-indigo-600 border-2 border-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white">
                <h3 class="text-3xl font-black italic uppercase tracking-tighter mb-10 border-b border-indigo-400 pb-4">Architectural Config</h3>
                
                <div class="space-y-8">
                     <div class="space-y-4">
                         <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 block">Asset Colorimetry</label>
                         <div class="grid grid-cols-4 gap-4">
                             {#each ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b'] as color}
                                 <button 
                                     class="w-full aspect-square rounded-2xl border-4 transition-all {buildingColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'}"
                                     style="background: {color};"
                                     onclick={() => buildingColor = color}
                                 ></button>
                             {/each}
                         </div>
                     </div>

                     <div class="pt-10 border-t border-indigo-400 flex flex-col items-center">
                         <Icon icon="mdi:cube-scan" class="w-16 h-16 text-indigo-400 mb-6" />
                         <p class="text-[10px] font-black tracking-widest uppercase italic text-center text-indigo-200">
                             2D Vector Raster Engine Active. Renders are calculated based on reactive svelte 5 runes.
                         </p>
                     </div>
                </div>
            </div>

            <!-- Operational Notice Log -->
            <div class="bg-white border-2 border-slate-900 rounded-[2.5rem] p-8 shadow-xl">
                 <h4 class="text-xs font-black uppercase italic tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                     <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                     Live Feed Status
                 </h4>
                 <div class="space-y-3 font-mono text-[9px] text-slate-500 leading-none">
                     <p>[{(new Date()).toISOString()}] Initializing raster engine...</p>
                     <p>[{(new Date()).toISOString()}] Draw sequence executed.</p>
                     <p>[{(new Date()).toISOString()}] Building color changed to {buildingColor}.</p>
                     <p>[{(new Date()).toISOString()}] Path highlight set to {isPathHighlighted}.</p>
                 </div>
            </div>
        </div>
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>
