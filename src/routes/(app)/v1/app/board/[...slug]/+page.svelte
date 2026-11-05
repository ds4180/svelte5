<script>
	/**
	 * @file (app)/v1/app/board/[...slug]/+page.svelte
	 * @description 단수형 게시판 인스턴스 엔트리포인트 (/v1/app/board/[...slug])
	 *              하위의 모든 경로(목록, 상세, 쓰기, 수정)를 받아 BoardEngine으로 직통 위임합니다.
	 */
	import { page } from '$app/state';
	import BoardEngine from '../BoardEngine.svelte';

	const slug = $derived(page.params.slug || '');
</script>

<svelte:head>
	<title>{slug.split('/')[0] || '게시판'} | jeju.live</title>
</svelte:head>

<BoardEngine {slug} appId="boards" />
