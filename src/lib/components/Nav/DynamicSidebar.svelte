<script>
	/**
	 * @file src/lib/components/Nav/DynamicSidebar.svelte
	 * @description [v1.1] 모바일 슬라이딩 가동 보증 (좌표 및 트랜지션 초기화 최적화)
	 */
	import Icon from '@iconify/svelte';
	import { navState } from '$lib/runes/nav.svelte.js';
	import { auth } from '$lib/runes/auth.svelte.js';

	/**
	 * @typedef {Object} Props
	 * @property {boolean} [isMobile] - 모바일 환경 여부
	 * @property {boolean} [isOpen] - 사이드바 열림 상태
	 * @property {import('svelte/elements').MouseEventHandler<HTMLElement>} [onClose] - 닫기 이벤트 핸들러
	 */
	let { isMobile = false, isOpen = false, onClose = () => {} } = $props();

	/** @type {Record<string|number, boolean>} */
	let openMenus = $state({});
	/** @param {any} id */
	function toggleMenu(id) {
		openMenus[id] = !openMenus[id];
	}
</script>

<!-- 📱/💻 오버레이 차단 배경 (Root-level Scrim) -->
{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="animate-fade-in fixed inset-0 z-[9998] bg-slate-950/40 backdrop-blur-[4px] transition-opacity"
		onclick={onClose}
		aria-label="동적 폼 닫기 배경"
	></div>
{/if}

<!-- ➡️ 우측 동적 폼 사이드바 (분리 전 완벽 작동 로직 복원) -->
<aside
	class="fixed z-[9999] overflow-hidden bg-white text-slate-900 shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.4)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          {isMobile
		? 'top-0 right-0 bottom-0 left-0 h-full rounded-t-[3.5rem] border-t-8 border-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]'
		: 'top-20 right-0 bottom-0 w-[450px] border-l-4 border-slate-900'} 
          {isOpen
		? isMobile
			? 'translate-y-[0%]'
			: 'translate-x-0'
		: isMobile
			? 'translate-y-full'
			: 'translate-x-full'}"
	aria-label="동적 폼 사이드바 패널"
>
	<div
		class="custom-scrollbar flex h-full w-full flex-col divide-y divide-slate-100 overflow-y-auto px-2 pb-40"
	>
		<!-- [0] 헤더 및 닫기 버튼 -->
		<header
			class="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-slate-100 bg-slate-50/50 p-8 backdrop-blur-md md:p-10"
		>
			<div class="flex flex-col">
				<span
					class="mb-2 text-[10px] leading-none font-black tracking-widest text-slate-400 uppercase underline decoration-slate-200 underline-offset-4"
					>Interactive Panel</span
				>
				<h2
					class="text-3xl leading-none font-black tracking-tighter text-slate-900 uppercase italic"
				>
					Dynamic Form
				</h2>
			</div>
			<button
				class="btn btn-circle transform border border-slate-200 bg-white shadow-sm btn-ghost transition-all btn-sm hover:bg-slate-900 hover:text-white active:scale-95"
				onclick={onClose}
				aria-label="사이드바 닫기"
			>
				<Icon icon="ph:x-bold" class="h-5 w-5 text-slate-500 group-hover:text-white" />
			</button>
		</header>

		<!-- [1] 상단 구역: Context Action (본문 전용 메뉴) -->
		<section class="flex flex-col gap-6 p-10">
			<h3
				class="mb-2 flex items-center gap-3 text-[11px] font-black tracking-widest text-emerald-600 uppercase italic underline underline-offset-8"
			>
				<Icon icon="ph:lightning-fill" class="h-5 w-5" /> [01] Contextual Entry
			</h3>
			{#if navState.pageMenus && navState.pageMenus.length > 0}
				<div class="grid grid-cols-1 gap-3">
					{#each navState.pageMenus as pc (pc.title + pc.url)}
						<a
							href={pc.url}
							class="group flex items-center justify-between rounded-[2.5rem] border border-slate-100 bg-slate-50 p-6 shadow-sm transition-all hover:bg-black hover:text-white"
						>
							<span class="text-sm font-black tracking-tighter uppercase italic">{pc.title}</span>
							<Icon
								icon="ph:caret-right-bold"
								class="h-4 w-4 opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-100"
							/>
						</a>
					{/each}
				</div>
			{:else}
				<div
					class="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/5 py-24 text-slate-300"
				>
					<Icon icon="ph:circles-three-plus-duotone" class="mb-5 h-16 w-16 opacity-10" />
					<p
						class="text-center text-[10px] leading-relaxed font-black tracking-widest uppercase opacity-30"
					>
						Standby Mode <br /> No contextual tools injected
					</p>
				</div>
			{/if}
		</section>

		<!-- [2] 중단 구역: Admin Navigation (레이아웃 네비게이션) -->
		<section class="flex flex-col gap-4 p-10">
			<div class="mb-4 flex items-center justify-between">
				<h3
					class="flex items-center gap-3 text-[11px] font-black tracking-widest text-blue-600 uppercase italic underline underline-offset-8"
				>
					<Icon icon="ph:grid-four-fill" class="h-5 w-5" /> [02] Navigation Suite
				</h3>
			</div>
			{#if navState.menus && navState.menus.length > 0}
				<div class="flex flex-col gap-2">
					{#each navState.menus as m, i (m.id || i)}
						<button
							class="group flex h-16 w-full items-center justify-between rounded-2xl bg-slate-50 p-4 px-6 text-[11px] font-black tracking-tighter text-slate-500 uppercase italic shadow-sm transition-all hover:bg-slate-900 hover:text-white"
							onclick={() => toggleMenu(m.id)}
						>
							<span class="flex items-center gap-3">
								<Icon
									icon={m.icon_name || 'ph:folder-fill'}
									class="h-5 w-5 {openMenus[m.id]
										? 'text-blue-500'
										: 'opacity-40'} group-hover:text-white"
								/>
								{m.title}
							</span>
							<Icon
								icon="ph:caret-down-bold"
								class="text-[8px] {openMenus[m.id] ? 'rotate-180 text-blue-500' : ''}"
							/>
						</button>
						{#if openMenus[m.id]}
							<div
								class="mx-2 mb-4 flex flex-col rounded-2xl border-l-4 border-slate-300 bg-slate-100/50 p-2 transition-all"
							>
								{#each m.sub_menus || [] as sub, si (sub.external_url || si)}
									<a
										href={sub.external_url}
										class="border-b border-white p-4 px-8 text-[10px] font-black tracking-tighter text-slate-500 uppercase italic transition-all last:border-none hover:text-blue-600"
									>
										{sub.title}
									</a>
								{/each}
							</div>
						{/if}
					{/each}
					<!-- Media Dashboard 추가 -->
					<a
						href="/v1/admin/media"
						class="group flex h-16 w-full items-center rounded-2xl bg-indigo-50 p-4 px-6 text-[11px] font-black tracking-tighter text-indigo-600 uppercase italic shadow-sm transition-all hover:bg-indigo-600 hover:text-white"
					>
						<span class="flex items-center gap-3">
							<Icon icon="ph:database-fill" class="h-5 w-5 opacity-40 group-hover:text-white" />
							Media Dashboard
						</span>
					</a>
				</div>
			{/if}
		</section>

		<!-- [3] 하단 구역: System Core (로그아웃 통합) -->
		<section class="flex flex-col gap-6 bg-slate-50/30 p-10">
			<h3
				class="mb-2 flex items-center gap-3 text-[11px] font-black tracking-widest text-slate-400 uppercase italic underline underline-offset-8"
			>
				<Icon icon="ph:power-fill" class="h-5 w-5" /> [03] System Console
			</h3>
			<div class="grid grid-cols-2 gap-4">
				{#if auth.user}
					<div class="block w-full">
						<a
							href="/v1/pages/profile"
							class="group flex w-full flex-col items-center gap-4 rounded-[3rem] border border-slate-200 bg-white p-6 text-center shadow-sm transition-all hover:bg-slate-900 hover:text-white"
						>
							<Icon icon="ph:user-focus-bold" class="h-8 w-8 text-slate-300 group-hover:text-white" />
							<span class="text-[9px] font-black tracking-tight uppercase">My Profile</span>
						</a>
					</div>
					<div class="block w-full">
						<a
							href="/logout"
							data-sveltekit-reload
							class="group flex w-full flex-col items-center gap-4 rounded-[3rem] border border-rose-200 bg-rose-50 p-6 text-center shadow-sm transition-all hover:bg-rose-600 hover:text-white"
						>
							<Icon icon="ph:sign-out-bold" class="h-8 w-8 text-rose-300 group-hover:text-white" />
							<span class="text-[9px] font-black tracking-tight uppercase">Logout System</span>
						</a>
					</div>
				{/if}
			</div>
		</section>
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
		background: rgba(0, 0, 0, 0.05);
	}
	.custom-scrollbar:hover::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.1);
	}

	.animate-fade-in {
		animation: fadeIn 0.4s ease-out forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	:global(.btn) {
		border-radius: 0;
	}
</style>
