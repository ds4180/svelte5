<script>
	/**
	 * @file (app)/+layout.svelte (Premium Dashboard: Modular Architecture)
	 * @description [v15.0] 우측 동적 폼을 독립 컴포넌트로 분리하여 레이아웃 가독성 및 유지보수성을 극대화한 버전
	 */
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { auth } from '$lib/runes/auth.svelte.js';
	import { navState } from '$lib/runes/nav.svelte.js';
	import DynamicSidebar from '$lib/components/Nav/DynamicSidebar.svelte';
	import '../layout.css';
	import Icon from '@iconify/svelte';

	let { data, children } = $props();

	// 컴포넌트 생성 시점에 상태 동기화
	untrack(() => {
		auth.setUser(data.user);
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

	onMount(() => {
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
		openMenus[menuId] = !openMenus[menuId];
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
	class="relative flex h-screen flex-col overflow-hidden bg-slate-50 font-['Noto_Sans_KR','Outfit'] text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-700"
>
	<!-- 🌐 Premium Navbar (Global Header) -->
	<header
		class="navbar z-[1001] h-20 flex-none border-b-4 border-slate-900 bg-white px-2 transition-all md:px-8 {isScrolled
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
		<div class="flex-1 px-4 sm:px-0">
			<a
				href="/"
				class="group border-none text-xl leading-none font-black tracking-tighter text-slate-900 uppercase italic md:text-3xl"
			>
				Jeju.Live <span
					class="NOT-ITALIC text-blue-600 decoration-4 underline-offset-4 group-hover:underline"
					>Admin</span
				>
			</a>
		</div>
		<div
			class="flex h-full flex-none items-center gap-2 border-slate-100 px-2 sm:border-l-2 sm:pl-6 md:gap-4"
		>
			<!-- 🔔 알림 설정 -->
			<button
				class="btn gap-2 rounded-none border-slate-300 p-2 px-3 text-[10px] font-black tracking-widest transition-all btn-outline btn-sm hover:bg-slate-900 hover:text-white"
				onclick={() => alertState.toggleQuietMode()}
			>
				<span class="relative flex h-2 w-2">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full {alertState.isQuietMode
							? 'bg-rose-400'
							: 'bg-emerald-400'} opacity-75"
					></span>
					<span
						class="relative inline-flex h-2 w-2 rounded-full {alertState.isQuietMode
							? 'bg-rose-500'
							: 'bg-emerald-500'}"
					></span>
				</span>
				<span class="hidden md:inline">{alertState.isQuietMode ? 'MUTE' : 'LIVE'}</span
				>
			</button>

			<!-- 👤 인증 (로그인/로그아웃) -->
			<div class="flex items-center">
				{#if auth.user}
					<a
						href="/logout"
						data-sveltekit-reload
						class="btn scale-90 rounded-none border-slate-900 px-4 text-[10px] font-black uppercase shadow-[4px_4px_0_0_#94a3b8] transition-all btn-outline btn-sm hover:border-rose-600 hover:bg-rose-600 hover:text-white sm:scale-100"
						aria-label="로그아웃 버튼"
					>
						<span class="hidden sm:inline">Sign Out</span>
						<Icon icon="ph:sign-out-bold" class="h-4 w-4 sm:hidden" />
					</a>
				{:else}
					<a
						href="/login"
						class="btn rounded-none border-none bg-slate-900 px-6 font-black tracking-widest text-white uppercase shadow-[4px_4px_0_0_#2563eb] transition-all btn-sm hover:bg-black"
						>Sign In</a
					>
				{/if}
			</div>

			<!-- 🍔 동적 폼 호출 -->
			<button
				class="group btn relative btn-square flex-none overflow-hidden rounded-none border-2 border-slate-900 btn-neutral"
				onclick={toggleRight}
				aria-label="동적 폼 열기"
			>
				<Icon icon="ph:magic-wand-fill" class="z-10 h-6 w-6" />
				{#if navState.pageMenus && navState.pageMenus.length > 0}
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

	<div class="relative flex flex-1 overflow-hidden">
		<!-- ⬅️ 왼쪽 네비게이션 사이드바 -->
		<aside
			class="z-[1000] flex-none overflow-hidden bg-slate-900 text-slate-300 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
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
												class="h-7 w-7 {openMenus[m.id] ? 'text-blue-500' : 'opacity-20'}"
											/>
											{m.title}
										</span>
										<Icon
											icon="ph:caret-down-bold"
											class="text-xs transition-transform duration-300 {openMenus[m.id]
												? 'rotate-180 text-blue-500'
												: ''}"
										/>
									</button>
									{#if openMenus[m.id]}
										<div class="mt-1 flex flex-col gap-1 transition-all">
											{#each m.sub_menus as sub, si (sub.external_url || si)}
												<a
													href={sub.external_url}
													class="flex items-center gap-6 px-10 py-4.5 text-base font-black tracking-tighter uppercase italic transition-all
                                                         {isActive(sub.external_url)
														? 'border-l-8 border-white bg-blue-600 text-white'
														: 'text-slate-500 hover:border-l-4 hover:border-slate-700 hover:bg-slate-800 hover:text-white'}"
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
			class="custom-scrollbar relative z-[100] flex flex-1 flex-col overflow-y-auto bg-slate-50 transition-all"
		>
			<div class="mx-auto min-h-full w-full max-w-[1700px] p-6 md:p-12 lg:p-20">
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
