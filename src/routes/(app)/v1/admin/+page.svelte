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

	// ----------------------------------------------------------------------------
	// 🛡️ 1. 시스템 코어 관제 모듈 (SYSTEM App: 사용자 화면 없이 관리자 화면만 존재하는 필수 앱)
	// ----------------------------------------------------------------------------
	const systemModules = [
		{
			type: 'SYSTEM',
			title: '앱 레지스트리',
			desc: 'INSTANCE / CUSTOM / SYSTEM 앱 엔진 등록 및 메타데이터·권한 관리',
			link: '/v1/admin/apps',
			icon: 'mdi:apps-box',
			color: 'bg-indigo-600'
		},
		{
			type: 'SYSTEM',
			title: '메뉴 마스터',
			desc: '시스템 전체 내비게이션 트리 및 앱 연결·접근 권한 구조 편집',
			link: '/v1/admin/menu',
			icon: 'mdi:menu-open',
			color: 'bg-blue-600'
		},
		{
			type: 'SYSTEM',
			title: '사용자 관리',
			desc: '회원 권한 등급(rank_level 0~9) 조정 및 주그룹/부그룹 소속 관리',
			link: '/v1/admin/user-manage',
			icon: 'mdi:account-group-outline',
			color: 'bg-emerald-600'
		},
		{
			type: 'SYSTEM',
			title: '조직·권한 그룹 마스터',
			desc: '리눅스식 소속 부서(주그룹 1개) 및 직무/예외 통제(부그룹 N개) 마스터 등록 및 회원 매칭',
			link: '/v1/admin/group-manage',
			icon: 'mdi:account-multiple-check-outline',
			color: 'bg-cyan-700'
		},
		{
			type: 'SYSTEM',
			title: '메시징 타겟 그룹',
			desc: '알림·메시지 발송을 위한 기사 노선별/직급별 동적 그룹 필터링 및 교집합 연산',
			link: '/v1/admin/target-groups',
			icon: 'mdi:bullhorn-outline',
			color: 'bg-amber-600'
		},
		{
			type: 'SYSTEM',
			title: '세션 모니터링',
			desc: '실시간 멀티 디바이스 접속자(JTI) 확인 및 비정상 세션 강제 종료',
			link: '/v1/admin/sessions',
			icon: 'mdi:shield-lock-outline',
			color: 'bg-purple-600'
		},
		{
			type: 'SYSTEM',
			title: '시스템 설정',
			desc: '글로벌 환경 변수, 기본 랜딩 페이지 및 공통 코드 동적 제어',
			link: '/v1/admin/config',
			icon: 'mdi:cog-outline',
			color: 'bg-slate-700'
		},
		{
			type: 'SYSTEM',
			title: '알림 관리',
			desc: '전역/경로별 상단 공지 배너 및 중앙 모달 알림 생성·배포',
			link: '/v1/admin/alerts',
			icon: 'mdi:bell-cog-outline',
			color: 'bg-teal-600'
		},
		{
			type: 'SYSTEM',
			title: '미디어 관제탑',
			desc: '전체 업로드 파일 자산 모니터링 및 보안 Tier별 스토리지 관리',
			link: '/v1/admin/media',
			icon: 'mdi:database-cog-outline',
			color: 'bg-indigo-600'
		},
		{
			type: 'SYSTEM',
			title: '시스템 태스크 관제탑',
			desc: '비동기 백그라운드 작업 큐 상태 모니터링 및 스케줄러 제어',
			link: '/v1/admin/tasks',
			icon: 'mdi:cogs',
			color: 'bg-violet-600'
		}
	];

	// ----------------------------------------------------------------------------
	// 🧩 2. 비즈니스 & 콘텐츠 앱 관리 모듈 (INSTANCE / CUSTOM / SERVICE / PAGES)
	//       - 사용자 화면과 연동되거나 호스트 앱에 애드온(Add-on)되는 앱들의 관리 화면
	// ----------------------------------------------------------------------------
	const appModules = [
		{
			type: 'CUSTOM',
			title: '차량 배차 관리',
			desc: '실시간 노선별 차량 투입, 기사 배정 및 일일 운행 시간표 조율 (사용자: /v1/custom/dispatch)',
			link: '/v1/admin/dispatch',
			icon: 'mdi:bus-multiple',
			color: 'bg-blue-700'
		},
		{
			type: 'CUSTOM',
			title: '노선 마스터 관리',
			desc: '정규 및 임시 노선의 기준 버전 도면 및 회차 시간표 통합 관리 (배차 앱 연동)',
			link: '/v1/admin/route_master',
			icon: 'mdi:bus-clock',
			color: 'bg-indigo-700'
		},
		{
			type: 'CUSTOM',
			title: '휴무(결근계) 관리',
			desc: '직원 및 승무원의 연차/휴무 신청 내역 승인·반려 관제 (사용자: /v1/custom/dayoff)',
			link: '/v1/admin/dayoff',
			icon: 'mdi:calendar-check-outline',
			color: 'bg-amber-600'
		},
		{
			type: 'INSTANCE',
			title: '게시판 인스턴스 관리',
			desc: '추상화 다중 게시판(공지, 자유 등) 슬러그 생성 및 레이아웃 정책 설정 (사용자: /v1/app/board/[slug])',
			link: '/v1/admin/boards',
			icon: 'mdi:clipboard-text-outline',
			color: 'bg-orange-600'
		},
		{
			type: 'INSTANCE',
			title: '페이지 엔진 관리',
			desc: 'DB 기반 고정 콘텐츠 다중 페이지 인스턴스 생성 및 게시 기간 제어 (사용자: /v1/custom/page/[slug])',
			link: '/v1/admin/page',
			icon: 'mdi:file-document-edit-outline',
			color: 'bg-sky-600'
		},
		{
			type: 'SERVICE',
			title: '서비스 마스터 (Add-on)',
			desc: 'INSTANCE 및 CUSTOM 앱에 애드온(Add-on) 결합하는 레고형 서비스(댓글, 업로드 등) 번들 관리',
			link: '/v1/admin/services',
			icon: 'mdi:toy-brick-outline',
			color: 'bg-rose-600'
		},
		{
			type: 'PAGES',
			title: '정적 페이지 탐색기',
			desc: '순수 파일 시스템(/v1/pages/...) 매핑 정적 페이지 실시간 스캔 및 탐색',
			link: '/v1/admin/pages',
			icon: 'mdi:folder-search-outline',
			color: 'bg-slate-600'
		},
		{
			type: 'PAGES',
			title: '통합 미니앱 허브',
			desc: '메모, 업무지시, 메시지, 알림 등 사용자 통합 위젯 런타임 바로가기',
			link: '/v1/pages/miniapps',
			icon: 'mdi:widgets-outline',
			color: 'bg-emerald-700'
		}
	];

	// 앱 분류별 배지 스타일 헬퍼
	function getTypeBadgeClass(type) {
		switch (type) {
			case 'SYSTEM':
				return 'border-purple-200 bg-purple-50 text-purple-700';
			case 'INSTANCE':
				return 'border-blue-200 bg-blue-50 text-blue-700';
			case 'CUSTOM':
				return 'border-amber-200 bg-amber-50 text-amber-700';
			case 'SERVICE':
				return 'border-rose-200 bg-rose-50 text-rose-700';
			case 'PAGES':
				return 'border-emerald-200 bg-emerald-50 text-emerald-700';
			default:
				return 'border-slate-200 bg-slate-50 text-slate-700';
		}
	}
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

	<!-- 🛡️ 섹션 1: 시스템 코어 관제 모듈 (SYSTEM App: 사용자 화면 없이 관리자 화면만 존재 / 삭제 불가) -->
	<div class="space-y-4 md:space-y-6">
		<div class="flex flex-col gap-1 border-l-4 border-purple-700 pl-3 md:border-l-8 md:pl-4">
			<div class="flex items-center gap-2">
				<h3 class="text-xl font-black tracking-tighter text-slate-900 italic md:text-2xl">
					시스템 코어 관제 모듈 (System Apps)
				</h3>
				<span
					class="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-purple-700 uppercase"
				>
					SYSTEM · 관리자 전용 (삭제 불가)
				</span>
			</div>
			<p class="text-xs font-bold text-slate-500">
				일반 사용자 화면을 제외하고 오직 관리자 화면만 존재하는 시스템 필수 인프라 및 보안 관제 앱입니다.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each systemModules as mod (mod.link)}
				<a
					href={mod.link}
					class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-md transition-all duration-300 hover:border-purple-400 hover:bg-slate-50 md:rounded-2xl md:p-8 md:shadow-lg"
				>
					<div class="relative z-10 flex items-start justify-between">
						<div
							class="h-12 w-12 md:h-14 md:w-14 {mod.color} flex items-center justify-center rounded-lg text-xl text-white shadow-md transition-transform group-hover:scale-110 md:rounded-xl md:text-2xl"
						>
							<Icon icon={mod.icon} />
						</div>
						<div class="flex flex-col items-end gap-1.5">
							<span
								class="rounded border px-2 py-0.5 text-[9px] font-black tracking-wider uppercase {getTypeBadgeClass(
									mod.type
								)}"
							>
								{mod.type} APP
							</span>
							<div
								class="flex items-center gap-1 text-[8px] font-black tracking-widest text-slate-500 uppercase opacity-0 transition-opacity group-hover:opacity-100 md:gap-2 md:text-[9px]"
							>
								관제 진입 <span
									class="translate-x-0 transition-transform group-hover:translate-x-1 md:group-hover:translate-x-2"
									>→</span
								>
							</div>
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
			{/each}
		</div>
	</div>

	<!-- 🧩 섹션 2: 비즈니스 & 콘텐츠 앱 관리 모듈 (INSTANCE / CUSTOM / SERVICE / PAGES) -->
	<div class="space-y-4 pt-4 md:space-y-6 md:pt-6">
		<div class="flex flex-col gap-1 border-l-4 border-blue-600 pl-3 md:border-l-8 md:pl-4">
			<div class="flex items-center gap-2">
				<h3 class="text-xl font-black tracking-tighter text-slate-900 italic md:text-2xl">
					비즈니스 & 콘텐츠 앱 관리 (Instance · Custom · Service · Pages)
				</h3>
				<span
					class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-blue-700 uppercase"
				>
					NON-SYSTEM · 사용자/애드온 연동
				</span>
			</div>
			<p class="text-xs font-bold text-slate-500">
				다중 추상화 인스턴스 앱(INSTANCE), 단일 업무 앱(CUSTOM), 애드온 서비스 앱(SERVICE) 및 정적 페이지(PAGES)를 관리합니다.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each appModules as mod (mod.link)}
				<a
					href={mod.link}
					class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-md transition-all duration-300 hover:border-blue-400 hover:bg-slate-50 md:rounded-2xl md:p-8 md:shadow-lg"
				>
					<div class="relative z-10 flex items-start justify-between">
						<div
							class="h-12 w-12 md:h-14 md:w-14 {mod.color} flex items-center justify-center rounded-lg text-xl text-white shadow-md transition-transform group-hover:scale-110 md:rounded-xl md:text-2xl"
						>
							<Icon icon={mod.icon} />
						</div>
						<div class="flex flex-col items-end gap-1.5">
							<span
								class="rounded border px-2 py-0.5 text-[9px] font-black tracking-wider uppercase {getTypeBadgeClass(
									mod.type
								)}"
							>
								{mod.type} APP
							</span>
							<div
								class="flex items-center gap-1 text-[8px] font-black tracking-widest text-slate-500 uppercase opacity-0 transition-opacity group-hover:opacity-100 md:gap-2 md:text-[9px]"
							>
								관리 진입 <span
									class="translate-x-0 transition-transform group-hover:translate-x-1 md:group-hover:translate-x-2"
									>→</span
								>
							</div>
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
