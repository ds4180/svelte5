<script lang="ts">
	/**
	 * ============================================================================
	 * [프로젝트 소개 프레젠테이션 슬라이드 (/v1/pages/intro)]
	 * ============================================================================
	 * - 초등학생 눈높이에서 우리 버스 회사 웹앱 프로젝트를 쉽고 재미있게 소개하는
	 *   풀스크린 인터랙티브 프레젠테이션 덱입니다.
	 * - 키보드(← / → / Space / F), 버튼, 터치 스와이프를 모두 지원합니다.
	 */
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Slide01BandVsWebApp from './slides/Slide01BandVsWebApp.svelte';
	import Slide02CentralServer from './slides/Slide02CentralServer.svelte';
	import Slide03AnyDeviceAnytime from './slides/Slide03AnyDeviceAnytime.svelte';
	import Slide04AiEraInnovation from './slides/Slide04AiEraInnovation.svelte';
	import Slide05SweetFruit from './slides/Slide05SweetFruit.svelte';
	import Slide06TogetherFuture from './slides/Slide06TogetherFuture.svelte';

	interface SlideMeta {
		id: number;
		shortTitle: string;
		component: any;
	}

	const slides: SlideMeta[] = [
		{
			id: 1,
			shortTitle: '밴드로는 부족하다',
			component: Slide01BandVsWebApp
		},
		{
			id: 2,
			shortTitle: '서버로 정보를 한 곳에',
			component: Slide02CentralServer
		},
		{
			id: 3,
			shortTitle: '데탑·태블릿·스마트폰',
			component: Slide03AnyDeviceAnytime
		},
		{
			id: 4,
			shortTitle: '대 AI 시대, 10년의 혁신',
			component: Slide04AiEraInnovation
		},
		{
			id: 5,
			shortTitle: '6개월의 산고, 달콤한 열매',
			component: Slide05SweetFruit
		},
		{
			id: 6,
			shortTitle: '함께 만드는 스마트한 내일',
			component: Slide06TogetherFuture
		}
	];

	let currentIndex = $state(0);
	let isFullscreen = $state(false);
	let mainEl = $state<HTMLElement | null>(null);
	let touchStartX = 0;
	let touchStartY = 0;

	const totalSlides = $derived(slides.length);
	const currentSlide = $derived(slides[currentIndex]);
	const progressPercent = $derived(((currentIndex + 1) / totalSlides) * 100);

	$effect(() => {
		currentIndex;
		if (mainEl) mainEl.scrollTop = 0;
	});

	function goPrev() {
		if (currentIndex > 0) currentIndex -= 1;
	}

	function goNext() {
		if (currentIndex < totalSlides - 1) currentIndex += 1;
	}

	function goTo(index: number) {
		if (index >= 0 && index < totalSlides) currentIndex = index;
	}

	async function toggleFullscreen() {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			} else {
				await document.exitFullscreen();
			}
		} catch {
			// 브라우저 정책상 차단된 경우 무시
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

		if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
			if (currentIndex < totalSlides - 1) {
				e.preventDefault();
				goNext();
			}
		} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
			if (currentIndex > 0) {
				e.preventDefault();
				goPrev();
			}
		} else if (e.key === 'f' || e.key === 'F') {
			e.preventDefault();
			toggleFullscreen();
		}
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0]?.clientX ?? 0;
		touchStartY = e.changedTouches[0]?.clientY ?? 0;
	}

	function handleTouchEnd(e: TouchEvent) {
		const endX = e.changedTouches[0]?.clientX ?? 0;
		const endY = e.changedTouches[0]?.clientY ?? 0;
		const diffX = endX - touchStartX;
		const diffY = endY - touchStartY;
		// 세로 스크롤 중에는 좌우 슬라이드 전환이 오작동하지 않도록 가로 이동이 뚜렷할 때만 전환
		if (Math.abs(diffX) < 55 || Math.abs(diffX) < Math.abs(diffY) * 1.3) return;
		if (diffX < 0) goNext();
		else goPrev();
	}

	onMount(() => {
		const onFsChange = () => {
			isFullscreen = Boolean(document.fullscreenElement);
		};
		document.addEventListener('fullscreenchange', onFsChange);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('fullscreenchange', onFsChange);
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<svelte:head>
	<title>{getSiteTitle(`프로젝트 소개 - ${currentSlide.id}장. ${currentSlide.shortTitle}`)}</title>
</svelte:head>

<div
	class="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-linear-to-br from-sky-50 via-white to-amber-50 font-['Noto_Sans_KR','Outfit'] text-slate-900 select-none"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<!-- 상단 진행률 바 -->
	<div class="fixed top-0 left-0 right-0 z-50 h-1.5 bg-slate-200/70">
		<div
			class="h-full bg-linear-to-r from-sky-500 via-blue-600 to-indigo-600 transition-all duration-500"
			style:width="{progressPercent}%"
		></div>
	</div>

	<!-- 상단 플로팅 프레젠테이션 헤더 -->
	<header class="relative z-40 flex shrink-0 items-center justify-between px-4 pt-4 pb-2 sm:px-8">
		<div class="flex items-center gap-2.5">
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-black text-white shadow-sm"
			>
				<Icon icon="solar:bus-bold-duotone" class="text-base text-sky-400" />
				<span>우리 회사 웹앱 이야기</span>
			</span>
			<span
				class="hidden rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-extrabold text-sky-700 shadow-xs sm:inline-flex"
			>
				{String(currentSlide.id).padStart(2, '0')}장 · {currentSlide.shortTitle}
			</span>
		</div>

		<div class="flex items-center gap-2">
			<span
				class="rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-slate-600 shadow-xs ring-1 ring-slate-200"
			>
				{currentIndex + 1} / {totalSlides}
			</span>
			<button
				type="button"
				onclick={toggleFullscreen}
				title="전체화면 전환 (단축키 F)"
				class="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-slate-700 shadow-xs ring-1 ring-slate-200 transition hover:bg-slate-900 hover:text-white"
			>
				<Icon
					icon={isFullscreen ? 'solar:quit-full-screen-bold' : 'solar:full-screen-bold'}
					class="text-sm"
				/>
				<span class="hidden sm:inline">{isFullscreen ? '창 모드' : '전체화면'}</span>
			</button>
			<a
				href="/v1"
				title="홈으로 돌아가기"
				class="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-slate-700 shadow-xs ring-1 ring-slate-200 transition hover:bg-blue-600 hover:text-white"
			>
				<Icon icon="solar:home-2-bold" class="text-sm" />
				<span class="hidden sm:inline">홈</span>
			</a>
		</div>
	</header>

	<!-- 메인 슬라이드 캔버스 (모바일 세로 스크롤 지원, 데스크톱 중앙 정렬) -->
	<main
		bind:this={mainEl}
		class="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain"
	>
		<div class="flex min-h-full w-full items-center justify-center px-4 py-3 sm:px-8 sm:py-4">
			{#key currentSlide.id}
				{@const ActiveSlide = currentSlide.component}
				<ActiveSlide onRestart={() => goTo(0)} />
			{/key}
		</div>
	</main>

	<!-- 하단 슬라이드 네비게이션 컨트롤 바 -->
	<footer class="relative z-40 flex shrink-0 items-center justify-between px-4 pt-2 pb-4 sm:px-8">
		<button
			type="button"
			onclick={goPrev}
			disabled={currentIndex === 0}
			class="inline-flex items-center gap-1.5 rounded-2xl bg-white/95 px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
		>
			<Icon icon="solar:alt-arrow-left-bold" class="text-base" />
			<span>이전 장</span>
		</button>

		<!-- 슬라이드 도트 인디케이터 -->
		<div class="flex items-center gap-2">
			{#each slides as s, idx (s.id)}
				<button
					type="button"
					onclick={() => goTo(idx)}
					title="{s.id}장. {s.shortTitle}"
					class="h-2.5 rounded-full transition-all {idx === currentIndex
						? 'w-8 bg-blue-600 shadow-sm'
						: 'w-2.5 bg-slate-300 hover:bg-slate-400'}"
				></button>
			{/each}
		</div>

		<button
			type="button"
			onclick={goNext}
			disabled={currentIndex === totalSlides - 1}
			class="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
		>
			<span>다음 장</span>
			<Icon icon="solar:alt-arrow-right-bold" class="text-base" />
		</button>
	</footer>
</div>
