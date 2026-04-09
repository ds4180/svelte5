<script>
	/**
	 * @file (app)/v1/admin/+page.svelte
	 * @description 시스템 통합 관리 관제탑 (한글화 버전)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { fade, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte'; // Iconify 임포트

	let stats = $state({
		user_count: 0,
		board_count: 0,
		post_count: 0,
		app_count: 0,
		admin_name: '관리자'
	});
	let loading = $state(true);

	async function loadStats() {
		loading = true;
		try {
			stats = await api.adminGetDashboard();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	onMount(loadStats);

	const adminModules = [
		{
			title: '메뉴 마스터',
			desc: '시스템 전체 내비게이션 및 권한 구조 편집',
			link: '/v1/admin/menu',
			icon: 'mdi:menu-open',
			color: 'bg-blue-600'
		},
		{
			title: '알림 관리',
			desc: '전역 알림 생성, 수정 및 배포',
			link: '/v1/admin/alerts',
			icon: 'mdi:bell-cog-outline',
			color: 'bg-teal-600'
		},
		{
			title: '세션 모니터링',
			desc: '실시간 접속자 확인 및 중복 로그인 강제 제어',
			link: '/v1/admin/sessions',
			icon: 'mdi:shield-lock-outline',
			color: 'bg-purple-600'
		},
		{
			title: '앱 레지스트리',
			desc: '게시판, 캘린더 등 시스템 엔진 등록 및 관리',
			link: '/v1/admin/apps',
			icon: 'mdi:apps-box',
			color: 'bg-indigo-600'
		},
		{
			title: '사용자 관리',
			desc: '회원 등급 조정 및 시스템 승인 프로토콜',
			link: '#',
			icon: 'mdi:account-group-outline',
			color: 'bg-emerald-600'
		},
		{
			title: '게시판 관리',
			desc: '개별 게시판 슬러그 및 레이아웃 정책 설정',
			link: '#',
			icon: 'mdi:clipboard-text-outline',
			color: 'bg-orange-600'
		},
		{
			title: '시스템 설정',
			desc: '글로벌 환경 변수 및 공통 코드 동적 수정',
			link: '/v1/admin/config',
			icon: 'mdi:cog-outline',
			color: 'bg-slate-700'
		}
	];
</script>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-6 px-4 pb-20 font-['Outfit','Noto_Sans_KR'] md:space-y-12 md:pb-40"
>
	<!-- 📄 상단 로고 및 상태 -->
	<div
		class="flex flex-col items-start justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4 md:pb-8"
	>
		<div>
			<span
				class="mb-1 block text-[8px] font-black tracking-[0.2em] text-slate-400 uppercase md:mb-2 md:text-[10px] md:tracking-[0.4em]"
				>Central Operations</span
			>
			<h1 class="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				관리자 <span class="NOT-ITALIC text-blue-600">관제센터</span>
			</h1>
			<p class="mt-2 text-xs font-bold text-slate-500 md:mt-3 md:text-sm">
				{stats.admin_name}님, 오늘도 시스템은 안정적으로 가동 중입니다.
			</p>
		</div>
		<div class="flex gap-2 text-center">
			<div
				class="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-[8px] font-black uppercase shadow-md md:rounded-2xl md:px-6 md:py-2 md:text-[10px] md:shadow-lg"
			>
				서버: <span class="text-green-500">가동 중</span>
			</div>
			<div
				class="rounded-lg border border-slate-200 bg-slate-800 px-4 py-1.5 text-[8px] font-black text-white uppercase shadow-md md:rounded-2xl md:px-6 md:py-2 md:text-[10px] md:shadow-lg"
			>
				버전: v5.1.0
			</div>
		</div>
	</div>

	<!-- 📊 실시간 주요 지표 -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-lg md:rounded-2xl md:p-8">
			<div class="mb-3 text-[10px] font-black tracking-widest text-slate-400 uppercase md:mb-4">
				전체 사용자
			</div>
			<div class="flex items-baseline gap-1 md:gap-2">
				<span class="text-4xl font-black tracking-tighter text-slate-900 md:text-5xl"
					>{stats.user_count}</span
				>
				<span class="text-xs font-bold text-slate-500 md:text-sm">명</span>
			</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-lg md:rounded-2xl md:p-8">
			<div class="mb-3 text-[10px] font-black tracking-widest text-slate-400 uppercase md:mb-4">
				전체 게시물
			</div>
			<div class="flex items-baseline gap-1 md:gap-2">
				<span class="text-4xl font-black tracking-tighter text-slate-900 md:text-5xl"
					>{stats.post_count}</span
				>
				<span class="text-xs font-bold text-slate-500 md:text-sm">건</span>
			</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-lg md:rounded-2xl md:p-8">
			<div class="mb-3 text-[10px] font-black tracking-widest text-slate-400 uppercase md:mb-4">
				작동 중인 엔진
			</div>
			<div class="flex items-baseline gap-1 md:gap-2">
				<span class="text-4xl font-black tracking-tighter text-slate-900 md:text-5xl"
					>{stats.app_count}</span
				>
				<span class="text-xs font-bold text-slate-500 md:text-sm">개</span>
			</div>
		</div>
		<div
			class="rounded-xl border border-blue-300 bg-blue-600 p-6 text-white shadow-lg md:rounded-2xl md:p-8"
		>
			<div class="mb-3 text-[10px] font-black tracking-widest uppercase opacity-80 md:mb-4">
				활성 게시판
			</div>
			<div class="flex items-baseline gap-1 md:gap-2">
				<span class="text-4xl font-black tracking-tighter md:text-5xl">{stats.board_count}</span>
				<span class="text-xs font-bold opacity-80 md:text-sm">그룹</span>
			</div>
		</div>
	</div>

	<!-- 🕹️ 시스템 관리 모듈 (벤토 그리드) -->
	<div class="space-y-4 md:space-y-6">
		<h3
			class="border-l-4 border-slate-900 pl-3 text-xl font-black tracking-tighter text-slate-900 italic md:border-l-8 md:pl-4 md:text-2xl"
		>
			시스템 관리 모듈
		</h3>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each adminModules as mod}
				{#if mod.action === 'sendPushToAll'}
					<button
						onclick={handlePushToAll}
						class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-md transition-all duration-300 hover:bg-slate-50 md:rounded-2xl md:p-8 md:shadow-lg"
					>
						<div class="relative z-10 flex items-start justify-between">
							<div
								class="h-12 w-12 md:h-14 md:w-14 {mod.color} flex items-center justify-center rounded-lg text-xl text-white shadow-md transition-transform group-hover:scale-110 md:rounded-xl md:text-2xl"
							>
								<Icon icon={mod.icon} />
							</div>
							<div
								class="flex items-center gap-1 text-[8px] font-black tracking-widest text-slate-500 uppercase opacity-0 transition-opacity group-hover:opacity-100 md:gap-2 md:text-[9px]"
							>
								발송 <span
									class="translate-x-0 transition-transform group-hover:translate-x-1 md:group-hover:translate-x-2"
									>→</span
								>
							</div>
						</div>
						<div class="relative z-10 mt-6 md:mt-8">
							<h4
								class="mb-1 text-xl font-black tracking-tighter text-slate-900 md:mb-2 md:text-2xl"
							>
								{mod.title}
							</h4>
							<p
								class="text-xs leading-relaxed font-bold text-slate-500 opacity-70 group-hover:opacity-90"
							>
								{mod.desc}
							</p>
						</div>
					</button>
				{:else}
					<a
						href={mod.link}
						class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-md transition-all duration-300 hover:bg-slate-50 md:rounded-2xl md:p-8 md:shadow-lg"
					>
						<div class="relative z-10 flex items-start justify-between">
							<div
								class="h-12 w-12 md:h-14 md:w-14 {mod.color} flex items-center justify-center rounded-lg text-xl text-white shadow-md transition-transform group-hover:scale-110 md:rounded-xl md:text-2xl"
							>
								<Icon icon={mod.icon} />
							</div>
							<div
								class="flex items-center gap-1 text-[8px] font-black tracking-widest text-slate-500 uppercase opacity-0 transition-opacity group-hover:opacity-100 md:gap-2 md:text-[9px]"
							>
								모듈 진입 <span
									class="translate-x-0 transition-transform group-hover:translate-x-1 md:group-hover:translate-x-2"
									>→</span
								>
							</div>
						</div>
						<div class="relative z-10 mt-6 md:mt-8">
							<h4
								class="mb-1 text-xl font-black tracking-tighter text-slate-900 md:mb-2 md:text-2xl"
							>
								{mod.title}
							</h4>
							<p
								class="text-xs leading-relaxed font-bold text-slate-500 opacity-70 group-hover:opacity-90"
							>
								{mod.desc}
							</p>
						</div>
					</a>
				{/if}
			{/each}
		</div>
	</div>
	<!-- ⚙️ 퀵 링크: 메뉴 마스터 -->
	<div
		class="flex flex-col items-center justify-between gap-6 rounded-xl border border-slate-200 bg-white p-8 shadow-xl md:flex-row md:gap-8 md:rounded-2xl md:p-10"
	>
		<div class="flex items-center gap-4 md:gap-6">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-xl border border-blue-300 bg-blue-600 text-3xl shadow-lg md:h-20 md:w-20 md:rounded-2xl md:text-4xl"
			>
				<Icon icon="mdi:file-tree-outline" />
			</div>
			<div>
				<h4 class="text-2xl font-black tracking-tighter text-slate-900 italic md:text-3xl">
					메뉴 구조를 먼저 수정하시겠습니까?
				</h4>
				<p class="text-sm font-bold text-slate-500">
					전체 사이트의 주소 체계와 메뉴 구성을 실시간으로 변경합니다.
				</p>
			</div>
		</div>
		<a
			href="/v1/admin/menu"
			class="btn h-14 rounded-xl bg-slate-900 px-10 font-black text-white shadow-xl transition-all btn-lg hover:bg-slate-800 hover:shadow-2xl md:h-16 md:rounded-2xl md:px-12"
		>
			메뉴 마스터 바로가기
		</a>
	</div>
</div>

<style>
	:global(body) {
		background-color: #f8fafc;
	}
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
