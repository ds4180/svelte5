<script>
    /**
     * @file (app)/v1/custom/page/[slug]/+page.svelte
     * @description 페이지 엔진 라우트 진입점
     */
    import PageEngine from '$lib/engines/PageEngine.svelte';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    let { data } = $props();

    // 서버 사이드에서 리다이렉트 응답을 보냈을 경우 클라이언트에서 즉시 이동
    onMount(() => {
        if (data.redirect) {
            goto(data.redirect, { replaceState: true });
        }
    });

</script>

<svelte:head>
    <title>{data.page?.title || 'Page'} | PageEngine</title>
</svelte:head>

{#if data.redirect}
    <div class="flex h-screen items-center justify-center font-black uppercase italic opacity-20">
        Redirecting to {data.redirect}...
    </div>
{:else}
    <PageEngine {data} />
{/if}
