<script>
	/**
	 * @file (auth)/+layout.svelte (인증 화면 전용 레이아웃)
	 * @description 전역 인증/알림/토스트는 최상위 +layout.svelte 에서 통합 관리하며,
	 * 비로그인 인증 화면에서는 사내 Alert(/api/alert/active) 마운트를 생략합니다.
	 */
	let { children } = $props();
</script>

<!-- 🚀 메인 콘텐츠 영역 -->
{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		min-height: 100vh;
		font-family: 'Noto Sans KR', sans-serif;
		background-color: white;
		color: black;
	}
</style>
