<script>
	/**
	 * @file (app)/v1/admin/+page.svelte
	 * @description 시스템 통합 관리 관제탑 (한글화 버전)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.ts';
	import { fade, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	let { data } = $props();
	const user = $derived(data?.user || null);
	const userRank = $derived(Number(user?.rank_level ?? 0));
	const isRoot = $derived(userRank >= 9);

	let stats = $state({
		user_count: 0,
		board_count: 0,
		post_count: 0,
		app_count: 0,
		admin_name: '관리자'
	});
	let loading = $state(true);

	// 🔍 모듈 검색어 및 카테고리 필터
	let moduleSearch = $state('');
	let moduleCategory = $state('ALL'); // 'ALL' | 'CORE' | 'OPERATIONS' | 'BUSINESS'

	async function loadStats() {
		loading = true;
		try {
			stats = await api.adminGetDashboard();
		} catch (e) {
			toast.error(e.message);
		} finally {
			loading = false;
		}
	}

	onMount(loadStats);

	// ----------------------------------------------------------------------------
	// 🛡️ 1. 시스템 코어 인프라 모듈 (Lv.8~9 코어 관리자 전용)
	// ----------------------------------------------------------------------------
	const systemModules = [
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_apps',
			minRank: 9,
			title: '앱 레지스트리',
			desc: 'INSTANCE / CUSTOM / SYSTEM 앱 엔진 등록 및 메타데이터·권한 관리',
			link: '/v1/admin/apps',
			icon: 'mdi:apps-box',
			color: 'bg-indigo-600'
		},
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_menu',
			minRank: 8,
			title: '메뉴 마스터',
			desc: '시스템 전체 내비게이션 트리 및 앱 연결·접근 권한 구조 편집',
			link: '/v1/admin/menu',
			icon: 'mdi:menu-open',
			color: 'bg-blue-600'
		},
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_user_manage',
			minRank: 8,
			title: '사용자·직급 관리',
			desc: '회원 권한 등급(rank_level 0~9) 조정 및 주그룹/부그룹 소속 관리',
			link: '/v1/admin/user-manage',
			icon: 'mdi:account-group-outline',
			color: 'bg-emerald-600'
		},
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_group_manage',
			minRank: 9,
			title: '조직·권한 통제소',
			desc: '주/부그룹 마스터 및 인스턴스/시스템 앱 독립 권한 배분 관제탑',
			link: '/v1/admin/group-manage',
			icon: 'mdi:shield-account-outline',
			color: 'bg-cyan-700'
		},
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_observability',
			minRank: 8,
			title: '통합 관제 & 감사로그',
			desc: '실시간 세션 추적·강제추방, 4대 감사로그(접근/도메인Diff/장애/보안) 전사 관제',
			link: '/v1/admin/observability',
			icon: 'mdi:shield-check-outline',
			color: 'bg-blue-600'
		},
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_config',
			minRank: 8,
			title: '시스템 환경설정',
			desc: '글로벌 환경 변수, 데이터 보존 주기(GC) 및 Watchdog 이상 경보 제어',
			link: '/v1/admin/config',
			icon: 'mdi:tune-vertical',
			color: 'bg-slate-700'
		},
		{
			type: 'SYSTEM',
			category: 'CORE',
			appId: 'admin_tasks',
			minRank: 8,
			title: '태스크 & 크론 워커',
			desc: '비동기 백그라운드 작업 큐 상태 모니터링 및 자율신경계 스케줄러 제어',
			link: '/v1/admin/tasks',
			icon: 'mdi:robot-industrial',
			color: 'bg-violet-600'
		},
		// 🌟 운영팀 위임 가능 모듈 (Lv.4 일반 관리자 허용)
		{
			type: 'SYSTEM',
			category: 'OPERATIONS',
			appId: 'admin_alerts',
			minRank: 4,
			title: '알림 관리',
			desc: '전역/경로별 상단 공지 배너 및 중앙 모달 알림 생성·배포 (운영 위임 가능)',
			link: '/v1/admin/alerts',
			icon: 'mdi:bell-cog-outline',
			color: 'bg-teal-600'
		},
		{
			type: 'SYSTEM',
			category: 'OPERATIONS',
			appId: 'admin_media',
			minRank: 4,
			title: '미디어 관제탑',
			desc: '전체 업로드 파일 자산 모니터링 및 스토리지 용량 관리 (운영 위임 가능)',
			link: '/v1/admin/media',
			icon: 'mdi:database-cog-outline',
			color: 'bg-indigo-600'
		},
		{
			type: 'SYSTEM',
			category: 'OPERATIONS',
			appId: 'admin_target_groups',
			minRank: 4,
			title: '메시징 타겟 그룹',
			desc: '알림·메시지 발송을 위한 기사 노선별/직급별 동적 그룹 필터링 및 연산',
			link: '/v1/admin/target-groups',
			icon: 'mdi:bullhorn-outline',
			color: 'bg-amber-600'
		},
		{
			type: 'SYSTEM',
			category: 'OPERATIONS',
			appId: 'admin_pushs',
			minRank: 4,
			title: '푸시 발송 & 구독자 관리',
			desc: '모바일/PC Web Push 활성 구독 기기 현황 모니터링, 무효 구독 정리 및 전사 푸시 발송',
			link: '/v1/admin/pushs',
			icon: 'mdi:cellphone-message',
			color: 'bg-pink-600'
		},
		{
			type: 'SYSTEM',
			category: 'OPERATIONS',
			appId: 'admin_sessions',
			minRank: 4,
			title: '세션 모니터링 (구버전)',
			desc: '실시간 멀티 디바이스 접속자(JTI) 확인 및 중복 세션 관리',
			link: '/v1/admin/sessions',
			icon: 'mdi:account-clock-outline',
			color: 'bg-rose-600'
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

	// 🔍 필터링 로직
	const filteredSystemModules = $derived(
		systemModules.filter(m => {
			const matchesCategory = moduleCategory === 'ALL' || moduleCategory === m.category;
			const q = moduleSearch.trim().toLowerCase();
			const matchesSearch = !q || m.title.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.link.toLowerCase().includes(q);
			return matchesCategory && matchesSearch;
		})
	);

	const filteredAppModules = $derived(
		appModules.filter(m => {
			const matchesCategory = moduleCategory === 'ALL' || moduleCategory === 'BUSINESS';
			const q = moduleSearch.trim().toLowerCase();
			const matchesSearch = !q || m.title.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.link.toLowerCase().includes(q);
			return matchesCategory && matchesSearch;
		})
	);

	function canAccess(mod) {
		if (isRoot) return true;
		const reqRank = mod.minRank ?? 4;
		return userRank >= reqRank;
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
		<div class="flex items-center gap-2 text-center">
			<button
				onclick={loadStats}
				class="btn btn-sm btn-outline border-slate-200 bg-white shadow-sm flex items-center gap-1 text-xs"
				disabled={loading}
			>
				<Icon icon="mdi:refresh" class={loading ? 'animate-spin' : ''} /> 새로고침
			</button>
			<div
				class="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-[8px] font-black uppercase shadow-md md:rounded-2xl md:px-5 md:py-2 md:text-[10px] md:shadow-lg"
			>
				서버: <span class="text-green-500">가동 중</span>
			</div>
			<div
				class="rounded-lg border border-slate-200 bg-slate-800 px-4 py-1.5 text-[8px] font-black text-white uppercase shadow-md md:rounded-2xl md:px-5 md:py-2 md:text-[10px] md:shadow-lg"
			>
				버전: v5.2.0
			</div>
		</div>
	</div>

	<!-- 📊 4대 코어 관제탑 라이브 위젯 -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
		<!-- 위젯 1: 자율신경계 태스크 워커 -->
		<a
			href="/v1/admin/tasks"
			class="group rounded-xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl hover:border-indigo-300 transition-all md:rounded-2xl md:p-7 block"
		>
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-slate-500 uppercase">
					<Icon icon="mdi:cog-sync-outline" class="text-indigo-600 text-base" /> 자율신경계 워커
				</div>
				<div class="flex items-center gap-1">
					<span class="badge badge-xs bg-blue-100 text-blue-700 font-bold border-blue-200">
						⚡ Watchdog
					</span>
					<span
						class="badge badge-xs font-bold {stats.task_engine?.is_healthy ? 'badge-success text-white' : 'badge-error text-white'}"
					>
						{stats.task_engine?.is_healthy ? '정상 가동' : '경보 발생'}
					</span>
				</div>
			</div>
			<div class="flex items-baseline justify-between mt-2">
				<div class="text-3xl font-black text-slate-800">
					{stats.task_engine?.running_count || 0}<span class="text-xs text-slate-400 font-normal ml-1">실행중</span>
				</div>
				<div class="text-right text-xs text-slate-500 font-medium space-y-0.5">
					<div>대기: <strong class="text-amber-600">{stats.task_engine?.pending_count || 0}</strong>건</div>
					<div>실패: <strong class={stats.task_engine?.failed_count > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>{stats.task_engine?.failed_count || 0}</strong>건</div>
				</div>
			</div>
			{#if stats.task_engine?.next_scheduled_task}
				<div class="mt-3 text-[10px] text-slate-400 border-t pt-2 truncate flex items-center justify-between">
					<span class="truncate">다음 예약: {stats.task_engine.next_scheduled_task}</span>
					<span class="text-emerald-600 font-bold shrink-0 ml-1">자율 순환</span>
				</div>
			{:else}
				<div class="mt-3 text-[10px] text-slate-400 border-t pt-2 truncate flex items-center justify-between">
					<span>정기 Cron 스케줄러</span>
					<span class="text-emerald-600 font-bold">자율 순환</span>
				</div>
			{/if}
		</a>

		<!-- 위젯 2: 보안 & 시스템 건강도 -->
		<a
			href="/v1/admin/observability"
			class="group rounded-xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl hover:border-blue-300 transition-all md:rounded-2xl md:p-7 block"
		>
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-slate-500 uppercase">
					<Icon icon="mdi:shield-check-outline" class="text-blue-600 text-base" /> 보안 & 시스템
				</div>
				<span
					class="badge badge-xs font-bold {stats.observability?.security_breach_24h > 0 ? 'badge-error text-white' : 'badge-info text-white'}"
				>
					{stats.observability?.security_breach_24h > 0 ? '침해 감지' : '안전 보호'}
				</span>
			</div>
			<div class="flex items-baseline justify-between mt-2">
				<div class="text-3xl font-black {stats.observability?.security_breach_24h > 0 ? 'text-rose-600' : 'text-slate-800'}">
					{stats.observability?.security_breach_24h || 0}<span class="text-xs text-slate-400 font-normal ml-1">보안침해 24h</span>
				</div>
				<div class="text-right text-xs text-slate-500 font-medium space-y-0.5">
					<div>장애 에러: <strong class={stats.observability?.error_log_24h > 0 ? 'text-rose-500' : 'text-slate-400'}>{stats.observability?.error_log_24h || 0}</strong>건</div>
					<div>시스템 상태: <strong class="text-emerald-600">안정</strong></div>
				</div>
			</div>
			<div class="mt-3 text-[10px] text-slate-400 border-t pt-2">
				통합 감사로그 실시간 관제 연동
			</div>
		</a>

		<!-- 위젯 3: 실시간 접속 세션 & 근무 현황 -->
		<a
			href="/v1/admin/target-groups"
			class="group rounded-xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl hover:border-emerald-300 transition-all md:rounded-2xl md:p-7 block"
		>
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-slate-500 uppercase">
					<Icon icon="mdi:account-clock-outline" class="text-emerald-600 text-base" /> 세션 & 근무
				</div>
				<span class="badge badge-xs badge-success text-white font-bold animate-pulse">
					LIVE
				</span>
			</div>
			<div class="flex items-baseline justify-between mt-2">
				<div class="text-3xl font-black text-emerald-600">
					{stats.observability?.active_sessions || 0}<span class="text-xs text-slate-500 font-normal ml-1">온라인</span>
				</div>
				<div class="text-right text-xs text-slate-500 font-medium space-y-0.5">
					<div>오늘 근무: <strong class="text-slate-800">{stats.duty_status?.working_count || 0}</strong>명</div>
					<div>오늘 휴무: <strong class="text-amber-600">{stats.duty_status?.dayoff_count || 0}</strong>명</div>
				</div>
			</div>
			<div class="mt-3 text-[10px] text-slate-400 border-t pt-2">
				동적 타겟그룹 및 Redis 실시간 연산
			</div>
		</a>

		<!-- 위젯 4: 현장 지시사항 인지율 -->
		<a
			href="/v1/admin/alerts"
			class="group rounded-xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl hover:border-purple-300 transition-all md:rounded-2xl md:p-7 block"
		>
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-1.5 text-[11px] font-black tracking-wider text-slate-500 uppercase">
					<Icon icon="mdi:checkbox-marked-circle-outline" class="text-purple-600 text-base" /> 지시사항 인지율
				</div>
				<span
					class="badge badge-xs font-bold {stats.instruction_watchdog?.unconfirmed_count > 0 ? 'badge-warning' : 'badge-success text-white'}"
				>
					{stats.instruction_watchdog?.unconfirmed_count > 0 ? '확인 필요' : '모두 확인'}
				</span>
			</div>
			<div class="flex items-baseline justify-between mt-2">
				<div class="text-3xl font-black {stats.instruction_watchdog?.unconfirmed_count > 0 ? 'text-amber-600' : 'text-slate-800'}">
					{stats.instruction_watchdog?.unconfirmed_count || 0}<span class="text-xs text-slate-400 font-normal ml-1">미확인</span>
				</div>
				<div class="text-right text-xs text-slate-500 font-medium space-y-0.5">
					<div>알림 센터: <strong class="text-purple-600">지시사항</strong></div>
					<div>양방향 피드백: <strong class="text-emerald-600">연동</strong></div>
				</div>
			</div>
			<div class="mt-3 text-[10px] text-slate-400 border-t pt-2">
				미확인 기사님 실시간 추적 바로가기
			</div>
		</a>
	</div>

	<!-- 🔍 모듈 검색 및 카테고리 필터 바 -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
		<!-- 카테고리 탭 -->
		<div class="join border border-slate-200 bg-slate-100 p-1 rounded-xl shadow-xs">
			<button 
				class="btn btn-xs join-item font-bold border-none {moduleCategory === 'ALL' ? 'bg-purple-700 text-white shadow' : 'bg-transparent text-slate-600'}"
				onclick={() => moduleCategory = 'ALL'}
			>
				전체 모듈 ({systemModules.length + appModules.length})
			</button>
			<button 
				class="btn btn-xs join-item font-bold border-none {moduleCategory === 'CORE' ? 'bg-purple-700 text-white shadow' : 'bg-transparent text-slate-600'}"
				onclick={() => moduleCategory = 'CORE'}
			>
				🛡️ 코어 인프라 ({systemModules.filter(m => m.category === 'CORE').length})
			</button>
			<button 
				class="btn btn-xs join-item font-bold border-none {moduleCategory === 'OPERATIONS' ? 'bg-purple-700 text-white shadow' : 'bg-transparent text-slate-600'}"
				onclick={() => moduleCategory = 'OPERATIONS'}
			>
				📢 운영 관제 ({systemModules.filter(m => m.category === 'OPERATIONS').length})
			</button>
			<button 
				class="btn btn-xs join-item font-bold border-none {moduleCategory === 'BUSINESS' ? 'bg-blue-600 text-white shadow' : 'bg-transparent text-slate-600'}"
				onclick={() => moduleCategory = 'BUSINESS'}
			>
				🚐 현장 업무 ({appModules.length})
			</button>
		</div>

		<!-- 검색창 -->
		<div class="w-full md:w-72 relative">
			<Icon icon="mdi:magnify" class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
			<input 
				type="text" 
				bind:value={moduleSearch} 
				placeholder="모듈명, 설명, 경로 검색..." 
				class="input input-sm input-bordered w-full rounded-xl pl-9 font-bold bg-white focus:border-purple-500"
			/>
		</div>
	</div>

	<!-- 🛡️ 섹션 1: 시스템 코어 관제 모듈 (SYSTEM App: 사용자 화면 없이 관리자 화면만 존재 / 삭제 불가) -->
	{#if filteredSystemModules.length > 0}
	<div class="space-y-4 md:space-y-6">
		<div class="flex flex-col gap-1 border-l-4 border-purple-700 pl-3 md:border-l-8 md:pl-4">
			<div class="flex items-center gap-2">
				<h3 class="text-xl font-black tracking-tighter text-slate-900 italic md:text-2xl">
					시스템 관리자 관제 모듈 (System Apps)
				</h3>
				<span
					class="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-purple-700 uppercase"
				>
					SYSTEM · {filteredSystemModules.length}개
				</span>
			</div>
			<p class="text-xs font-bold text-slate-500">
				티어 구속 없이 시스템 앱별로 독립적인 권한(허용 그룹 및 최소 랭크)이 적용된 관리자 전용 앱입니다.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredSystemModules as mod (mod.link)}
				{@const hasAccess = canAccess(mod)}
				{#if hasAccess}
					<!-- 접근 권한 있음: 정상 진입 링크 -->
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
				{:else}
					<!-- 접근 권한 없음: 비활성화 카드 (링크 없음, L2 알림 배너 미호출) -->
					<div
						class="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-6 opacity-65 md:rounded-2xl md:p-8 select-none"
						title="해당 시스템 모듈은 Lv.{mod.minRank} 이상 관리자 권한이 필요합니다."
					>
						<div class="relative z-10 flex items-start justify-between">
							<div
								class="h-12 w-12 md:h-14 md:w-14 bg-slate-300 text-slate-500 flex items-center justify-center rounded-lg text-xl md:rounded-xl md:text-2xl"
							>
								<Icon icon={mod.icon} />
							</div>
							<div class="flex flex-col items-end gap-1.5">
								<span class="rounded bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
									<Icon icon="mdi:lock" class="text-xs" /> Lv.{mod.minRank} 이상 권한 필요
								</span>
							</div>
						</div>
						<div class="relative z-10 mt-6 md:mt-8">
							<div class="flex items-center gap-1.5">
								<h4
									class="mb-1 text-xl font-bold tracking-tighter text-slate-500 md:mb-2 md:text-2xl"
								>
									{mod.title}
								</h4>
								<Icon icon="mdi:lock-outline" class="text-slate-400 text-lg mb-1" />
							</div>
							<p
								class="text-xs leading-relaxed font-medium text-slate-400"
							>
								{mod.desc}
							</p>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
	{/if}

	<!-- 🧩 섹션 2: 비즈니스 & 콘텐츠 앱 관리 모듈 (INSTANCE / CUSTOM / SERVICE / PAGES) -->
	{#if filteredAppModules.length > 0}
	<div class="space-y-4 pt-4 md:space-y-6 md:pt-6">
		<div class="flex flex-col gap-1 border-l-4 border-blue-600 pl-3 md:border-l-8 md:pl-4">
			<div class="flex items-center gap-2">
				<h3 class="text-xl font-black tracking-tighter text-slate-900 italic md:text-2xl">
					현장 비즈니스 & 콘텐츠 앱 관리
				</h3>
				<span
					class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-blue-700 uppercase"
				>
					업무 앱 · {filteredAppModules.length}개
				</span>
			</div>
			<p class="text-xs font-bold text-slate-500">
				배차, 노선, 결근계 등 현장 업무 및 게시판/페이지 인스턴스를 관리합니다.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredAppModules as mod (mod.link)}
				{@const hasAccess = canAccess(mod)}
				{#if hasAccess}
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
				{:else}
					<div
						class="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-6 opacity-65 md:rounded-2xl md:p-8 select-none"
						title="해당 업무 모듈은 Lv.{mod.minRank} 이상 관리자 권한이 필요합니다."
					>
						<div class="relative z-10 flex items-start justify-between">
							<div
								class="h-12 w-12 md:h-14 md:w-14 bg-slate-300 text-slate-500 flex items-center justify-center rounded-lg text-xl md:rounded-xl md:text-2xl"
							>
								<Icon icon={mod.icon} />
							</div>
							<div class="flex flex-col items-end gap-1.5">
								<span class="rounded bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
									<Icon icon="mdi:lock" class="text-xs" /> Lv.{mod.minRank} 이상 권한 필요
								</span>
							</div>
						</div>
						<div class="relative z-10 mt-6 md:mt-8">
							<div class="flex items-center gap-1.5">
								<h4
									class="mb-1 text-xl font-bold tracking-tighter text-slate-500 md:mb-2 md:text-2xl"
								>
									{mod.title}
								</h4>
								<Icon icon="mdi:lock-outline" class="text-slate-400 text-lg mb-1" />
							</div>
							<p
								class="text-xs leading-relaxed font-medium text-slate-400"
							>
								{mod.desc}
							</p>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
	{/if}

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
