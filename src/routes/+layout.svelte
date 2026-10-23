<script>
	/**
	 * ============================================================================
	 * [시스템 최상위 기능 사령탑 레이아웃 (True Root Layout)]
	 * ============================================================================
	 * 
	 * 💡 이 파일의 역할:
	 * 화면 디자인은 일체 다루지 않고, 시스템 전체의 기능(인증 격리, 조건부 웹소켓, PWA, 전역 모달)을 전담합니다.
	 * 
	 * 🌟 핵심 보안 강화 (과제 6 적용):
	 * Node.js SSR 시 다른 사용자와 인증 메모리가 섞이는 대참사(Cross-user State Leak)를 막기 위해,
	 * 매 요청마다 1:1 독립된 주머니인 `setAuthContext(data.user)`를 만들어 트리에 안전하게 주입합니다!
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { setAuthContext } from '$lib/runes/auth.svelte.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { websocket } from '$lib/runes/websocket.svelte.js';
	import Alert from '$lib/components/Alert.svelte';
	import './layout.css';

	// 📌 상위(+layout.server.ts)에서 건네받은 data 와 자식 화면 children
	let { data, children } = $props();

	// ----------------------------------------------------------------------------
	// [1단계: 요청별 1:1 독립 인증 스코프(Context) 생성 및 주입]
	// ----------------------------------------------------------------------------
	// 서버에서 렌더링될 때도 다른 사용자의 메모리와 절대 섞이지 않는 나만의 인증 방을 만듭니다.
	const auth = setAuthContext();

	// $effect 로 데이터 변경 시 스코프 유저 정보 자동 동기화 (반응성 완벽 보장)
	$effect(() => {
		auth.setUser(data.user);
	});

	// ----------------------------------------------------------------------------
	// [2단계: 브라우저 환경 마운트 후 실시간 백그라운드 인프라 기동]
	// ----------------------------------------------------------------------------
	onMount(() => {
		// [2-1] 전역 알림(토스트/모달) 엔진 초기화
		alertState.init();

		// [2-2] 실시간 웹소켓 연결 (핵심 보안 규칙)
		// 👉 로그인된 사용자만 웹소켓 통신을 연결합니다. (비로그인 401 오류 원천 차단)
		if (data.user) {
			console.log('🌐 [Root Layout] 로그인 감지 -> 실시간 웹소켓 채널 연결 시작');
			websocket.init();
		} else {
			console.log('🔒 [Root Layout] 비로그인 상태 -> 웹소켓 연결 생략');
		}

		// [2-3] PWA (Progressive Web App) 서비스 워커 상태 점검
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.ready.then(() => {
				console.log('📱 [Root Layout] PWA Service Worker 준비 완료');
			}).catch((err) => {
				console.warn('⚠️ [Root Layout] PWA Service Worker 확인 실패:', err);
			});
		}
	});
</script>

<!-- 🔔 시스템 전역 알림 레이어 (상단 토스트 / 중앙 모달 팝업) -->
<Alert positionFilter="top" />
<Alert positionFilter="modal" />

<!-- 🎨 하위 시각 디자인 레이아웃((app) 또는 (auth)) 렌더링 -->
{@render children()}
