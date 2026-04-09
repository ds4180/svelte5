<script>
	/**
	 * @file +layout.svelte (하이드레이션 표준 쉘)
	 * @description 전역 상태 관리 및 시스템 부팅 제어
	 */
	import { onMount, untrack } from 'svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { auth } from '$lib/runes/auth.svelte.js';
	import '../layout.css'; // 상위 디렉토리의 layout.css를 참조하도록 수정

	let { data, children } = $props();

	// [데이터 동기화] 서버 -> 클라이언트 RUNE
	$effect(() => {
		if (data.user) {
			untrack(() => auth.setUser(data.user));
		}
	});

	onMount(() => {
		// 하이드레이션 완료 후 전역 상태 초기화
		alertState.init();
		auth.init();
		console.log('🚀 [System] Hydration Completed & Infrastructure Bootstrapped');
	});
</script>

<!-- 🔔 전역 알림 레이어 (Alert 컴포넌트 내부에 browser 가드 적용됨) -->
<Alert positionFilter="top" />
<Alert positionFilter="modal" />

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
