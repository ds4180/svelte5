<script>
	/**
	 * ============================================================================
	 * [시스템 최상위 기능 사령탑 레이아웃 (True Root Layout)]
	 * ============================================================================
	 * 
	 * 💡 이 파일의 역할:
	 * 화면의 시각적인 디자인(버튼 색상, 사이드바 메뉴 등)은 일체 다루지 않습니다!
	 * 오직 시스템이 살아 숨쉬는 데 필요한 '핵심 기능(인증, PWA, 웹소켓, 전역 알림)'만 전담합니다.
	 * 
	 * 🌟 처리 흐름:
	 * 1. +layout.server.ts 가 건네준 `data.user`(로그인 정보)를 받습니다.
	 * 2. 브라우저 화면이 켜지면 클라이언트 인증 스토어(auth)에 즉시 유저를 등록합니다.
	 * 3. 🚨 로그인된 사용자일 때만 실시간 웹소켓(websocket)을 가동합니다.
	 *    (비로그인 방문자에게 웹소켓을 켜서 401 오류가 나거나 서버 자원을 낭비하는 문제를 원천 차단!)
	 * 4. PWA(모바일 웹앱) 서비스 워커의 준비 상태를 확인합니다.
	 * 5. 모달 팝업이나 토스트 알림을 띄우는 <Alert /> 컴포넌트를 최상위에 항상 대기시킵니다.
	 * 6. 모든 기능 세팅이 끝나면 {@render children()}을 통해 하위 시각 디자인 레이아웃((app) 또는 (auth))에 제어권을 넘깁니다.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { auth } from '$lib/runes/auth.svelte.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { websocket } from '$lib/runes/websocket.svelte.js';
	import Alert from '$lib/components/Alert.svelte';
	import './layout.css';

	// 📌 상위(+layout.server.ts)에서 건네받은 data 와 자식 화면 children 을 props로 받습니다.
	let { data, children } = $props();

	// ----------------------------------------------------------------------------
	// [1단계: 반응형 인증 상태 동기화]
	// ----------------------------------------------------------------------------
	// $effect 는 data.user 값이 변경될 때마다(예: 로그인 성공, 로그아웃 시) 자동으로 실행됩니다.
	// 이를 통해 클라이언트 어디서든 `auth.user`로 현재 로그인된 사용자를 바라볼 수 있게 됩니다.
	$effect(() => {
		auth.setUser(data.user);
	});

	// ----------------------------------------------------------------------------
	// [2단계: 브라우저 환경 마운트 후 실시간 백그라운드 인프라 기동]
	// ----------------------------------------------------------------------------
	onMount(() => {
		// [2-1] 전역 알림(토스트/모달) 엔진 초기화
		alertState.init();

		// [2-2] 실시간 웹소켓 연결 (핵심 보안 & 성능 규칙)
		// 👉 로그인된 사용자만 웹소켓 통신을 연결합니다.
		if (data.user) {
			console.log('🌐 [Root Layout] 로그인 감지 -> 실시간 웹소켓 채널 연결 시작');
			websocket.init();
		} else {
			console.log('🔒 [Root Layout] 비로그인 상태 -> 웹소켓 연결을 생략합니다.');
		}

		// [2-3] PWA (Progressive Web App) 서비스 워커 상태 점검
		// 브라우저가 서비스 워커를 지원하는지 확인하고, 백그라운드 푸시 알림 준비 완료를 기록합니다.
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.ready.then(() => {
				console.log('📱 [Root Layout] PWA Service Worker 준비 완료');
			}).catch((err) => {
				console.warn('⚠️ [Root Layout] PWA Service Worker 확인 실패:', err);
			});
		}
	});
</script>

<!-- 🔔 시스템 전역 알림 레이어: 화면 상단 토스트 알림 및 중앙 모달 팝업 창 -->
<Alert positionFilter="top" />
<Alert positionFilter="modal" />

<!-- 🎨 하위 레이아웃((app)의 3분할 대시보드 또는 (auth)의 로그인 카드)을 화면에 렌더링 -->
{@render children()}
