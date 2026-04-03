<script>
    /**
     * @file (app)/v1/app/uploadfile/+page.svelte
     * @description 고도화된 파일 업로드 테스트 페이지 (Svelte 5 & DaisyUI)
     */
    import ImageUploader from "$lib/components/ImageUploader.svelte";
    import Icon from '@iconify/svelte';

    /** @type {any[]} */
    let uploadedFiles = $state([]);
</script>

<div class="space-y-12 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Storage Asset Engine</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">파일 <span class="text-blue-600 NOT-ITALIC">업로드 <Icon icon="mdi:cloud-upload-outline" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">안전하고 빠른 클라우드 스토리지를 기반으로 자산을 관리합니다.</p>
        </div>
    </div>

    <!-- Main Content -->
    <div class="bg-white border-2 border-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl overflow-hidden">
        <div class="mb-10">
            <h3 class="text-2xl font-black italic text-slate-900 uppercase tracking-tighter mb-2">Asset Dropzone</h3>
            <p class="text-xs font-bold text-slate-400 uppercase">Modular uploader component with instant preview</p>
        </div>

        <!-- Uploader Component Integration -->
        <ImageUploader bind:uploadedFiles multiple={true} />

        <div class="mt-16 pt-10 border-t border-slate-100 flex flex-col items-center">
            <Icon icon="mdi:information-outline" class="w-8 h-8 text-slate-200 mb-4" />
            <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center max-w-sm">
                이미지 뿐만 아니라 PDF, DOC, XLS 등 다양한 문서 형식을 지원하며 업로드 즉시 썸네일이 생성되어 관리의 편의성을 제공합니다.
            </p>
        </div>
    </div>

    <!-- Result Data (Admin or Debug view) -->
    {#if uploadedFiles.length > 0}
        <div class="mt-16 space-y-6 animate-slide-up">
            <h3 class="text-xl font-black italic text-slate-400 uppercase tracking-tighter flex items-center gap-2">
                Server Response Metadata
                <span class="bg-blue-100 text-blue-600 text-[10px] not-italic px-2 py-0.5 rounded-md font-bold">{uploadedFiles.length} FILLES</span>
            </h3>
            <div class="bg-slate-900 rounded-[2rem] p-8 md:p-10 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-2xl">
                <pre class="whitespace-pre-wrap">{JSON.stringify(uploadedFiles, null, 2)}</pre>
            </div>
        </div>
    {/if}
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .animate-slide-up {
        animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(40px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>
