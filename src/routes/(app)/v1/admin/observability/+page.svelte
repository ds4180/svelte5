<script>
	/**
	 * ============================================================================
	 * [전사 통합 감사로그 및 시스템 관제 센터 (+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 1. 실시간 세션 관제 (기존 /v1/admin/sessions 기능 완벽 흡수 및 실시간 강제 추방)
	 * 2. 4대 감사로그 (ACCESS, CHANGE, ERROR, SECURITY) 탭별 정밀 조회 및 검색
	 * 3. 앱별 필터링 (?app_id=dispatch&tab=CHANGE) 딥링크 완벽 지원
	 * 4. Git 스타일 Diff-Patch 변경 전(from)/후(to) 시각 비교 모달 제공
	 * 5. 10초 주기 실시간 자동 갱신 (Auto-Refresh) 토글
	 */

	import { onMount, onDestroy } from 'svelte';
	import { page as pageStore } from '$app/stores';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { formatDateTime, timeAgo } from '$lib/utils';
	import Icon from '@iconify/svelte';

	// 📊 상단 4대 핵심 지표 요약 상태
	let summary = $state({
		active_sessions: 0,
		today_access_count: 0,
		today_change_count: 0,
		today_error_alert_count: 0,
		today_security_count: 0,
		today_errors_count: 0
	});

	// 📑 5대 관제 탭: 'SESSIONS' | 'ACCESS' | 'CHANGE' | 'ERROR' | 'SECURITY'
	let currentTab = $state('SESSIONS');

	// 🔍 필터 및 검색 상태
	let appFilter = $state('');
	let severityFilter = $state('');
	let searchKeyword = $state('');
	let currentPage = $state(1);
	let pageSize = 20;
	let totalCount = $state(0);

	// 📋 데이터 목록
	let liveSessions = $state(/** @type {any[]} */ ([]));
	let auditLogs = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let autoRefresh = $state(true);
	let refreshTimer = /** @type {any} */ (null);

	// 🔍 모달 상태 (Diff-Patch / Error Stack)
	let activeDiffLog = $state(/** @type {any} */ (null));
	let activeErrorLog = $state(/** @type {any} */ (null));

	// 🏷️ 18종 공식 앱 목록 (필터 드롭다운용 - admin_* 레거시 접두사 완전 제거)
	const APP_OPTIONS = [
		{ id: '', label: '전체 앱 (All Apps)' },
		{ id: 'system', label: '⚙️ 시스템 코어 (system)' },
		{ id: 'dashboard', label: '📊 관리자 대시보드 (dashboard)' },
		{ id: 'menu', label: '🌐 메뉴 관리 (menu)' },
		{ id: 'user_manage', label: '👤 사용자 랭크 관리 (user_manage)' },
		{ id: 'group_manage', label: '🏛️ 조직·권한 그룹 (group_manage)' },
		{ id: 'observability', label: '👁️ 접속기록·감사로그 (observability)' },
		{ id: 'task_manage', label: '⏱️ 백그라운드 태스크 (task_manage)' },
		{ id: 'dispatch', label: '🚐 배차 관리 (dispatch)' },
		{ id: 'vehicle', label: '🚗 차량 관리 (vehicle)' },
		{ id: 'route_master', label: '🗺️ 노선 마스터 (route_master)' },
		{ id: 'dayoff', label: '🏖️ 휴무 관리 (dayoff)' },
		{ id: 'boards', label: '📝 게시판 마스터 (boards)' },
		{ id: 'page', label: '📄 페이지 관리 (page)' },
		{ id: 'custom', label: '🧩 커스텀 앱 (custom)' },
		{ id: 'pushs', label: '🚀 푸시 알림 발송 (pushs)' },
		{ id: 'alerts', label: '🔔 알림·지시 관리 (alerts)' },
		{ id: 'target_groups', label: '🎯 발송 대상 그룹 (target_groups)' },
		{ id: 'media', label: '🖼️ 미디어 라이브러리 (media)' },
		{ id: 'auth', label: '🔐 사용자 인증 (auth)' }
	];

	// 🏷️ 탭 메타데이터 정의
	const TABS = [
		{ id: 'SESSIONS', label: '실시간 세션', icon: 'solar:users-group-rounded-bold-duotone', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
		{ id: 'ACCESS', label: '접근 및 인증', icon: 'solar:shield-keyhole-bold-duotone', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
		{ id: 'CHANGE', label: '앱 데이터 변경', icon: 'solar:document-add-bold-duotone', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
		{ id: 'ERROR', label: '서버 장애 및 오류', icon: 'solar:danger-triangle-bold-duotone', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
		{ id: 'SECURITY', label: '보안 및 위협', icon: 'solar:shield-warning-bold-duotone', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' }
	];

	/**
	 * 🔄 관제 데이터 통합 조회 함수
	 * @param {boolean} [silent=false]
	 */
	async function refreshData(silent = false) {
		if (!silent) loading = true;
		try {
			// 1. 상단 4대 핵심 지표 요약 갱신
			const sumRes = await api.adminGetObservabilitySummary().catch(() => null);
			if (sumRes) summary = sumRes;

			// 2. 현재 선택된 탭에 맞춰 데이터 조회
			if (currentTab === 'SESSIONS') {
				liveSessions = await api.adminGetLiveSessions();
				totalCount = liveSessions.length;
			} else {
				const params = {
					log_type: currentTab,
					app_id: appFilter || undefined,
					severity: severityFilter || undefined,
					query: searchKeyword.trim() || undefined,
					page: currentPage,
					page_size: pageSize,
					skip: (currentPage - 1) * pageSize,
					limit: pageSize
				};
				const logRes = await api.adminGetAuditLogs(params);
				auditLogs = logRes.items || [];
				totalCount = logRes.total || 0;
			}
		} catch (e) {
			console.error('❌ [Observability] 데이터 로딩 실패:', e);
		} finally {
			if (!silent) loading = false;
		}
	}

	/**
	 * 🔍 검색 실행
	 */
	function handleSearch() {
		currentPage = 1;
		refreshData();
	}

	/**
	 * 🧹 검색어 초기화
	 */
	function handleClearSearch() {
		searchKeyword = '';
		currentPage = 1;
		refreshData();
	}

	/**
	 * 📥 감사로그 CSV 다운로드
	 */
	function handleExportAuditCsv() {
		const params = {
			log_type: currentTab !== 'SESSIONS' ? currentTab : undefined,
			app_id: appFilter || undefined,
			severity: severityFilter || undefined,
			query: searchKeyword.trim() || undefined,
			limit: 5000
		};
		const url = api.adminGetAuditLogsExportUrl(params);
		toast.info('감사로그 CSV 파일 다운로드를 시작합니다...');
		window.location.href = url;
	}

	/**
	 * 🖥️ 서버 시스템 원시 콘솔 로그(.log) 다운로드
	 */
	function handleDownloadSystemLog() {
		const url = api.adminGetSystemLogDownloadUrl();
		toast.info('서버 시스템 콘솔 로그(system.log) 다운로드를 시작합니다...');
		window.location.href = url;
	}

	/**
	 * 🚫 세션 강제 추방 (Kick)
	 * @param {any} session
	 */
	async function handleKickSession(session) {
		const targetLabel = session.username || session.user_name || `세션 #${session.id}`;
		if (!confirm(`[주의] ${targetLabel} 님의 접속 세션을 즉시 강제 종료(Kicked-out)하시겠습니까?\n종료 즉시 해당 기기에서 로그아웃 처리됩니다.`)) {
			return;
		}
		try {
			await api.adminKickLiveSession(session.id);
			toast.success(`${targetLabel} 세션이 성공적으로 강제 종료되었습니다.`);
			await refreshData(false);
		} catch (/** @type {any} */ e) {
			toast.error('세션 강제 종료 실패: ' + e.message);
		}
	}

	/**
	 * 탭 변경 처리
	 * @param {string} tabId
	 */
	function switchTab(tabId) {
		currentTab = tabId;
		currentPage = 1;
		refreshData();
	}

	/**
	 * 앱 필터 변경 처리
	 * @param {any} event
	 */
	function handleAppFilterChange(event) {
		appFilter = event.target.value;
		currentPage = 1;
		refreshData();
	}

	/**
	 * 심각도 필터 변경 처리
	 * @param {any} event
	 */
	function handleSeverityFilterChange(event) {
		severityFilter = event.target.value;
		currentPage = 1;
		refreshData();
	}

	/**
	 * 심각도 뱃지 스타일
	 * @param {any} sev
	 */
	function getSeverityBadge(sev) {
		switch (sev) {
			case 'CRITICAL':
				return 'bg-rose-600 text-white border-rose-700 animate-pulse';
			case 'ERROR':
				return 'bg-red-100 text-red-800 border-red-300 font-bold';
			case 'WARN':
				return 'bg-amber-100 text-amber-800 border-amber-300';
			default:
				return 'bg-slate-100 text-slate-700 border-slate-300';
		}
	}

	/**
	 * 기기 카테고리 뱃지
	 * @param {any} dev
	 */
	function getDeviceBadge(dev) {
		switch (dev) {
			case 'MOBILE':
				return { icon: 'solar:smartphone-bold', text: '모바일', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
			case 'TABLET':
				return { icon: 'solar:tablet-bold', text: '태블릿', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
			default:
				return { icon: 'solar:laptop-minimalistic-bold', text: '데스크톱', color: 'bg-blue-50 text-blue-700 border-blue-200' };
		}
	}

	onMount(() => {
		// URL 쿼리 파라미터에서 초기 탭 및 앱 ID 추출
		const urlParams = $pageStore.url.searchParams;
		const queryTab = urlParams.get('tab');
		const queryApp = urlParams.get('app_id');

		if (queryTab && TABS.some(t => t.id === queryTab.toUpperCase())) {
			currentTab = queryTab.toUpperCase();
		}
		if (queryApp) {
			appFilter = queryApp;
		}

		refreshData();

		// 10초 주기 자동 갱신 타이머 가동
		refreshTimer = setInterval(() => {
			if (autoRefresh) {
				refreshData(true);
			}
		}, 10000);
	});

	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});
</script>

<svelte:head>
	<title>접속 기록·감사 로그 | jeju.live Core</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 실시간 컨트롤 바 -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Enterprise Observability
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/observability</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				접속 기록·<span class="not-italic text-blue-600">감사 로그</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				실시간 접속 세션 추적, 도메인 데이터 변경 Diff-Patch 감사, 시스템 장애 및 403 보안 위협 전사 관제
			</p>
		</div>

		<!-- 새로고침 및 다운로드 / 자동갱신 토글 -->
		<div class="flex flex-wrap items-center gap-3">
			<label class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
				<input type="checkbox" bind:checked={autoRefresh} class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
				<span class="flex items-center gap-1.5">
					<Icon icon="solar:refresh-circle-bold-duotone" class="text-base text-blue-600 {autoRefresh ? 'animate-spin' : ''}" />
					10초 자동 갱신
				</span>
			</label>

			<!-- 🖥️ 시스템 콘솔 원시 로그 파일 다운로드 버튼 -->
			<button
				onclick={handleDownloadSystemLog}
				class="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-100 shadow-sm transition hover:bg-slate-700 hover:text-white active:scale-95"
				title="서버 런타임 콘솔 표준 출력 원시 로그 파일(system.log) 다운로드"
			>
				<Icon icon="solar:server-square-bold-duotone" class="text-base text-emerald-400" />
				<span>시스템 콘솔 로그 (.log)</span>
			</button>

			<button
				onclick={() => refreshData(false)}
				class="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-600 active:scale-95"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>지금 새로고침</span>
			</button>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 핵심 지표 요약 카드 (Summary Cards) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<!-- 카드 1: 실시간 활성 세션 -->
		<button
			onclick={() => switchTab('SESSIONS')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition duration-200 {currentTab === 'SESSIONS' ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Live Sessions</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
					<Icon icon="solar:users-group-rounded-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition">
					{summary.active_sessions.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">명 접속 중</span>
				</div>
				<div class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					Redis 자기치유 활성
				</div>
			</div>
		</button>

		<!-- 카드 2: 오늘 접근/인증 -->
		<button
			onclick={() => switchTab('ACCESS')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition duration-200 {currentTab === 'ACCESS' ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Today Access</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
					<Icon icon="solar:shield-keyhole-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900 group-hover:text-blue-600 transition">
					{summary.today_access_count.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">건</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					로그인·로그아웃 이력
				</div>
			</div>
		</button>

		<!-- 카드 3: 데이터 변경 (Diff) -->
		<button
			onclick={() => switchTab('CHANGE')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition duration-200 {currentTab === 'CHANGE' ? 'border-amber-600 bg-amber-50/50 shadow-md ring-2 ring-amber-500/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Today Changes</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
					<Icon icon="solar:document-add-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900 group-hover:text-amber-600 transition">
					{summary.today_change_count.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">건 수정</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-amber-600">
					AuditMixin 자동 Diff 캡처
				</div>
			</div>
		</button>

		<!-- 카드 4: 장애 및 보안 경보 -->
		<button
			onclick={() => switchTab(summary.today_security_count > 0 ? 'SECURITY' : 'ERROR')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition duration-200 {currentTab === 'ERROR' || currentTab === 'SECURITY' ? 'border-rose-600 bg-rose-50/50 shadow-md ring-2 ring-rose-500/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Errors & Alerts</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
					<Icon icon="solar:danger-triangle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900 group-hover:text-rose-600 transition">
					{summary.today_error_alert_count.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">건 감지</span>
				</div>
				<div class="mt-1 text-xs font-semibold {summary.today_error_alert_count > 0 ? 'text-rose-600' : 'text-slate-400'}">
					{summary.today_error_alert_count > 0 ? '확인 필요한 장애/경보' : '이상 무 (정상 가동)'}
				</div>
			</div>
		</button>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 관제 탭 & 필터 툴바 -->
	<!-- ===================================================================== -->
	<div class="rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
		<!-- 탭 헤더 네비게이션 -->
		<div class="flex border-b border-slate-200 bg-slate-50/60 overflow-x-auto scrollbar-none">
			{#each TABS as tab}
				<button
					onclick={() => switchTab(tab.id)}
					class="flex items-center gap-2 border-b-2 px-5 py-4 text-xs font-black tracking-wide transition whitespace-nowrap {currentTab === tab.id ? 'border-blue-600 bg-white text-blue-600 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
				>
					<Icon icon={tab.icon} class="text-lg" />
					<span>{tab.label}</span>
					{#if tab.id === 'SESSIONS'}
						<span class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-black {tab.badgeColor}">
							{liveSessions.length}
						</span>
					{:else if tab.id === 'SECURITY' && (summary.today_security_count || 0) > 0}
						<span class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border-rose-200 border animate-pulse">
							{summary.today_security_count}
						</span>
					{:else if tab.id === 'ERROR' && (summary.today_errors_count || 0) > 0}
						<span class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border-rose-200 border">
							{summary.today_errors_count}
						</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- 필터 & 검색 컨트롤 바 (감사로그 탭일 때만 활성화) -->
		{#if currentTab !== 'SESSIONS'}
			<div class="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
				<div class="flex flex-wrap items-center gap-3">
					<!-- 앱별 필터 -->
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold text-slate-500">앱 선택:</span>
						<select
							value={appFilter}
							onchange={handleAppFilterChange}
							class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						>
							{#each APP_OPTIONS as opt}
								<option value={opt.id}>{opt.label}</option>
							{/each}
						</select>
					</div>

					<!-- 심각도 필터 -->
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold text-slate-500">심각도:</span>
						<select
							value={severityFilter}
							onchange={handleSeverityFilterChange}
							class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						>
							<option value="">전체 등급</option>
							<option value="INFO">INFO (일반)</option>
							<option value="WARN">WARN (주의)</option>
							<option value="ERROR">ERROR (오류)</option>
							<option value="CRITICAL">CRITICAL (치명)</option>
						</select>
					</div>

					<!-- 🔍 검색창 (키워드/사용자/메시지 검색 및 엔터키 바인딩) -->
					<div class="flex items-center gap-1.5">
						<div class="relative flex items-center">
							<Icon icon="solar:magnifer-linear" class="pointer-events-none absolute left-3 text-sm text-slate-400" />
							<input
								type="text"
								bind:value={searchKeyword}
								onkeydown={(e) => e.key === 'Enter' && handleSearch()}
								placeholder="제목, 내용, 사용자 검색..."
								class="w-44 rounded-xl border border-slate-300 bg-slate-50 py-1.5 pr-8 pl-8 text-xs font-medium text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none md:w-60"
							/>
							{#if searchKeyword}
								<button
									onclick={handleClearSearch}
									class="absolute right-2 rounded-full p-0.5 text-slate-400 hover:text-slate-600"
									title="검색어 지우기"
								>
									<Icon icon="solar:close-circle-bold" class="text-sm" />
								</button>
							{/if}
						</div>
						<button
							onclick={handleSearch}
							class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-600 active:scale-95"
						>
							검색
						</button>
					</div>
				</div>

				<!-- 우측 건수 표시 및 CSV 다운로드 버튼 -->
				<div class="flex flex-wrap items-center gap-3">
					<div class="text-xs font-bold text-slate-400">
						총 <span class="font-black text-blue-600">{totalCount.toLocaleString()}</span>건의 기록 보존 중
					</div>

					<!-- 📥 감사로그 CSV 다운로드 버튼 -->
					<button
						onclick={handleExportAuditCsv}
						class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-600 hover:text-white active:scale-95"
						title="현재 필터 조건에 부합하는 감사로그를 엑셀 호환 CSV 파일로 내보냅니다"
					>
						<Icon icon="solar:file-download-bold-duotone" class="text-base text-emerald-600 group-hover:text-white" />
						<span>CSV 내보내기</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- ================================================================= -->
		<!-- 4. 탭별 데이터 뷰 -->
		<!-- ================================================================= -->
		{#if loading}
			<div class="flex flex-col items-center justify-center py-20 text-slate-400">
				<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-blue-600" />
				<span class="mt-3 text-xs font-bold">실시간 관제 데이터를 동기화하는 중입니다...</span>
			</div>
		{:else}
			<!-- ------------------------------------------------------------- -->
			<!-- TAB 1: SESSIONS (실시간 접속 현황 및 강제 퇴장) -->
			<!-- ------------------------------------------------------------- -->
			{#if currentTab === 'SESSIONS'}
				{#if liveSessions.length === 0}
					<div class="py-20 text-center text-slate-400">
						<Icon icon="solar:ghost-bold" class="mx-auto h-12 w-12 text-slate-300" />
						<p class="mt-2 text-sm font-bold">현재 활성화된 접속 세션이 없습니다.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-left text-xs">
							<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
								<tr>
									<th class="px-5 py-3.5">사용자 / 소속</th>
									<th class="px-4 py-3.5">접속 기기 / 브라우저</th>
									<th class="px-4 py-3.5">접속 IP</th>
									<th class="px-4 py-3.5">최근 활동</th>
									<th class="px-4 py-3.5">로그인 시각</th>
									<th class="px-5 py-3.5 text-right">세션 제어</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
								{#each liveSessions as s}
									{@const devBadge = getDeviceBadge(s.device_category)}
									<tr class="hover:bg-slate-50/80 transition">
										<td class="px-5 py-4">
											<div class="flex items-center gap-3">
												<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-700">
													{(s.user_name || s.username || '?')[0]}
												</div>
												<div>
													<div class="flex items-center gap-1.5 font-black text-slate-900 text-sm">
														{s.user_name || '이름 없음'}
														<span class="text-xs font-normal text-slate-400">(@{s.username})</span>
														{#if s.is_active}
															<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
														{/if}
													</div>
													<div class="text-[11px] text-slate-500 font-normal mt-0.5">
														{s.department || '부서 미정'} · {s.role_name || '일반회원'}
													</div>
												</div>
											</div>
										</td>
										<td class="px-4 py-4">
											<div class="flex items-center gap-2">
												<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold {devBadge.color}">
													<Icon icon={devBadge.icon} class="text-xs" />
													{devBadge.text}
												</span>
											</div>
											<div class="text-[10px] text-slate-400 truncate max-w-[200px] mt-1" title={s.user_agent}>
												{s.user_agent || '-'}
											</div>
										</td>
										<td class="px-4 py-4 font-mono font-bold text-slate-600">
											{s.ip_address || '-'}
										</td>
										<td class="px-4 py-4">
											<span class="font-bold text-slate-900">{timeAgo(s.last_activity)}</span>
											<div class="text-[10px] text-slate-400">{formatDateTime(s.last_activity)}</div>
										</td>
										<td class="px-4 py-4 text-slate-500">
											{formatDateTime(s.login_at)}
										</td>
										<td class="px-5 py-4 text-right">
											<button
												onclick={() => handleKickSession(s)}
												class="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 shadow-sm transition hover:bg-rose-600 hover:text-white active:scale-95"
											>
												<Icon icon="solar:shield-cross-bold" class="text-sm" />
												강제 추방
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

			<!-- ------------------------------------------------------------- -->
			<!-- TAB 2, 3, 4, 5: 전사 감사로그 뷰 (ACCESS, CHANGE, ERROR, SECURITY) -->
			<!-- ------------------------------------------------------------- -->
			{:else}
				{#if auditLogs.length === 0}
					<div class="py-20 text-center text-slate-400">
						<Icon icon="solar:clipboard-list-broken" class="mx-auto h-12 w-12 text-slate-300" />
						<p class="mt-2 text-sm font-bold">조건에 해당하는 감사로그 기록이 없습니다.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-left text-xs">
							<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
								<tr>
									<th class="px-5 py-3.5">발생 일시</th>
									<th class="px-4 py-3.5">앱 / 분류</th>
									<th class="px-4 py-3.5">심각도</th>
									<th class="px-4 py-3.5">행위 (Action)</th>
									<th class="px-4 py-3.5">작업 수행자</th>
									<th class="px-4 py-3.5">상세 내용</th>
									<th class="px-5 py-3.5 text-right">상세 보기</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
								{#each auditLogs as log}
									<tr class="hover:bg-slate-50/80 transition">
										<td class="px-5 py-4 whitespace-nowrap">
											<div class="font-bold text-slate-900">{timeAgo(log.created_at)}</div>
											<div class="text-[10px] text-slate-400">{formatDateTime(log.created_at)}</div>
										</td>
										<td class="px-4 py-4 whitespace-nowrap">
											<div class="flex items-center gap-1.5">
												<span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 uppercase">
													{log.app_id || 'system'}
												</span>
											</div>
										</td>
										<td class="px-4 py-4 whitespace-nowrap">
											<span class="inline-block rounded-md border px-2 py-0.5 text-[10px] font-black {getSeverityBadge(log.severity)}">
												{log.severity}
											</span>
										</td>
										<td class="px-4 py-4 whitespace-nowrap">
											<span class="font-mono font-bold text-blue-700">{log.action}</span>
										</td>
										<td class="px-4 py-4">
											{#if log.user_summary}
												<div class="font-bold text-slate-900">{log.user_summary}</div>
											{:else if log.user_id}
												<div class="font-bold text-slate-700">사용자 #{log.user_id}</div>
											{:else}
												<div class="text-slate-400 font-normal">시스템 (익명)</div>
											{/if}
											{#if log.ip_address}
												<div class="text-[10px] font-mono text-slate-400">{log.ip_address}</div>
											{/if}
										</td>
										<td class="px-4 py-4 max-w-md">
											<div class="font-bold text-slate-900 truncate" title={log.title}>
												{log.title}
											</div>
											{#if log.message}
												<div class="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal" title={log.message}>
													{log.message}
												</div>
											{/if}
										</td>
										<td class="px-5 py-4 text-right whitespace-nowrap">
											{#if log.diff_payload && log.diff_payload.length > 0}
												<button
													onclick={() => (activeDiffLog = log)}
													class="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-500 hover:text-white"
												>
													<Icon icon="solar:git-commit-bold" class="text-sm" />
													Diff ({log.diff_payload.length})
												</button>
											{:else if log.log_type === 'ERROR' || log.severity === 'ERROR' || log.severity === 'CRITICAL'}
												<button
													onclick={() => (activeErrorLog = log)}
													class="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 transition hover:bg-rose-600 hover:text-white"
												>
													<Icon icon="solar:danger-bold" class="text-sm" />
													오류 상세
												</button>
											{:else}
												<span class="text-slate-300 text-xs">-</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- 페이지네이션 -->
					{#if totalCount > pageSize}
						<div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
							<div class="text-xs text-slate-500">
								총 {totalCount}개 중 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)}건 표시
							</div>
							<div class="flex items-center gap-2">
								<button
									disabled={currentPage <= 1}
									onclick={() => { currentPage--; refreshData(); }}
									class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
								>
									이전
								</button>
								<span class="text-xs font-bold text-slate-700">{currentPage}</span>
								<button
									disabled={currentPage * pageSize >= totalCount}
									onclick={() => { currentPage++; refreshData(); }}
									class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
								>
									다음
								</button>
							</div>
						</div>
					{/if}
				{/if}
			{/if}
		{/if}
	</div>
</div>

<!-- ========================================================================= -->
<!-- 5. Diff-Patch Git 스타일 시각 비교 모달 -->
<!-- ========================================================================= -->
{#if activeDiffLog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
		<div class="w-full max-w-3xl rounded-2xl border-2 border-slate-900 bg-white shadow-2xl overflow-hidden font-['Noto_Sans_KR']">
			<div class="flex items-center justify-between border-b-2 border-slate-900 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
						<Icon icon="solar:git-commit-bold" class="text-lg" />
					</div>
					<div>
						<h3 class="text-base font-black text-slate-900">
							데이터 변경 내역 (Diff-Patch)
						</h3>
						<p class="text-xs text-slate-500">
							{activeDiffLog.title} · {formatDateTime(activeDiffLog.created_at)}
						</p>
					</div>
				</div>
				<button
					onclick={() => (activeDiffLog = null)}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
				>
					<Icon icon="solar:close-circle-bold" class="text-2xl" />
				</button>
			</div>

			<div class="max-h-[60vh] overflow-y-auto p-6 space-y-4">
				<div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
					<div><span class="text-slate-400 font-bold">수정자:</span> <span class="text-slate-900 font-black">{activeDiffLog.user_summary || '시스템'}</span></div>
					<div><span class="text-slate-400 font-bold">대상 앱:</span> <span class="font-mono text-blue-600 font-bold">{activeDiffLog.app_id}</span></div>
					<div><span class="text-slate-400 font-bold">리소스 타입:</span> <span class="font-mono text-slate-700 font-bold">{activeDiffLog.resource_type || '-'}</span></div>
					<div><span class="text-slate-400 font-bold">리소스 ID:</span> <span class="font-mono text-slate-700 font-bold">#{activeDiffLog.resource_id || '-'}</span></div>
				</div>

				<div class="overflow-x-auto rounded-xl border border-slate-200">
					<table class="w-full text-left text-xs">
						<thead class="bg-slate-100 font-black text-slate-600 border-b border-slate-200">
							<tr>
								<th class="px-4 py-2.5 w-1/4">수정된 필드 (Field)</th>
								<th class="px-4 py-2.5 w-3/8 text-rose-700 bg-rose-50/50">수정 전 (Before)</th>
								<th class="px-4 py-2.5 w-3/8 text-emerald-700 bg-emerald-50/50">수정 후 (After)</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 font-mono">
							{#each activeDiffLog.diff_payload as diff}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 font-bold text-slate-900 break-all">
										{diff.field}
									</td>
									<td class="px-4 py-3 bg-rose-50/30 text-rose-700 break-all">
										{#if diff.from === null || diff.from === undefined}
											<span class="italic text-slate-400">null</span>
										{:else}
											<span class="line-through bg-rose-100 px-1.5 py-0.5 rounded text-rose-900">{diff.from}</span>
										{/if}
									</td>
									<td class="px-4 py-3 bg-emerald-50/30 text-emerald-700 break-all font-bold">
										{#if diff.to === null || diff.to === undefined}
											<span class="italic text-slate-400">null</span>
										{:else}
											<span class="bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">{diff.to}</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-right">
				<button
					onclick={() => (activeDiffLog = null)}
					class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-blue-600 transition"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ========================================================================= -->
<!-- 6. 에러 스택 트레이스 상세 모달 -->
<!-- ========================================================================= -->
{#if activeErrorLog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
		<div class="w-full max-w-3xl rounded-2xl border-2 border-slate-900 bg-white shadow-2xl overflow-hidden font-['Noto_Sans_KR']">
			<div class="flex items-center justify-between border-b-2 border-slate-900 bg-rose-50 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white">
						<Icon icon="solar:danger-triangle-bold" class="text-lg" />
					</div>
					<div>
						<h3 class="text-base font-black text-rose-900">
							서버 장애 및 오류 세부 내역
						</h3>
						<p class="text-xs text-rose-700 font-mono">
							Request-ID: {activeErrorLog.metadata?.request_id || '-'} · {formatDateTime(activeErrorLog.created_at)}
						</p>
					</div>
				</div>
				<button
					onclick={() => (activeErrorLog = null)}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
				>
					<Icon icon="solar:close-circle-bold" class="text-2xl" />
				</button>
			</div>

			<div class="max-h-[60vh] overflow-y-auto p-6 space-y-4">
				<div>
					<span class="text-xs font-bold text-slate-400">오류 제목:</span>
					<div class="mt-1 font-bold text-slate-900 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
						{activeErrorLog.title}
					</div>
				</div>

				{#if activeErrorLog.message}
					<div>
						<span class="text-xs font-bold text-slate-400">오류 메시지 / 스택 트레이스:</span>
						<pre class="mt-1 font-mono text-xs bg-slate-900 text-rose-300 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-80 leading-relaxed border border-slate-800">{activeErrorLog.message}</pre>
					</div>
				{/if}

				{#if activeErrorLog.metadata && Object.keys(activeErrorLog.metadata).length > 0}
					<div>
						<span class="text-xs font-bold text-slate-400">요청 컨텍스트 메타데이터:</span>
						<pre class="mt-1 font-mono text-xs bg-slate-100 text-slate-800 p-3.5 rounded-xl overflow-x-auto">{JSON.stringify(activeErrorLog.metadata, null, 2)}</pre>
					</div>
				{/if}
			</div>

			<div class="border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-right">
				<button
					onclick={() => (activeErrorLog = null)}
					class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-rose-600 transition"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}
