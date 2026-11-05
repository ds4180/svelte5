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
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { getAuthContext } from '$lib/runes/auth.svelte.js'; // 최상위 Root가 주입한 안전 인증 Context 사용
	import { navState } from '$lib/runes/nav.svelte.js';
	import { miniappStore } from '$lib/runes/miniapps.svelte.js';
	import { websocket } from '$lib/runes/websocket.svelte.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import DynamicSidebar from '$lib/components/Nav/DynamicSidebar.svelte';
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

	// --- [상태 관리] ---
	let isLeftOpen = $state(true);
	let isRightOpen = $state(false);
	let isScrolled = $state(false);
	/** @type {Record<string|number, boolean>} */
	let openMenus = $state({});
	let isMounted = $state(false);
	let isMobile = $state(false);

	// 🌐 우측 상단 헤더 개편 상태 (사용자 팝업 메뉴, 실시간 네트워크/소켓 듀얼 감지, 풀스크린)
	let isUserMenuOpen = $state(false);
	let isWsMenuOpen = $state(false);
	let isOnline = $state(true);
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
	 */
	async function handleHardRefresh() {
		toast.info('캐시를 초기화하고 최신 버전을 동기화합니다...');
		try {
			if (typeof window !== 'undefined' && 'caches' in window) {
				const keys = await caches.keys();
				await Promise.all(keys.map(k => caches.delete(k)));
			}
		} catch (e) {
			console.warn('캐시 삭제 중 오류:', e);
		}
		window.location.reload();
	}

	onMount(() => {
		// 🛡️ [뷰포트 안전 보증] 브라우저 스크롤 좌표를 (0, 0) 원점으로 강제 고정
		if (typeof window !== 'undefined') {
			window.scrollTo(0, 0);
			isOnline = navigator.onLine;
			isFullscreen = !!document.fullscreenElement;
		}

		const handleOnline = () => {
			isOnline = true;
			websocket.init();
			toast.success('네트워크가 복구되었습니다. 실시간 동기화를 재개합니다.');
		};
		const handleOffline = () => {
			isOnline = false;
			toast.warning('인터넷 연결이 끊어졌습니다. (오프라인 캐시 모드)');
		};
		const handleFullscreenChange = () => {
			isFullscreen = !!document.fullscreenElement;
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
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

		setTimeout(() => {
			isMounted = true;
			updateMedia();
			if (data.menus) {
				data.menus.forEach((/** @type {any} */ m) => {
					if (openMenus[m.id] === undefined) openMenus[m.id] = true;
				});
			}
		}, 0);

		const handleScroll = () => {
			isScrolled = window.scrollY > 10;
		};
		window.addEventListener('scroll', handleScroll);
		window.addEventListener('resize', updateMedia);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', updateMedia);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
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
	class="relative flex h-screen max-h-screen w-full max-w-full flex-col overflow-hidden bg-slate-50 font-['Noto_Sans_KR','Outfit'] text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-700"
>
	<!-- 🌐 Premium Navbar (Global Header) -->
	<header
		class="navbar z-[1001] h-20 w-full max-w-full flex-none border-b-4 border-slate-900 bg-white px-2 transition-all md:px-6 {isScrolled
			? 'shadow-2xl'
			: ''}"
	>
		<div class="flex-none lg:pr-6">
			<button
				class="btn btn-square transform rounded-none border-2 border-slate-900 shadow-[4px_4px_0_0_#1e293b] btn-ghost transition-all hover:bg-slate-900 hover:text-white active:scale-95"
				onclick={toggleLeft}
				aria-label="메뉴 열기"
			>
				<Icon icon="ph:list-bold" class="h-6 w-6" />
			</button>
		</div>
		<div class="flex-1 min-w-0 px-2 sm:px-0">
			<a
				href="/"
				class="group inline-flex items-center truncate border-none text-xl leading-none font-black tracking-tighter text-slate-900 uppercase italic md:text-3xl"
			>
				Jeju.Live <span
					class="ml-1 NOT-ITALIC text-blue-600 decoration-4 underline-offset-4 group-hover:underline"
					>Admin</span
				>
			</a>
		</div>
		<div
			class="flex h-full flex-none items-center gap-2 border-slate-100 pl-2 pr-1 sm:border-l-2 sm:pl-4 sm:pr-2 md:gap-3"
		>
			<!-- 🌐 1. 실시간 네트워크 & 웹소켓 3단 상태 인디케이터 (LIVE / CACHED / OFFLINE) -->
			<div class="relative">
				<button
					type="button"
					onclick={() => (isWsMenuOpen = !isWsMenuOpen)}
					class="flex items-center gap-2 border-2 border-slate-900 bg-white px-2.5 py-1 text-left shadow-[2px_2px_0_0_#0f172a] transition-all hover:bg-slate-50 active:scale-95 sm:px-3 sm:py-1.5"
					aria-label="네트워크 및 웹소켓 상태 상세 보기"
				>
					<!-- 상태 아이콘 & 펄스 박스 (H-7 W-7 사용자 아바타와 규격 통일) -->
					<div
						class="flex h-7 w-7 items-center justify-center rounded border {
							!isOnline
								? 'bg-rose-50 border-rose-200 text-rose-600'
								: websocket.status === 'connected'
									? 'bg-emerald-50 border-emerald-200 text-emerald-600'
									: 'bg-amber-50 border-amber-200 text-amber-600'
						}"
					>
						{#if !isOnline}
							<Icon icon="ph:wifi-slash-bold" class="text-sm" />
						{:else if websocket.status === 'connected'}
							<span class="relative flex h-2.5 w-2.5">
								<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
							</span>
						{:else}
							<Icon icon="ph:arrows-clockwise-bold" class="text-sm animate-spin text-amber-600" />
						{/if}
					</div>

					<!-- 2줄 텍스트 구조 (사용자 프로필 뱃지와 동일 위계) -->
					<div class="hidden flex-col md:flex">
						<span class="text-xs font-black leading-none {
							!isOnline
								? 'text-rose-700'
								: websocket.status === 'connected'
									? 'text-emerald-700'
									: 'text-amber-700'
						}">
							{!isOnline ? 'OFFLINE' : websocket.status === 'connected' ? 'LIVE (실시간)' : 'CACHED (캐시)'}
						</span>
						<span class="mt-0.5 text-[10px] font-bold text-slate-400 leading-none">
							{!isOnline ? '인터넷 단절' : websocket.status === 'connected' ? '소켓 실시간 동기화' : '소켓 재연결 중...'}
						</span>
					</div>

					<Icon icon="ph:caret-down-bold" class="text-xs text-slate-500 transition-transform {isWsMenuOpen ? 'rotate-180' : ''}" />
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

					<!-- 웹소켓 상세 관제 팝업 (모바일 반응형 잘림 방지: 모바일 fixed inset-x-4, 데스크톱 sm:absolute sm:right-0) -->
					<div
						class="fixed inset-x-4 top-22 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full z-[1003] sm:mt-2 w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 border-2 border-slate-900 bg-white p-3.5 shadow-[6px_6px_0_0_#0f172a] transition-all"
					>
						<div class="border-b border-slate-200 bg-slate-50/80 p-3 -m-3 mb-3">
							<div class="flex items-center justify-between">
								<span class="text-[9px] font-black tracking-widest text-slate-400 uppercase">Live Channel Monitor</span>
								<span class="inline-flex items-center gap-1.5 text-[10px] font-black {
									!isOnline
										? 'text-rose-600'
										: websocket.status === 'connected'
											? 'text-emerald-600'
											: 'text-amber-600'
								}">
									<span class="h-1.5 w-1.5 rounded-full {
										!isOnline
											? 'bg-rose-500'
											: websocket.status === 'connected'
												? 'bg-emerald-500'
												: 'bg-amber-500 animate-pulse'
									}"></span>
									{!isOnline ? '인터넷 단절' : websocket.status === 'connected' ? '동기화 연결됨' : '재연결 대기'}
								</span>
							</div>
							<div class="mt-1 font-mono text-xs font-bold text-slate-800 break-all">
								/ws (Enterprise Socket)
							</div>
						</div>

						<div class="space-y-2 py-1 text-xs">
							<div class="flex items-center justify-between text-slate-600">
								<span>단말기 네트워크:</span>
								<span class="font-bold {isOnline ? 'text-emerald-600' : 'text-rose-600'}">
									{isOnline ? '온라인 (Connected)' : '오프라인 (Disconnected)'}
								</span>
							</div>
							<div class="flex items-center justify-between text-slate-600">
								<span>소켓 채널 상태:</span>
								<span class="font-mono font-bold uppercase {
									websocket.status === 'connected' ? 'text-emerald-600' : 'text-amber-600'
								}">
									{websocket.status}
								</span>
							</div>
							<div class="rounded bg-slate-50 p-2 text-[11px] text-slate-500 leading-relaxed border border-slate-100">
								{#if !isOnline}
									단말기 인터넷 연결이 끊겨 오프라인 상태입니다. 기존 캐싱된 데이터가 표출됩니다.
								{:else if websocket.status === 'connected'}
									실시간 웹소켓이 안정적으로 연결되어 사내 공지 및 변경사항이 0.1초 이내로 동기화됩니다.
								{:else}
									웹소켓 연결이 일시 지연 중입니다. 브라우저에 캐싱된 데이터가 표출될 수 있습니다.
								{/if}
							</div>
						</div>

						<div class="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
							<button
								type="button"
								onclick={() => {
									isWsMenuOpen = false;
									if (!isOnline) {
										toast.warning('인터넷 연결이 필요합니다.');
									} else {
										websocket.init();
										toast.info('웹소켓 재연결을 시도합니다...');
									}
								}}
								class="flex items-center justify-center gap-2 rounded bg-slate-900 py-2 text-xs font-black text-white hover:bg-blue-600 transition"
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
								class="flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition"
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
						class="flex items-center gap-2 border-2 border-slate-900 bg-white px-2.5 py-1 text-left shadow-[2px_2px_0_0_#0f172a] transition-all hover:bg-slate-50 active:scale-95 sm:px-3 sm:py-1.5"
						aria-label="사용자 계정 팝업 메뉴"
					>
						<!-- 직급 아바타 이니셜 -->
						<div class="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-xs font-black text-white">
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
						<Icon icon="ph:caret-down-bold" class="text-xs text-slate-500 transition-transform {isUserMenuOpen ? 'rotate-180' : ''}" />
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

						<!-- 사용자 계정 팝업 메뉴 (모바일 반응형 잘림 방지: 모바일 fixed inset-x-4, 데스크톱 sm:absolute sm:right-0) -->
						<div
							class="fixed inset-x-4 top-22 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full z-[1003] sm:mt-2 w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 border-2 border-slate-900 bg-white p-2.5 shadow-[6px_6px_0_0_#0f172a] transition-all"
						>
							<!-- [A] 사용자 기본 정보 & 보안 접속 기기 헤더 -->
							<div class="border-b border-slate-200 bg-slate-50/80 p-3">
								<div class="flex items-center justify-between">
									<span class="text-[9px] font-black tracking-widest text-slate-400 uppercase">Signed in Account</span>
									<span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
										<Icon icon={isMobile ? "ph:device-mobile-bold" : "ph:desktop-bold"} class="text-xs" />
										{isMobile ? '모바일' : '데스크톱'}
									</span>
								</div>
								<div class="mt-1 flex items-baseline gap-1 font-black text-slate-900 text-sm">
									{auth.user.real_name || auth.user.username}
									<span class="text-xs font-normal text-slate-400">(@{auth.user.username})</span>
								</div>
								<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
									<span class="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
										{auth.user.role_name || getUserRankLabel(auth.user.rank_level)}
									</span>
									{#if auth.user.primary_group}
										<span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
											{auth.user.primary_group}
										</span>
									{/if}
								</div>
							</div>

							<!-- [B] 팝업 제어 메뉴 목록 -->
							<div class="py-2 flex flex-col gap-1 text-xs">
								<!-- 🔔 알림 수신 토글 (방해금지 MUTE / ON) -->
								<button
									type="button"
									onclick={() => alertState.toggleQuietMode()}
									class="flex w-full items-center justify-between px-3 py-2 font-bold text-slate-700 hover:bg-slate-100 transition rounded"
								>
									<span class="flex items-center gap-2">
										<Icon icon={alertState.isQuietMode ? "ph:bell-slash-bold" : "ph:bell-bold"} class="text-base {alertState.isQuietMode ? 'text-rose-500' : 'text-emerald-500'}" />
										알림 수신 모드
									</span>
									<span class="rounded px-2 py-0.5 text-[10px] font-black {alertState.isQuietMode ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
										{alertState.isQuietMode ? 'MUTE (음소거)' : 'LIVE (수신)'}
									</span>
								</button>

								<!-- 🖥️ 전체화면 (Fullscreen) 토글 -->
								<button
									type="button"
									onclick={() => { toggleFullscreen(); isUserMenuOpen = false; }}
									class="flex w-full items-center justify-between px-3 py-2 font-bold text-slate-700 hover:bg-slate-100 transition rounded"
								>
									<span class="flex items-center gap-2">
										<Icon icon={isFullscreen ? "ph:corners-in-bold" : "ph:corners-out-bold"} class="text-base text-slate-600" />
										전체화면 관제 모드
									</span>
									<span class="text-[10px] text-slate-400 font-normal">
										{isFullscreen ? '창모드 복귀' : 'F11 전체화면'}
									</span>
								</button>

								<!-- 🔄 PWA 캐시 강제 초기화 및 최신 동기화 -->
								<button
									type="button"
									onclick={() => { isUserMenuOpen = false; handleHardRefresh(); }}
									class="flex w-full items-center justify-between px-3 py-2 font-bold text-slate-700 hover:bg-slate-100 transition rounded"
								>
									<span class="flex items-center gap-2">
										<Icon icon="ph:arrow-clockwise-bold" class="text-base text-blue-600" />
										최신 캐시 동기화
									</span>
									<span class="text-[10px] text-slate-400 font-normal">Hard Refresh</span>
								</button>

								<!-- 👤 내 프로필 정보 -->
								<a
									href="/v1/pages/profile"
									onclick={() => (isUserMenuOpen = false)}
									class="flex items-center gap-2 px-3 py-2 font-bold text-slate-700 hover:bg-slate-100 transition rounded"
								>
									<Icon icon="ph:user-bold" class="text-base text-slate-500" />
									내 프로필 정보
								</a>

								<!-- 🛠️ 관리자 관제탑 (Lv.4 이상 또는 Root) -->
								{#if auth.isRoot || (auth.user?.rank_level ?? 0) >= 4}
									<a
										href="/v1/admin"
										onclick={() => (isUserMenuOpen = false)}
										class="flex items-center gap-2 px-3 py-2 font-bold text-slate-700 hover:bg-slate-100 transition rounded"
									>
										<Icon icon="ph:gear-six-bold" class="text-base text-slate-500" />
										관리자 관제탑 (/v1/admin)
									</a>
								{/if}
							</div>

							<!-- [C] 로그아웃 버튼 -->
							<div class="border-t border-slate-200 pt-2">
								<a
									href="/logout"
									data-sveltekit-reload
									class="flex w-full items-center justify-center gap-2 bg-rose-50 border border-rose-200 py-2 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white transition rounded"
								>
									<Icon icon="ph:sign-out-bold" class="text-sm" />
									로그아웃 (Sign Out)
								</a>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<a
					href="/login"
					class="btn rounded-none border-none bg-slate-900 px-5 font-black tracking-widest text-white uppercase shadow-[3px_3px_0_0_#2563eb] transition-all btn-sm hover:bg-black"
				>
					Sign In
				</a>
			{/if}

			<!-- 🍔 동적 폼 호출 (미니앱 통합 미결 뱃지 연동) -->
			<button
				class="group btn relative btn-square flex-none overflow-hidden rounded-none border-2 border-slate-900 btn-neutral"
				onclick={toggleRight}
				aria-label="동적 폼 열기"
				title={`미니앱 미결 업무: ${miniappStore.counts.TOTAL}건`}
			>
				<Icon icon="ph:magic-wand-fill" class="z-10 h-6 w-6" />
				{#if miniappStore.counts.TOTAL > 0}
					<span class="pointer-events-none absolute top-1 right-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-sm">
						<span class="relative">{miniappStore.counts.TOTAL > 99 ? '99+' : miniappStore.counts.TOTAL}</span>
					</span>
				{:else if navState.pageMenus && navState.pageMenus.length > 0}
					<span class="pointer-events-none absolute top-1 right-1 flex h-2 w-2">
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
		<!-- ⬅️ 왼쪽 네비게이션 사이드바 -->
		<aside
			class="z-[1000] flex-none h-full overflow-hidden bg-slate-900 text-slate-300 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                      {isMobile ? 'absolute top-0 bottom-0 left-0 h-full' : ''} 
                      {isLeftOpen ? 'w-72' : 'w-0'} border-r-4 border-black"
		>
			<div class="custom-scrollbar-dark flex h-full w-72 flex-col overflow-y-auto px-4 pt-12 pb-32">
				<div class="mb-2 ml-2 flex flex-col gap-1 border-l-4 border-blue-600 px-4">
					<span
						class="block text-[10px] leading-none font-black tracking-widest text-slate-600 uppercase"
						>Console System</span
					>
					<h2 class="text-xl leading-none font-black tracking-tighter text-white uppercase italic">
						Main Navigation
					</h2>
				</div>

				<nav class="mt-8 mb-20 flex flex-col gap-1 uppercase">
					{#if data.menus}
						{#each data.menus as m, i (m.id || i)}
							{#if m.sub_menus && m.sub_menus.length > 0}
								<div class="group mb-1 flex flex-col">
									<button
										type="button"
										class="flex h-15 w-full items-center justify-between border-b border-white/5 px-6 py-6 text-lg font-black tracking-tighter uppercase italic transition-all"
										onclick={() => toggleMenu(m.id)}
									>
										<span class="flex items-center gap-5">
											<Icon
												icon={m.icon_name || 'ph:folder-fill'}
												class="h-7 w-7 {(openMenus[m.id] ?? true) ? 'text-blue-500' : 'opacity-20'}"
											/>
											{m.title}
										</span>
										<Icon
											icon="ph:caret-down-bold"
											class="text-xs transition-transform duration-300 {(openMenus[m.id] ?? true)
												? 'rotate-180 text-blue-500'
												: ''}"
										/>
									</button>
									{#if (openMenus[m.id] ?? true)}
										<div class="mt-1 flex flex-col gap-1 transition-all">
											{#each m.sub_menus as sub, si (sub.id || si)}
												<a
													href={sub.external_url}
													class="flex items-center gap-6 px-10 py-4.5 text-base font-black tracking-tighter uppercase italic transition-all
                                                         {isActive(sub.external_url)
														? 'border-l-8 border-white bg-blue-600 text-white'
														: 'text-slate-400 hover:border-l-4 hover:border-slate-700 hover:bg-slate-800 hover:text-white'}"
												>
													<span>{sub.title}</span>
												</a>
											{/each}
										</div>
									{/if}
								</div>
							{:else}
								<a
									href={m.external_url || '#'}
									class="mb-1 flex items-center gap-6 px-6 py-6 text-xl font-black tracking-tighter uppercase italic transition-all
                                           {isActive(m.external_url)
										? 'border-l-8 border-white bg-blue-600 text-white shadow-xl'
										: 'text-slate-500 hover:border-l-4 hover:border-slate-700 hover:bg-slate-800 hover:text-white'}"
								>
									<Icon
										icon={m.icon_name || 'ph:rocket-fill'}
										class="h-8 w-8 {isActive(m.external_url) ? 'text-white' : 'opacity-30'}"
									/>
									{m.title}
								</a>
							{/if}
						{/each}
					{/if}
				</nav>
			</div>
		</aside>

		<!-- 🚀 가운데 본문 영역 -->
		<main
			class="custom-scrollbar relative z-[100] flex flex-1 min-w-0 min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-slate-50 transition-all"
		>
			<div class="mx-auto min-h-full w-full max-w-[1700px] p-4 sm:p-6 md:p-12 lg:p-20 min-w-0">
				{@render children?.()}
			</div>
		</main>
	</div>
</div>

<!-- 🍱 동적 폼 (독립 컴포넌트: Scrim 포함) -->
<DynamicSidebar {isMobile} isOpen={isRightOpen} onClose={toggleRight} />

<style>
	:global(.btn) {
		border-radius: 0;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar-dark::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.05);
	}
</style>
