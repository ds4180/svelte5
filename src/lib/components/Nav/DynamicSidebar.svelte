<script>
	/**
	 * @file src/lib/components/Nav/DynamicSidebar.svelte
	 * @description [v1.1] 모바일 슬라이딩 가동 보증 (좌표 및 트랜지션 초기화 최적화)
	 */
	import Icon from '@iconify/svelte';
	import SmartIcon from '$lib/components/SmartIcon.svelte';
	import { navState } from '$lib/runes/nav.svelte';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { miniappStore } from '$lib/runes/miniapps.svelte';
	import { unsubscribePushOnLogout } from '$lib/pwa/serviceWorker';
	import { goto } from '$app/navigation';

	// 📌 상위 Root 레이아웃에서 주입된 요청별 안전 인증 Context를 가져옵니다.
	const auth = getAuthContext();

	/**
	 * @typedef {Object} Props
	 * @property {boolean} [isMobile] - 모바일 환경 여부
	 * @property {boolean} [isOpen] - 사이드바 열림 상태
	 * @property {boolean} [isMounted] - 초기 마운트 완료 여부 (초기 로딩 애니메이션 튐 방지)
	 * @property {() => void} [onClose] - 닫기 이벤트 핸들러
	 */
	/** @type {Props} */
	let { isMobile = false, isOpen = false, isMounted = false, onClose = () => {} } = $props();

	/** @param {string} tab */
	function navigateTo(tab) {
		goto(`/v1/pages/miniapps?tab=${tab}`);
		onClose();
	}

	/** @type {Record<string|number, boolean>} */
	let openMenus = $state({});
	/** @param {any} id */
	function toggleMenu(id) {
		openMenus[id] = !openMenus[id];
	}
</script>

<!-- 📱/💻 오버레이 차단 배경 (Root-level Scrim: 레이아웃 셸 계층 z-[1005]) -->
{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="animate-fade-in fixed inset-0 z-[1005] bg-slate-950/40 backdrop-blur-[4px] transition-opacity"
		onclick={onClose}
		aria-label="동적 폼 닫기 배경"
	></div>
{/if}

<!-- ➡️ 우측 동적 폼 사이드바 (레이아웃 셸 계층 z-[1010]: 하단 퀵메뉴 z-[1020] 아래, 포탈 모달 z-[9999] 아래) -->
<aside
	class="fixed z-[1010] overflow-hidden bg-slate-50 text-slate-900
          {isMounted ? 'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]' : 'transition-none'}
          {isMobile
		? 'top-0 right-0 bottom-0 left-0 h-full rounded-t-3xl border-t-4 border-slate-900'
		: 'top-16 right-0 bottom-0 w-[440px] border-l-4 border-slate-900'} 
          {isOpen
		? 'translate-x-0 translate-y-0 ' + (isMobile ? 'shadow-[0_-20px_50px_rgba(15,23,42,0.4)]' : 'shadow-[-20px_0_60px_-15px_rgba(15,23,42,0.25)]')
		: (isMobile ? 'translate-x-0 translate-y-[110%] shadow-none pointer-events-none' : 'translate-x-full translate-y-0 shadow-none pointer-events-none')}"
	aria-label="동적 폼 사이드바 패널"
>
	<div
		class="custom-scrollbar flex h-full w-full flex-col overflow-y-auto pb-28 md:pb-12"
	>
		<!-- [0] 모던 패널 헤더 및 닫기 버튼 -->
		<header
			class="sticky top-0 z-10 flex flex-none items-center justify-between border-b-2 border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-md sm:px-6 sm:py-5"
		>
			<div class="flex flex-col">
				<div class="mb-1.5 flex items-center gap-2">
					<span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-blue-700 uppercase">
						<Icon icon="ph:magic-wand-bold" class="text-xs" />
						Interactive Workspace
					</span>
				</div>
				<h2 class="text-2xl leading-none font-black tracking-tighter text-slate-900 uppercase italic">
					Dynamic <span class="not-italic text-blue-600">Form</span>
				</h2>
			</div>
			<button
				type="button"
				class="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
				onclick={onClose}
				aria-label="사이드바 닫기"
			>
				<Icon icon="ph:x-bold" class="h-5 w-5" />
			</button>
		</header>

		<div class="flex flex-col gap-6 p-5 sm:p-6">
			<!-- [1] 상단 구역: Context Action (본문 전용 메뉴) -->
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<h3 class="flex items-center gap-2 text-xs font-black tracking-widest text-emerald-700 uppercase">
						<span class="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
							<Icon icon="ph:lightning-fill" class="h-3.5 w-3.5" />
						</span>
						Contextual Entry
					</h3>
					{#if navState.pageMenus && navState.pageMenus.length > 0}
						<span class="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
							{navState.pageMenus.length}개 활성
						</span>
					{/if}
				</div>

				{#if navState.pageMenus && navState.pageMenus.length > 0}
					<div class="grid grid-cols-1 gap-2.5">
						{#each navState.pageMenus as pc (pc.title + (pc.url || pc.path))}
							<a
								href={pc.url || pc.path || '#'}
								onclick={onClose}
								class="group flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-blue-500 hover:shadow-md"
							>
								<div class="flex items-center gap-3">
									<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
										<SmartIcon
											icon={pc.icon || pc.icon_name}
											fallback="ph:lightning-fill"
											class="h-4.5 w-4.5"
											emojiClass="text-base leading-none"
										/>
									</div>
									<span class="text-sm font-black tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors">
										{pc.title}
									</span>
								</div>
								<div class="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all group-hover:bg-blue-600 group-hover:text-white">
									<Icon icon="ph:caret-right-bold" class="h-3.5 w-3.5" />
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div
						class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/70 py-10 text-center"
					>
						<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
							<Icon icon="ph:circles-three-plus-duotone" class="h-7 w-7" />
						</div>
						<p class="text-xs font-bold text-slate-500">대기 모드 (Standby)</p>
						<p class="mt-0.5 text-[11px] font-medium text-slate-400">현재 화면에 주입된 보조 도구가 없습니다.</p>
					</div>
				{/if}
			</section>

			<!-- [2] 중단 구역: Workspace Apps (알림, 알람, 지시사항, 메모, 메세지) -->
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<h3 class="flex items-center gap-2 text-xs font-black tracking-widest text-blue-700 uppercase">
						<span class="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
							<Icon icon="ph:briefcase-fill" class="h-3.5 w-3.5" />
						</span>
						Workspace Apps
					</h3>
					{#if miniappStore.counts.TOTAL > 0}
						<span class="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-black text-rose-600">
							미결 {miniappStore.counts.TOTAL}건
						</span>
					{/if}
				</div>

				<div class="flex flex-col gap-2.5">
					<button
						type="button"
						onclick={() => navigateTo('notifications')}
						class="group flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-blue-400 hover:shadow-md active:scale-[0.99]"
					>
						<div class="flex items-center gap-3.5">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
								<Icon icon="ph:bell-ringing-fill" class="h-5 w-5" />
							</div>
							<div class="text-left">
								<span class="block text-sm font-black text-slate-900">알림 센터</span>
								<span class="block text-[11px] font-medium text-slate-400">전사 공지 및 시스템 알림</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if miniappStore.counts.NOTIFICATION > 0}
								<span class="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
									{miniappStore.counts.NOTIFICATION}
								</span>
							{/if}
							<Icon icon="ph:caret-right-bold" class="text-xs text-slate-400 group-hover:text-blue-600 transition-colors" />
						</div>
					</button>

					<button
						type="button"
						onclick={() => navigateTo('alarms')}
						class="group flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-rose-400 hover:shadow-md active:scale-[0.99]"
					>
						<div class="flex items-center gap-3.5">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition-colors group-hover:bg-rose-600 group-hover:text-white">
								<Icon icon="ph:alarm-fill" class="h-5 w-5" />
							</div>
							<div class="text-left">
								<span class="block text-sm font-black text-slate-900">긴급 알람</span>
								<span class="block text-[11px] font-medium text-slate-400">일정 및 리마인더 경보</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if miniappStore.counts.ALARM > 0}
								<span class="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
									{miniappStore.counts.ALARM}
								</span>
							{/if}
							<Icon icon="ph:caret-right-bold" class="text-xs text-slate-400 group-hover:text-rose-600 transition-colors" />
						</div>
					</button>

					<button
						type="button"
						onclick={() => navigateTo('instructions')}
						class="group flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-emerald-400 hover:shadow-md active:scale-[0.99]"
					>
						<div class="flex items-center gap-3.5">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
								<Icon icon="ph:clipboard-text-fill" class="h-5 w-5" />
							</div>
							<div class="text-left">
								<span class="block text-sm font-black text-slate-900">업무 지시사항</span>
								<span class="block text-[11px] font-medium text-slate-400">전달된 업무 확인 및 처리</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if miniappStore.counts.INSTRUCTION > 0}
								<span class="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
									{miniappStore.counts.INSTRUCTION}
								</span>
							{/if}
							<Icon icon="ph:caret-right-bold" class="text-xs text-slate-400 group-hover:text-emerald-600 transition-colors" />
						</div>
					</button>

					<button
						type="button"
						onclick={() => navigateTo('memo')}
						class="group flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-amber-400 hover:shadow-md active:scale-[0.99]"
					>
						<div class="flex items-center gap-3.5">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white">
								<Icon icon="ph:notepad-fill" class="h-5 w-5" />
							</div>
							<div class="text-left">
								<span class="block text-sm font-black text-slate-900">개인 메모</span>
								<span class="block text-[11px] font-medium text-slate-400">빠른 기록 및 할 일 노트</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if miniappStore.counts.MEMO > 0}
								<span class="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
									{miniappStore.counts.MEMO}
								</span>
							{/if}
							<Icon icon="ph:caret-right-bold" class="text-xs text-slate-400 group-hover:text-amber-600 transition-colors" />
						</div>
					</button>

					<button
						type="button"
						onclick={() => navigateTo('messaging')}
						class="group flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md active:scale-[0.99]"
					>
						<div class="flex items-center gap-3.5">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
								<Icon icon="ph:paper-plane-tilt-fill" class="h-5 w-5" />
							</div>
							<div class="text-left">
								<span class="block text-sm font-black text-slate-900">사내 메세지</span>
								<span class="block text-[11px] font-medium text-slate-400">동료 간 실시간 1:1/그룹 쪽지</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if miniappStore.counts.MESSAGE > 0}
								<span class="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
									{miniappStore.counts.MESSAGE}
								</span>
							{/if}
							<Icon icon="ph:caret-right-bold" class="text-xs text-slate-400 group-hover:text-indigo-600 transition-colors" />
						</div>
					</button>
				</div>
			</section>

			<!-- [3] 하단 구역: System Console -->
			{#if auth.user}
				<section class="flex flex-col gap-3 pt-2">
					<h3 class="flex items-center gap-2 text-xs font-black tracking-widest text-slate-500 uppercase">
						<span class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
							<Icon icon="ph:power-fill" class="h-3.5 w-3.5" />
						</span>
						System Console
					</h3>
					<div class="grid grid-cols-2 gap-3">
						<a
							href="/v1/pages/profile"
							onclick={onClose}
							class="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white"
						>
							<Icon icon="ph:user-focus-bold" class="h-6 w-6 text-slate-500 transition-colors group-hover:text-white" />
							<span class="text-xs font-black tracking-tight">내 프로필</span>
						</a>

						<form
							method="POST"
							action="/logout"
							class="contents"
							onsubmit={() => {
								auth.clear();
								unsubscribePushOnLogout();
							}}
						>
							<button
								type="submit"
								class="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-center text-rose-700 shadow-sm transition-all hover:border-rose-600 hover:bg-rose-600 hover:text-white cursor-pointer"
							>
								<Icon icon="ph:sign-out-bold" class="h-6 w-6 text-rose-500 transition-colors group-hover:text-white" />
								<span class="text-xs font-black tracking-tight">로그아웃</span>
							</button>
						</form>
					</div>
				</section>
			{/if}
		</div>
	</div>
</aside>

<style>
	/* ✅ Svelte 내부 개별 스크롤바 커스텀 */
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(15, 23, 42, 0.12);
		border-radius: 4px;
	}
	.custom-scrollbar:hover::-webkit-scrollbar-thumb {
		background: rgba(15, 23, 42, 0.25);
	}

	.animate-fade-in {
		animation: fadeIn 0.3s ease-out forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
