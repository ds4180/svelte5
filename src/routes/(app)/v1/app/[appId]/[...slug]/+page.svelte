<script>
    /**
     * /v1/app/[appId]/[...slug]/+page.svelte
     * @description 앱 엔진 동적 마운트 페이지
     *   - AppRegistry의 main_component 문자열로 실제 엔진 컴포넌트를 런타임에 결정
     */
    import * as Engines from "$lib";       // $lib/index.js에 등록된 엔진 컴포넌트 맵
    import { fade } from "svelte/transition";

    /** @type {import('./$types').PageData} */
    let { data } = $props();

    // 🚀 [v2.0 최종 해결] 반응성($derived) 주입: 
    // URL이 바뀔 때(data가 바뀔 때) 컴포넌트를 즉시 재계산하여 리로드 없이 화면 전환
    let TargetComponent = $derived(Engines[data.appInfo.main_component]);
</script>

<div class="app-viewport min-h-[70vh]" in:fade>
    {#if TargetComponent}
        <!-- 🧩 등록된 엔진 컴포넌트 동적 마운트 -->
        <TargetComponent 
            slug={data.slug} 
            appId={data.appInfo.app_id} 
            initialData={data.initialData} 
        />
    {:else}
        <!-- 엔진 컴포넌트를 찾지 못한 경우 안내 -->
        <div class="container mx-auto max-w-2xl py-16 text-center">
            <div class="alert alert-warning shadow-md flex-col gap-3 p-8 rounded-2xl">
                <span class="text-6xl">🧩</span>
                <div>
                    <h3 class="font-bold text-lg">컴포넌트를 찾을 수 없습니다</h3>
                    <p class="text-sm mt-1 opacity-70">
                        App Registry에 등록된 컴포넌트명
                        (<strong>{data.appInfo.main_component}</strong>)이
                        엔진 지도(<code>$lib/index.js</code>)에 존재하는지 확인하세요.
                    </p>
                </div>
                <a href="/v1/admin/apps" class="btn btn-primary btn-sm">
                    App 설정 확인하러 가기
                </a>
            </div>
        </div>
    {/if}
</div>
