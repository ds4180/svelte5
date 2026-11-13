<script>
	/**
	 * ============================================================================
	 * [시각 디자인 전담 레이아웃: 3분할 반응형 대시보드 ((app)/+layout.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 파일의 역할:
	 * 로그인된 메인 업무 화면의 '순수한 시각적 디자인(UI Shell)'만 책임집니다.
	 * 
	 * 🌟 철저한 위계 분리 (Before vs After):
	 * - [이전]: 인증 처리(auth.setUser), 웹소켓 등 시스템 기능과 대시보드 UI 디자인이 한데 뒤엉켜 있었음.
	 * - [현재]: 유저 인증, PWA, 웹소켓 등 모든 시스템 코어 기능은 최상위 Root(+layout.svelte)가 전담!
	 *          이 파일은 오직 3분할 대시보드(좌측 사이드바, 중앙 업무 컨텐츠, 우측 보조창)를
	 *          아름답고 반응형(PC/모바일)으로 그리는 디자인 역할에만 100% 집중합니다.
	 */
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { alertState } from '$lib/runes/alert.svelte';
	import { getAuthContext } from '$lib/runes/auth.svelte'; // 최상위 Root가 주입한 안전 인증 Context 사용
	import { navState } from '$lib/runes/nav.svelte';
	import { miniappStore } from '$lib/runes/miniapps.svelte';
	import { websocket } from '$lib/runes/websocket.svelte';
	import { offlineSync } from '$lib/runes/offlineSync.svelte';
	import { hardReset, unsubscribePushOnLogout } from '$lib/pwa/serviceWorker';
	import { enterCameraFullscreen } from '$lib/utils/fullscreen';
	import { toast } from '$lib/runes/toast.svelte';
	import DynamicSidebar from '$lib/components/Nav/DynamicSidebar.svelte';
	import SmartIcon from '$lib/components/SmartIcon.svelte';
	import '../layout.css';
	import Icon from '@iconify/svelte';

	// 📌 Root 및 상위 레이아웃에서 전달받은 데이터(메뉴 트리 등)와 자식 컴포넌트(실제 페이지)
	let { data, children } = $props();

	// 📌 최상위 Root(+layout.svelte)에서 1:1로 격리 주입한 현재 사용자의 인증 상태를 꺼내옵니다.
	const auth = getAuthContext();

	// ----------------------------------------------------------------------------
	// [사이드바 메뉴 데이터 동기화]
	// ----------------------------------------------------------------------------
	// 💡 서버(SSR)에서는 전역 navState 싱글톤을 건드리지 않아 사용자 간 메뉴 누수를 원천 차단하고,
	//    브라우저 환경($effect)에서만 네비게이션 스토어에 메뉴 목록을 반응형으로 동기화합니다.
	$effect(() => {
		if (data.menus) {
			navState.setMenus(data.menus);
			navState.isLoading = false;
		}
	});

	$effect(() => {
		if (auth.isAuthenticated) {
			miniappStore.refresh();
		} else {
			miniappStore.reset();
		}
	});

	// --- [상태 관리] ---
	// 💡 [모바일 퍼스트] 초기 렌더링 시 모바일 환경에서는 닫힌 상태(w-0)로 시작하여 열린 채 로딩되는 현상을 방지
	let isMobile = $state(typeof window !== 'undefined' ? window.innerWidth < 1200 : true);
	let isLeftOpen = $state(typeof window !== 'undefined' ? window.innerWidth >= 1200 : false);
	let isRightOpen = $state(false);
	let isScrolled = $state(false);
	/** @type {Record<string|number, boolean>} */
	let openMenus = $state({});
	let isMounted = $state(false);

	// 🌐 우측 상단 헤더 개편 상태 (사용자 팝업 메뉴, 실시간 네트워크/소켓 듀얼 감지, 풀스크린)
	// 💡 네트워크 온라인/오프라인 상태 및 토스트 알림은 offlineSync.isOnline 단일 엔진에서 통합 관리합니다.
	let isUserMenuOpen = $state(false);
	let isWsMenuOpen = $state(false);
	let isFullscreen = $state(false);

	/**
	 * 직급/랭크 레이블 반환 헬퍼
	 * @param {any} rank
	 */
	function getUserRankLabel(rank) {
		const r = Number(rank ?? 0);
		if (r >= 9) return '최고관리자 (Lv.9)';
		if (r >= 8) return '시스템관리자 (Lv.8)';
		if (r >= 4) return `운영관리자 (Lv.${r})`;
		if (r >= 1) return `정회원 (Lv.${r})`;
		return '일반회원 (Lv.0)';
	}

	/**
	 * 브라우저 전체화면(Fullscreen) 토글
	 */
	async function toggleFullscreen() {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			} else {
				await document.exitFullscreen();
			}
		} catch (e) {
			console.warn('전체화면 전환 실패:', e);
		}
	}

	/**
	 * 서비스 워커 캐시 강제 초기화 및 최신 동기화 (Hard Refresh)
	 * 💡 모바일에서는 Ctrl+Shift+R 이 불가능하므로 CacheStorage 삭제 + SW 등록 해제 후 새로고침합니다.
	 *    (빌드 파일명이 해시 기반이므로 HTTP 디스크 캐시는 별도로 갱신할 필요가 없습니다.)
	 */
	async function handleHardRefresh() {
		toast.info('캐시를 초기화하고 최신 버전을 동기화합니다...');
		try {
			await hardReset();
		} catch (e) {
			console.warn('캐시 삭제 중 오류:', e);
		}
		window.location.reload();
	}

	onMount(() => {
		// 🛡️ [뷰포트 안전 보증] 브라우저 스크롤 좌표를 (0, 0) 원점으로 강제 고정
		if (typeof window !== 'undefined') {
			window.scrollTo(0, 0);
			isFullscreen = !!document.fullscreenElement;
		}

		const handleFullscreenChange = () => {
			isFullscreen = !!document.fullscreenElement;
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);

		const updateMedia = () => {
			isMobile = window.innerWidth < 1200;
			if (isMobile) {
				isLeftOpen = false;
			} else {
				isLeftOpen = true;
			}
			isRightOpen = false;
		};

		// 🛡️ [초기 위치 즉시 동기화] 마운트 즉시 화면 크기에 맞게 초기 상태를 세팅
		updateMedia();
		if (data.menus) {
			data.menus.forEach((/** @type {any} */ m) => {
				if (openMenus[m.id] === undefined) openMenus[m.id] = true;
			});
		}

		// 🚀 [초기 로딩 튐 방지] 첫 프레임이 그려진 후 transition을 활성화하여 로딩 시 애니메이션 차단
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				isMounted = true;
			});
		});

		const handleScroll = () => {
			isScrolled = window.scrollY > 10;
		};
		window.addEventListener('scroll', handleScroll);
		window.addEventListener('resize', updateMedia);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', updateMedia);
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
		};
	});

	$effect(() => {
		if (page.url.pathname) {
			navState.clearPageMenus();
			isRightOpen = false;
			if (isMobile) isLeftOpen = false;
		}
	});

	function toggleLeft() {
		isLeftOpen = !isLeftOpen;
	}
	function toggleRight() {
		isRightOpen = !isRightOpen;
	}
	/** @param {any} menuId */
	function toggleMenu(menuId) {
		const current = openMenus[menuId] ?? true;
		openMenus[menuId] = !current;
	}

	/** @param {any} path */
	function isActive(path) {
		if (!path || path === '#') return false;
		const currentPath = page.url.pathname;
		let targetPath;
		try {
			targetPath = new URL(path, page.url.origin).pathname;
		} catch {
			targetPath = path;
		}
		if (currentPath === targetPath) return true;
		if (targetPath !== '/' && currentPath.startsWith(targetPath)) {
			const nextChar = currentPath.charAt(targetPath.length);
			if (nextChar === '/' || nextChar === '') return true;
		}
		return false;
	}
</script>

<div
	class="relative flex h-screen h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-slate-50 font-['Noto_Sans_KR','Outfit'] text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-700"
>
	<!-- 🌐 Premium Navbar (Global Header) -->
	<header
		class="z-[1000] flex h-14 md:h-16 min-h-0 w-full max-w-full flex-none items-center justify-between border-b-2 md:border-b-4 border-slate-900 bg-white px-2.5 sm:px-4 md:px-6 transition-all {isScrolled
			? 'shadow-xl'
			: ''}"
	>
		<div class="flex-none lg:pr-4">
			<button
				class="flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl md:rounded-2xl border-2 border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
				onclick={toggleLeft}
				aria-label="메뉴 열기"
			>
				<Icon icon="ph:list-bold" class="h-4.5 w-4.5 md:h-5 md:w-5" />
			</button>
		</div>
		<div class="flex-1 min-w-0 px-2 sm:px-1">
			<a
				href="/"
				class="group inline-flex items-center truncate border-none text-lg leading-none font-black tracking-tighter text-slate-900 uppercase italic sm:text-xl md:text-2xl"
			>
				Jeju.Live <span
					class="ml-1.5 not-italic text-blue-600 decoration-4 underline-offset-4 group-hover:underline"
					>Admin</span
				>
			</a>
		</div>
		<div
			class="flex h-full flex-none items-center gap-1.5 sm:gap-2 border-slate-100 pl-2 pr-0.5 sm:border-l-2 sm:pl-4 sm:pr-2 md:gap-2.5"
		>
			<!-- 🌐 1. 실시간 네트워크 & 웹소켓 3단 상태 인디케이터 (LIVE / CACHED / OFFLINE) -->
			<div class="relative">
				<button
					type="button"
					onclick={() => (isWsMenuOpen = !isWsMenuOpen)}
					class="flex h-9 md:h-11 items-center gap-1.5 sm:gap-2 rounded-xl md:rounded-2xl border-2 border-slate-200 bg-white px-2 text-left shadow-sm transition-all hover:border-slate-400 active:scale-95 sm:px-3"
					aria-label="네트워크 및 웹소켓 상태 상세 보기"
				>
					<!-- 상태 아이콘 & 펄스 박스 (H-6 W-6 / H-7 W-7 사용자 아바타와 규격 통일) -->
					<div
						class="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-lg md:rounded-xl border {
							!offlineSync.isOnline
								? 'bg-rose-50 border-rose-200 text-rose-600'
								: websocket.status === 'connected'
									? 'bg-emerald-50 border-emerald-200 text-emerald-600'
									: 'bg-amber-50 border-amber-200 text-amber-600'
						}"
					>
						{#if !offlineSync.isOnline}
							<Icon icon="ph:wifi-slash-bold" class="text-xs md:text-sm" />
						{:else if websocket.status === 'connected'}
							<span class="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
								<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
								<span class="relative inline-flex h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-emerald-500"></span>
							</span>
						{:else}
							<Icon icon="ph:arrows-clockwise-bold" class="text-xs md:text-sm animate-spin text-amber-600" />
						{/if}
					</div>

					<!-- 2줄 텍스트 구조 (사용자 프로필 뱃지와 동일 위계) -->
					<div class="hidden flex-col md:flex">
						<span class="text-xs font-black leading-none {
							!offlineSync.isOnline
								? 'text-rose-700'
								: websocket.status === 'connected'
									? 'text-emerald-700'
									: 'text-amber-700'
						}">
							{!offlineSync.isOnline ? 'OFFLINE' : websocket.status === 'connected' ? 'LIVE' : 'CACHED'}
						</span>
						<span class="mt-0.5 text-[10px] font-bold text-slate-400 leading-none">
							{#if offlineSync.pendingCount > 0}
								<span class="text-blue-600 font-black">우체통 {offlineSync.pendingCount}건</span>
							{:else}
								{!offlineSync.isOnline ? '인터넷 단절' : websocket.status === 'connected' ? '실시간 동기화' : '재연결 중'}
							{/if}
						</span>
					</div>

					<!-- 📮 오프라인 임시 우체통 대기 건수 실시간 배지 -->
					{#if offlineSync.pendingCount > 0}
						<span class="inline-flex items-center gap-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] md:text-[10px] font-black text-white shadow-xs animate-pulse">
							{offlineSync.pendingCount}
						</span>
					{/if}

					<Icon icon="ph:caret-down-bold" class="text-[10px] md:text-xs text-slate-400 transition-transform {isWsMenuOpen ? 'rotate-180' : ''}" />
				</button>

				<!-- 웹소켓 상세 관제 팝업 -->
				{#if isWsMenuOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-[1002]"
						onclick={() => (isWsMenuOpen = false)}
						aria-label="웹소켓 메뉴 닫기 배경"
					></div>

					<!-- 웹소켓 상세 관제 팝업 (모바일 반응형 잘림 방지: 모바일 fixed inset-x-4 top-16, 데스크톱 sm:absolute sm:right-0) -->
					<div
						class="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full z-[1003] sm:mt-2.5 w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-2xl transition-all"
					>
						<div class="rounded-2xl border border-slate-100 bg-slate-50/90 p-3.5 mb-3">
							<div class="flex items-center justify-between">
								<span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Live Channel Monitor</span>
								<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black {
									!offlineSync.isOnline
										? 'bg-rose-50 text-rose-600 border border-rose-200'
										: websocket.status === 'connected'
											? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
											: 'bg-amber-50 text-amber-600 border border-amber-200'
								}">
									<span class="h-1.5 w-1.5 rounded-full {
										!offlineSync.isOnline
											? 'bg-rose-500'
											: websocket.status === 'connected'
												? 'bg-emerald-500'
												: 'bg-amber-500 animate-pulse'
									}"></span>
									{!offlineSync.isOnline ? '단절' : websocket.status === 'connected' ? '연결됨' : '대기'}
								</span>
							</div>
							<div class="mt-1.5 font-mono text-xs font-bold text-slate-800 break-all">
								/ws (Enterprise Socket)
							</div>
						</div>

						<div class="space-y-2 py-1 text-xs">
							<div class="flex items-center justify-between text-slate-600 px-1">
								<span>단말기 네트워크</span>
								<span class="font-bold {offlineSync.isOnline ? 'text-emerald-600' : 'text-rose-600'}">
									{offlineSync.isOnline ? '온라인 (Connected)' : '오프라인 (Disconnected)'}
								</span>
							</div>
							<div class="flex items-center justify-between text-slate-600 px-1">
								<span>소켓 채널 상태</span>
								<span class="font-mono font-bold uppercase {
									websocket.status === 'connected' ? 'text-emerald-600' : 'text-amber-600'
								}">
									{websocket.status}
								</span>
							</div>
							<div class="flex items-center justify-between text-slate-600 px-1">
								<span>오프라인 우체통</span>
								<span class="font-bold {offlineSync.pendingCount > 0 ? 'text-blue-600' : 'text-slate-500'}">
									{offlineSync.pendingCount > 0 ? `대기 ${offlineSync.pendingCount}건` : '비어 있음 (0건)'}
								</span>
							</div>

							<!-- 📮 대기 중인 우체통 항목 상세 리스트 -->
							{#if offlineSync.pendingCount > 0}
								<div class="mt-2 rounded-2xl border border-blue-200 bg-blue-50/70 p-2.5 space-y-1 max-h-28 overflow-y-auto">
									<div class="flex items-center justify-between text-[10px] font-black text-blue-800">
										<span>📮 자동 전송 대기 목록</span>
										<button
											type="button"
											onclick={() => offlineSync.clearOutbox()}
											class="text-rose-600 hover:underline font-bold"
										>
											비우기
										</button>
									</div>
									{#each offlineSync.pendingItems as item}
										<div class="flex items-center justify-between rounded-xl bg-white px-2.5 py-1.5 text-[10px] border border-blue-100">
											<span class="font-bold text-slate-700 truncate">{item.label}</span>
											<span class="text-[9px] text-slate-400 font-mono shrink-0 ml-1">{item.createdAt}</span>
										</div>
									{/each}
								</div>
							{/if}

							<div class="rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed border border-slate-100">
								{#if !offlineSync.isOnline}
									단말기 인터넷 연결이 끊겨 오프라인 상태입니다. 작성한 글과 사진은 우체통에 보관 후 연결 시 자동 등록됩니다.
								{:else if websocket.status === 'connected'}
									실시간 웹소켓이 안정적으로 연결되어 사내 공지 및 변경사항이 0.1초 이내로 동기화됩니다.
								{:else}
									웹소켓 연결이 일시 지연 중입니다. 브라우저에 캐싱된 데이터가 표출될 수 있습니다.
								{/if}
							</div>
						</div>

						<div class="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
							{#if offlineSync.pendingCount > 0}
								<button
									type="button"
									onclick={() => offlineSync.syncAll()}
									disabled={offlineSync.isSyncing || !offlineSync.isOnline}
									class="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
								>
									<Icon icon="ph:cloud-arrow-up-bold" class="text-sm" />
									{offlineSync.isSyncing ? '우체통 전송 중...' : `우체통 즉시 전송 (${offlineSync.pendingCount}건)`}
								</button>
							{/if}
							<button
								type="button"
								onclick={() => {
									isWsMenuOpen = false;
									if (!offlineSync.isOnline) {
										toast.warning('인터넷 연결이 필요합니다.');
									} else {
										websocket.init();
										toast.info('웹소켓 재연결을 시도합니다...');
									}
								}}
								class="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-blue-600 transition shadow-sm"
							>
								<Icon icon="ph:arrows-clockwise-bold" class="text-sm" />
								소켓 즉시 재연결
							</button>

							<button
								type="button"
								onclick={() => {
									isWsMenuOpen = false;
									handleHardRefresh();
								}}
								class="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:border-slate-400 transition"
							>
								<Icon icon="ph:arrow-clockwise-bold" class="text-xs text-blue-600" />
								캐시 초기화 & 새로고침
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- 👤 2. 사용자 프로필 뱃지 및 팝업 메뉴 (드롭다운) -->
			{#if auth.user}
				<div class="relative">
					<button
						type="button"
						onclick={() => (isUserMenuOpen = !isUserMenuOpen)}
						class="flex h-9 md:h-11 items-center gap-1.5 sm:gap-2 rounded-xl md:rounded-2xl border-2 border-slate-200 bg-white px-2 text-left shadow-sm transition-all hover:border-slate-400 active:scale-95 sm:px-3"
						aria-label="사용자 계정 팝업 메뉴"
					>
						<!-- 직급 아바타 이니셜 -->
						<div class="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-lg md:rounded-xl bg-slate-900 text-xs font-black text-white">
							{(auth.user.real_name || auth.user.username || '?')[0]}
						</div>
						<div class="hidden flex-col md:flex">
							<span class="text-xs font-black text-slate-900 leading-none">
								{auth.user.real_name || auth.user.username}
							</span>
							<span class="mt-0.5 text-[10px] font-bold text-blue-600 leading-none">
								{auth.user.role_name || getUserRankLabel(auth.user.rank_level)}
							</span>
						</div>
						<Icon icon="ph:caret-down-bold" class="text-[10px] md:text-xs text-slate-400 transition-transform {isUserMenuOpen ? 'rotate-180' : ''}" />
					</button>

					<!-- 드롭다운 팝업 메뉴 -->
					{#if isUserMenuOpen}
						<!-- 백드롭 (외부 클릭 시 닫힘) -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="fixed inset-0 z-[1002]"
							onclick={() => (isUserMenuOpen = false)}
							aria-label="메뉴 닫기 배경"
						></div>

						<!-- 사용자 계정 팝업 메뉴 (모바일 반응형 잘림 방지: 모바일 fixed inset-x-4 top-16, 데스크톱 sm:absolute sm:right-0) -->
						<div
							class="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full z-[1003] sm:mt-2.5 w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 rounded-3xl border-2 border-slate-200 bg-white p-3.5 shadow-2xl transition-all"
						>
							<!-- [A] 사용자 기본 정보 & 보안 접속 기기 헤더 -->
							<div class="rounded-2xl border border-slate-100 bg-slate-50/90 p-3.5 mb-2">
								<div class="flex items-center justify-between">
									<span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Signed in Account</span>
									<span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
										<Icon icon={isMobile ? "ph:device-mobile-bold" : "ph:desktop-bold"} class="text-xs" />
										{isMobile ? '모바일' : '데스크톱'}
									</span>
								</div>
								<div class="mt-1.5 flex items-baseline gap-1 font-black text-slate-900 text-sm">
									{auth.user.real_name || auth.user.username}
									<span class="text-xs font-normal text-slate-400">(@{auth.user.username})</span>
								</div>
								<div class="mt-2 flex flex-wrap items-center gap-1.5">
									<span class="rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-black text-blue-700">
										{auth.user.role_name || getUserRankLabel(auth.user.rank_level)}
									</span>
									{#if auth.user.primary_group}
										<span class="rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
											{auth.user.primary_group}
										</span>
									{/if}
								</div>
							</div>

							<!-- [B] 팝업 제어 메뉴 목록 -->
							<div class="py-1 flex flex-col gap-1 text-xs">
								<!-- 🔔 알림 수신 토글 (방해금지 MUTE / ON) -->
								<button
									type="button"
									onclick={() => alertState.toggleQuietMode()}
									class="flex w-full items-center justify-between px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition rounded-xl"
								>
									<span class="flex items-center gap-2.5">
										<Icon icon={alertState.isQuietMode ? "ph:bell-slash-bold" : "ph:bell-bold"} class="text-base {alertState.isQuietMode ? 'text-rose-500' : 'text-emerald-500'}" />
										알림 수신 모드
									</span>
									<span class="rounded-full px-2 py-0.5 text-[10px] font-black {alertState.isQuietMode ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
										{alertState.isQuietMode ? 'MUTE' : 'LIVE'}
									</span>
								</button>

								<!-- 🖥️ 전체화면 (Fullscreen) 토글 -->
								<button
									type="button"
									onclick={() => { toggleFullscreen(); isUserMenuOpen = false; }}
									class="flex w-full items-center justify-between px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition rounded-xl"
								>
									<span class="flex items-center gap-2.5">
										<Icon icon={isFullscreen ? "ph:corners-in-bold" : "ph:corners-out-bold"} class="text-base text-slate-600" />
										전체화면 관제 모드
									</span>
									<span class="text-[10px] text-slate-400 font-bold">
										{isFullscreen ? '창모드' : '전체화면'}
									</span>
								</button>

								<!-- 📷 웹카메라 실행 (WebCam Studio: 클릭 즉시 F11 전체화면 전환) -->
								<a
									href="/v1/pages/camera"
									onclick={() => { isUserMenuOpen = false; enterCameraFullscreen(); }}
									class="flex w-full items-center justify-between px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition rounded-xl"
								>
									<span class="flex items-center gap-2.5">
										<Icon icon="ph:camera-bold" class="text-base text-rose-600" />
										웹카메라 실행
									</span>
									<span class="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600 border border-rose-200">
										WebCam
									</span>
								</a>

								<!-- 👤 내 프로필 정보 -->
								<a
									href="/v1/pages/profile"
									onclick={() => (isUserMenuOpen = false)}
									class="flex items-center gap-2.5 px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition rounded-xl"
								>
									<Icon icon="ph:user-bold" class="text-base text-slate-500" />
									내 프로필 정보
								</a>

								<!-- 🛠️ 관리자 관제탑 (Lv.4 이상 또는 Root) -->
								{#if auth.isRoot || (auth.user?.rank_level ?? 0) >= 4}
									<a
										href="/v1/admin"
										onclick={() => (isUserMenuOpen = false)}
										class="flex items-center gap-2.5 px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition rounded-xl"
									>
										<Icon icon="ph:gear-six-bold" class="text-base text-blue-600" />
										관리자 관제탑 (/v1/admin)
									</a>
								{/if}
							</div>

							<!-- [C] 로그아웃 버튼 (POST Form Action 전용 - Hover 프리페치/GET 부작용 차단) -->
							<div class="border-t border-slate-100 pt-2.5 mt-1">
								<form
									method="POST"
									action="/logout"
									onsubmit={() => {
										auth.clear();
										unsubscribePushOnLogout();
									}}
								>
									<button
										type="submit"
										class="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer"
									>
										<Icon icon="ph:sign-out-bold" class="text-sm" />
										로그아웃 (Sign Out)
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<a
					href="/login"
					class="flex h-9 md:h-11 items-center rounded-xl md:rounded-2xl border-2 border-slate-900 bg-slate-900 px-3.5 md:px-5 font-black text-xs tracking-wider text-white uppercase shadow-sm transition-all hover:bg-blue-600 hover:border-blue-600"
				>
					Sign In
				</a>
			{/if}

			<!-- 🍔 동적 폼 호출 (미니앱 통합 미결 뱃지 연동) -->
			<button
				class="group relative flex h-9 w-9 md:h-11 md:w-11 flex-none items-center justify-center overflow-hidden rounded-xl md:rounded-2xl border-2 border-slate-900 bg-slate-900 text-white shadow-sm transition-all hover:bg-blue-600 hover:border-blue-600 active:scale-95"
				onclick={toggleRight}
				aria-label="동적 폼 열기"
				title={`미니앱 미결 업무: ${miniappStore.counts.TOTAL}건`}
			>
				<Icon icon="ph:magic-wand-fill" class="z-10 h-4.5 w-4.5 md:h-5 md:w-5" />
				{#if miniappStore.counts.TOTAL > 0}
					<span class="pointer-events-none absolute top-1 right-1 z-20 flex h-3.5 min-w-3.5 md:h-4 md:min-w-4 items-center justify-center rounded-full bg-rose-600 px-0.5 md:px-1 text-[8px] md:text-[9px] font-black text-white shadow-sm">
						<span class="relative">{miniappStore.counts.TOTAL > 99 ? '99+' : miniappStore.counts.TOTAL}</span>
					</span>
				{:else if navState.pageMenus && navState.pageMenus.length > 0}
					<span class="pointer-events-none absolute top-1 right-1 md:top-1.5 md:right-1.5 flex h-2 w-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
					</span>
				{/if}
			</button>
		</div>
	</header>

	<div class="relative flex flex-1 w-full max-w-full min-w-0 min-h-0 overflow-hidden">
		<!-- ⬅️ 왼쪽 네비게이션 사이드바 (모바일/태블릿 Scrim 백드롭 포함) -->
		{#if isMobile && isLeftOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-[990] bg-slate-950/40 backdrop-blur-[2px] transition-opacity"
				onclick={toggleLeft}
				aria-label="메뉴 닫기 배경"
			></div>
		{/if}
		<aside
			class="z-[995] flex-none h-full overflow-hidden bg-slate-900 text-slate-300 shadow-2xl
                      {isMounted ? 'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]' : 'transition-none'}
                      {isMobile ? 'absolute top-0 bottom-0 left-0 h-full' : ''} 
                      {isLeftOpen ? 'w-72 border-r-4 border-slate-900' : 'w-0 border-r-0'}"
		>
			<div class="custom-scrollbar-dark flex h-full w-72 flex-col overflow-y-auto px-4 pt-6 pb-32">
				<div class="mb-6 rounded-2xl border border-slate-800 bg-slate-800/50 p-4">
					<span
						class="block text-[10px] leading-none font-black tracking-widest text-blue-400 uppercase"
						>Console System</span
					>
					<h2 class="mt-1.5 text-lg leading-none font-black tracking-tight text-white">
						Main Navigation
					</h2>
				</div>

				<nav class="mb-20 flex flex-col gap-1.5">
					{#if data.menus}
						{#each data.menus as m, i (m.id || i)}
							{#if m.sub_menus && m.sub_menus.length > 0}
								{@const menuKey = m.id ?? i}
								<div class="group mb-1 flex flex-col">
									<button
										type="button"
										class="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-black tracking-tight text-slate-200 transition-all hover:bg-slate-800 hover:text-white"
										onclick={() => toggleMenu(menuKey)}
									>
										<span class="flex items-center gap-3.5">
											<div class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 transition-colors {(openMenus[menuKey] ?? true) ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500'}">
												<SmartIcon
													icon={m.icon_name}
													fallback="ph:folder-fill"
													class="h-4.5 w-4.5"
													emojiClass="text-base leading-none"
												/>
											</div>
											<span>{m.title}</span>
										</span>
										<Icon
											icon="ph:caret-down-bold"
											class="text-xs text-slate-500 transition-transform duration-300 {(openMenus[menuKey] ?? true)
												? 'rotate-180 text-blue-400'
												: ''}"
										/>
									</button>
									{#if (openMenus[menuKey] ?? true)}
										<div class="mt-1 ml-4 flex flex-col gap-1 border-l-2 border-slate-800 pl-3 transition-all">
											{#each m.sub_menus as sub, si (sub.id || si)}
												<a
													href={sub.external_url}
													onclick={() => {
														if (sub.external_url?.includes('/v1/pages/camera')) enterCameraFullscreen();
													}}
													class="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold tracking-tight transition-all
                                                         {isActive(sub.external_url)
														? 'bg-blue-600 text-white font-black shadow-md shadow-blue-900/20'
														: 'text-slate-400 hover:bg-slate-800/80 hover:text-white'}"
												>
													{#if sub.icon_name}
														<SmartIcon
															icon={sub.icon_name}
															fallback="ph:link-bold"
															class="h-3.5 w-3.5 shrink-0"
															emojiClass="text-xs leading-none shrink-0"
														/>
													{:else}
														<span class="h-1.5 w-1.5 shrink-0 rounded-full {isActive(sub.external_url) ? 'bg-white' : 'bg-slate-600'}"></span>
													{/if}
													<span>{sub.title}</span>
												</a>
											{/each}
										</div>
									{/if}
								</div>
							{:else}
								<a
									href={m.external_url || '#'}
									onclick={() => {
										if (m.external_url?.includes('/v1/pages/camera')) enterCameraFullscreen();
									}}
									class="mb-1 flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-black tracking-tight transition-all
                                           {isActive(m.external_url)
										? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
										: 'text-slate-300 hover:bg-slate-800 hover:text-white'}"
								>
									<div class="flex h-8 w-8 items-center justify-center rounded-xl {isActive(m.external_url) ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}">
										<SmartIcon
											icon={m.icon_name}
											fallback="ph:rocket-fill"
											class="h-4.5 w-4.5"
											emojiClass="text-base leading-none"
										/>
									</div>
									<span>{m.title}</span>
								</a>
							{/if}
						{/each}
					{/if}
				</nav>
			</div>
		</aside>

		<!-- 🚀 가운데 본문 영역 (가로 넘침 시 정상 스크롤바 지원 overflow-x-auto, 모바일 사이드바 오픈 시 배경 스크롤 잠금) -->
		<main
			class="custom-scrollbar relative flex flex-1 min-w-0 min-h-0 flex-col bg-slate-50
                   {isMounted ? 'transition-all duration-500' : 'transition-none'}
                   {isMobile && isLeftOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto overflow-x-auto'}"
		>
			<div class="mx-auto min-h-full w-full max-w-[1700px] p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-12 lg:p-10 lg:pb-16 min-w-0">
				{@render children?.()}
			</div>
		</main>
	</div>

	<!-- 📱 모바일 세로 모드 전용 하단 퀵 내비게이션 바 (레이아웃 셸 z-[1020]: 동적 폼 z-1010 위, use:portal z-9999 아래 간섭 방지) -->
	<nav
		class="fixed bottom-0 left-0 right-0 z-[1020] flex h-16 w-full items-center justify-around border-t-2 border-slate-200 bg-white/95 px-2 backdrop-blur-md shadow-[0_-8px_24px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
		aria-label="모바일 하단 퀵 메뉴"
	>
		<!-- 1. 홈 (대시보드) -->
		<a
			href="/v1"
			onclick={() => {
				isRightOpen = false;
				if (isMobile) isLeftOpen = false;
			}}
			class="group flex flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-colors {isActive('/v1')
				? 'text-blue-600 bg-blue-50/70'
				: 'text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon={isActive('/v1') ? 'ph:house-fill' : 'ph:house-bold'} class="h-5 w-5 transition-transform group-active:scale-90" />
			<span class="mt-0.5 text-[10px] font-black tracking-tighter">홈</span>
		</a>

		<!-- 2. 전체 메뉴 (좌측 사이드바 토글) -->
		<button
			type="button"
			onclick={() => {
				isRightOpen = false;
				toggleLeft();
			}}
			class="group flex flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-colors {isLeftOpen
				? 'text-blue-600 bg-blue-50/70'
				: 'text-slate-500 hover:text-slate-900'}"
			aria-label="전체 메뉴 열기"
		>
			<Icon icon="ph:list-bold" class="h-5 w-5 transition-transform group-active:scale-90" />
			<span class="mt-0.5 text-[10px] font-black tracking-tighter">메뉴</span>
		</button>

		<!-- 3. 핵심 업무: 배차/스케줄 바로가기 -->
		<a
			href="/v1/pages/schedule"
			onclick={() => {
				isRightOpen = false;
				if (isMobile) isLeftOpen = false;
			}}
			class="group flex flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-colors {isActive('/v1/pages/schedule')
				? 'text-blue-600 bg-blue-50/70'
				: 'text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon={isActive('/v1/pages/schedule') ? 'ph:calendar-check-fill' : 'ph:calendar-check-bold'} class="h-5 w-5 transition-transform group-active:scale-90" />
			<span class="mt-0.5 text-[10px] font-black tracking-tighter">스케줄</span>
		</a>

		<!-- 4. 동적 폼 / 워크스페이스 (한번 더 누르면 닫힘 토글) -->
		<button
			type="button"
			onclick={() => {
				if (isMobile) isLeftOpen = false;
				toggleRight();
			}}
			class="group relative flex flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-colors {isRightOpen
				? 'text-blue-600 bg-blue-50/70'
				: 'text-slate-500 hover:text-slate-900'}"
			aria-label={isRightOpen ? '동적 폼 닫기' : '동적 폼 열기'}
		>
			<div class="relative flex items-center justify-center">
				<Icon icon="ph:magic-wand-fill" class="h-5 w-5 transition-transform group-active:scale-90" />
				{#if miniappStore.counts.TOTAL > 0}
					<span class="pointer-events-none absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs">
						{miniappStore.counts.TOTAL > 99 ? '99+' : miniappStore.counts.TOTAL}
					</span>
				{/if}
			</div>
			<span class="mt-0.5 text-[10px] font-black tracking-tighter">동적 폼</span>
		</button>

		<!-- 5. 내 정보 (프로필 바로가기) -->
		<a
			href="/v1/pages/profile"
			onclick={() => {
				isRightOpen = false;
				if (isMobile) isLeftOpen = false;
			}}
			class="group flex flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-colors {isActive('/v1/pages/profile')
				? 'text-blue-600 bg-blue-50/70'
				: 'text-slate-500 hover:text-slate-900'}"
		>
			{#if auth.user}
				<div class="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white transition-transform group-active:scale-90">
					{(auth.user.real_name || auth.user.username || '?')[0]}
				</div>
			{:else}
				<Icon icon="ph:user-bold" class="h-5 w-5 transition-transform group-active:scale-90" />
			{/if}
			<span class="mt-0.5 text-[10px] font-black tracking-tighter">내 정보</span>
		</a>
	</nav>
</div>

<!-- 🍱 동적 폼 (독립 컴포넌트: Scrim 포함) -->
<DynamicSidebar {isMobile} isOpen={isRightOpen} {isMounted} onClose={toggleRight} />

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: rgba(15, 23, 42, 0.15) transparent;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(15, 23, 42, 0.15);
		border-radius: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(15, 23, 42, 0.3);
	}
	.custom-scrollbar-dark::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.05);
	}
</style>
