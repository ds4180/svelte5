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
	import { toast } from '$lib/runes/toast.svelte.js';
	import { websocket } from '$lib/runes/websocket.svelte.js';
	import Alert from '$lib/components/Alert.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import './layout.css';

	// 📌 상위(+layout.server.ts)에서 건네받은 data 와 자식 화면 children
	let { data, children } = $props();

	// ----------------------------------------------------------------------------
	// [1단계: 요청별 1:1 독립 인증 스코프(Context) 생성 및 주입]
	// ----------------------------------------------------------------------------
	// 서버(SSR)에서 첫 화면을 그릴 때부터 로그인 상태가 즉시 반영되도록 data.user 초기값을 바로 전달합니다.
	// 이렇게 하면 서버 렌더링 시점과 브라우저 하이드레이션 시점 간의 화면 깜빡임(Mismatch)이 100% 사라집니다.
	const auth = setAuthContext(data.user);

	// $effect 로 이후 클라이언트 페이지 이동 시 유저 정보 변경사항을 자동 동기화합니다.
	$effect(() => {
		auth.setUser(data.user);
	});

	// ----------------------------------------------------------------------------
	// [1-1단계: 인증 상태와 1:1 동기화된 실시간 웹소켓 생명주기 제어 ($effect)]
	// ----------------------------------------------------------------------------
	// 💡 onMount 의 일회성 호출 한계를 완벽히 해결:
	// 1. 비로그인 상태로 첫 진입 후 로그인 완료 시 ➔ 실시간 웹소켓 즉시 연결 (새로고침 불필요!)
	// 2. 로그아웃 또는 세션 만료 시 ➔ 웹소켓 즉시 안전 종료 및 재연결 타이머 파기 (소켓 누수 원천 차단!)
	$effect(() => {
		if (browser) {
			if (auth.isAuthenticated) {
				console.log('🌐 [Root Layout] 유저 세션 확인 -> 실시간 웹소켓 채널 연결 (/ws)');
				websocket.init();
			} else {
				console.log('🔒 [Root Layout] 비로그인/세션종료 -> 웹소켓 안전 연결 해제');
				websocket.disconnect();
			}
		}
	});

	// ----------------------------------------------------------------------------
	// [2단계: 브라우저 환경 마운트 후 전역 알림 및 PWA 인프라 기동]
	// ----------------------------------------------------------------------------
	onMount(() => {
		// [2-1] 전역 알림(토스트/모달) 엔진 초기화
		alertState.init();

		// [2-2] 🌐 실시간 WebSocket 시스템 토스트 리스너 장착 (작업 실패 등 시스템 경보 수신)
		const unsubscribeWs = websocket.addMessageListener((msg) => {
			if (msg && msg.type === 'TOAST') {
				const toastType = msg.toast_type || 'info';
				const text = msg.message || '';
				if (toastType === 'error') {
					toast.error(text, 5000);
				} else if (toastType === 'warning') {
					toast.warning(text, 5000);
				} else if (toastType === 'success') {
					toast.success(text, 5000);
				} else {
					toast.info(text, 5000);
				}
			}
		});

		// [2-3] PWA (Progressive Web App) 서비스 워커 상태 점검
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.ready.then(() => {
				console.log('📱 [Root Layout] PWA Service Worker 준비 완료');
			}).catch((err) => {
				console.warn('⚠️ [Root Layout] PWA Service Worker 확인 실패:', err);
			});
		}

		return () => {
			unsubscribeWs();
		};
	});
</script>

<!-- 🔔 사내 업무 소통/공지 알림 레이어 (로그인한 임직원에게만 노출) -->
<!-- 💡 비로그인 손님이나 로그인 화면에서는 사내 배차 공지나 업무 지시가 뜨지 않도록 완벽 격리합니다. -->
{#if data.user}
	<Alert positionFilter="top" />
	<Alert positionFilter="bottom" />
	<Alert positionFilter="modal" />
{/if}

<!-- 🍞 시스템 기본 알림 레이어 (우측 하단 API/네트워크 오류 및 작업 피드백) -->
<!-- 💡 로그인 실패 안내("비밀번호 불일치") 등을 띄워야 하므로 전역에서 대기합니다. -->
<Toast />

<!-- 🎨 하위 시각 디자인 레이아웃((app) 또는 (auth)) 렌더링 -->
{@render children()}
