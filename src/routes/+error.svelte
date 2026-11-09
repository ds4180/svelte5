<script>
	/**
	 * @file +error.svelte
	 * @description 전사 통합 에러 및 오프라인 자동 복구 화면 (PWA Standalone 최적화)
	 */
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { hardReset } from '$lib/pwa/serviceWorker.js';

	let isOnline = $state(true);
	let isRetrying = $state(false);

	onMount(() => {
		if (browser) {
			isOnline = navigator.onLine;

			const handleOnline = () => {
				isOnline = true;
				isRetrying = true;
				setTimeout(() => {
					window.location.reload();
				}, 600);
			};

			const handleOffline = () => {
				isOnline = false;
			};

			window.addEventListener('online', handleOnline);
			window.addEventListener('offline', handleOffline);

			// 능동 핑 폴링 (2.5초 간격으로 실제 패킷 통신 검증)
			const pingInterval = setInterval(async () => {
				if (!navigator.onLine) return;
				try {
					const res = await fetch('/favicon.png?_ping=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
					if (res.ok && !isOnline) {
						handleOnline();
					}
				} catch {
					// 패킷 미개통 상태 유지
				}
			}, 2500);

			return () => {
				window.removeEventListener('online', handleOnline);
				window.removeEventListener('offline', handleOffline);
				clearInterval(pingInterval);
			};
		}
	});

	function handleRetry() {
		isRetrying = true;
		window.location.reload();
	}

	function handleBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	}

	async function handleEmergencyReset() {
		if (confirm('캐시를 초기화하고 최신 버전을 다시 다운로드하시겠습니까?')) {
			try {
				await hardReset();
			} catch (e) {
				console.warn(e);
			}
			window.location.href = '/';
		}
	}

	const status = $derived(page.status || 500);
	const message = $derived(page.error?.message || '요청을 처리하는 도중 오류가 발생했습니다.');
	const isNetworkError = $derived(
		!isOnline ||
		message.toLowerCase().includes('fetch') ||
		message.toLowerCase().includes('network') ||
		status === 503 ||
		status === 504
	);
</script>

<svelte:head>
	<title>{status} {isNetworkError ? '오프라인' : '오류'} | jeju.live</title>
</svelte:head>

<div class="flex min-h-[85vh] flex-col items-center justify-center px-4 py-12 text-center select-none font-['Noto_Sans_KR','Outfit']">
	<div class="w-full max-w-md rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
		<!-- 🔴/🟢 네트워크 상태 뱃지 -->
		<div class="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase {isOnline ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}">
			<span class="h-2 w-2 rounded-full {isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-400 shadow-[0_0_8px_#fb7185] animate-pulse'}"></span>
			<span>{isOnline ? '온라인 연결됨' : '네트워크 연결 끊김'}</span>
		</div>

		<!-- 아이콘 -->
		<div class="mb-4 text-5xl">
			{#if isNetworkError}
				📡
			{:else if status === 404}
				🔍
			{:else}
				⚠️
			{/if}
		</div>

		<!-- 제목 -->
		<h1 class="mb-2 text-2xl font-black tracking-tight text-white">
			{#if isNetworkError}
				{isOnline ? '일시적 통신 지연' : '오프라인 모드'}
			{:else if status === 404}
				페이지를 찾을 수 없습니다
			{:else}
				시스템 안내 ({status})
			{/if}
		</h1>

		<!-- 설명 -->
		<p class="mb-8 text-sm font-medium leading-relaxed text-slate-400 word-break-keep-all">
			{#if isNetworkError}
				인터넷 연결이 원활하지 않습니다.<br />
				네트워크가 복구되면 <strong class="text-white">자동으로 이전 화면으로 복귀</strong>합니다.
			{:else}
				{message}
			{/if}
		</p>

		<!-- 버튼 그룹 (PWA 특화 대형 터치 UI) -->
		<div class="flex flex-col gap-3">
			<button
				type="button"
				onclick={handleRetry}
				disabled={isRetrying}
				class="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 active:scale-98 disabled:opacity-50"
			>
				{#if isRetrying}
					<span class="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
					<span>동기화 중...</span>
				{:else}
					<span>🔄 지금 다시 시도</span>
				{/if}
			</button>

			<div class="flex gap-2.5">
				<button
					type="button"
					onclick={handleBack}
					class="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-300 transition hover:bg-slate-700 active:scale-98"
				>
					<span>←</span> 이전 화면
				</button>

				<a
					href="/"
					class="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-slate-300 transition hover:bg-slate-700 active:scale-98"
				>
					<span>🏠</span> 홈으로
				</a>
			</div>

			<button
				type="button"
				onclick={handleEmergencyReset}
				class="mt-2 text-xs font-semibold text-slate-500 underline underline-offset-4 hover:text-slate-400"
			>
				🧹 캐시 강제 초기화 후 첫 화면 이동
			</button>
		</div>

		<!-- 복구 대기 인디케이터 -->
		{#if !isOnline || isRetrying}
			<div class="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
				<span class="h-3 w-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin"></span>
				<span>신호 복구 시 자동 새로고침 대기 중...</span>
			</div>
		{/if}
	</div>
</div>
