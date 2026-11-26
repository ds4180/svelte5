<script lang="ts">
	/**
	 * ============================================================================
	 * [전사 통합 감사로그 및 시스템 관제 센터 오케스트레이터 (+page.svelte)]
	 * ============================================================================
	 * - 관리자 표준 템플릿(통합 헤더 + 4대 핵심 지표 카드 + 탭 바 + 우측 끝 '설정' 탭) 구조로 정비
	 * - 하드코딩된 갱신주기·페이지크기·세션한도·CSV상한·window.confirm을 전면 제거하고
	 *   observabilityAdminService 및 전용 탭·모달·정책 설정 컴포넌트로 책임을 분리합니다.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import * as api from '$lib/api/admin';
	import { getSiteTitle } from '$lib/config/site';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		buildAppFilterOptions,
		DEFAULT_OBSERVABILITY_SETTINGS,
		normalizeObservabilitySettings,
		OBSERVABILITY_LOG_TABS,
		type AuditLogItem,
		type LiveSessionItem,
		type ObservabilitySettings,
		type ObservabilitySummary,
		type ObservabilityTabId
	} from '$lib/services/observabilityAdminService';
	import { formatApiError } from '$lib/utils/error';

	import ObservabilityLogsTab from './components/ObservabilityLogsTab.svelte';
	import ObservabilityModals from './components/ObservabilityModals.svelte';
	import ObservabilitySessionsTab from './components/ObservabilitySessionsTab.svelte';
	import ObservabilitySettingsTab from './components/ObservabilitySettingsTab.svelte';

	const auth = getAuthContext();
	const userRank = $derived(Number(auth.user?.rank_level ?? 0));

	// --- 동적 정책 및 권한 상태 ---
	let obsSettings = $state<ObservabilitySettings>(
		normalizeObservabilitySettings(DEFAULT_OBSERVABILITY_SETTINGS)
	);
	let builtinMaskFields = $state<string[]>([
		'password',
		'resident_no',
		'account_no',
		'secret',
		'token',
		'session_key',
		'credit_card'
	]);
	let serverCanWrite = $state<boolean | null>(null);
	const canWrite = $derived(serverCanWrite !== null ? serverCanWrite : userRank >= 4);

	// --- 상단 4대 핵심 지표 요약 ---
	let summary = $state<ObservabilitySummary>({
		active_sessions: 0,
		today_access_count: 0,
		today_change_count: 0,
		today_error_alert_count: 0,
		today_security_count: 0,
		today_errors_count: 0,
		app_options: []
	});

	// --- 탭 및 필터 상태 ---
	let currentTab = $state<ObservabilityTabId>('SESSIONS');
	let appFilter = $state('');
	let severityFilter = $state('');
	let searchKeyword = $state('');
	let currentPage = $state(1);
	let totalCount = $state(0);
	let includeSessionHistory = $state(false);

	// --- 데이터 및 UI 상태 ---
	let liveSessions = $state<LiveSessionItem[]>([]);
	let auditLogs = $state<AuditLogItem[]>([]);
	let loading = $state(true);
	let autoRefresh = $state(true);

	// --- 모달 상태 ---
	let activeDiffLog = $state<AuditLogItem | null>(null);
	let activeDetailLog = $state<AuditLogItem | null>(null);
	let kickTargetSession = $state<LiveSessionItem | null>(null);
	let isKicking = $state(false);

	const appOptions = $derived(buildAppFilterOptions(summary?.app_options || [], appFilter));

	async function loadSettings() {
		try {
			const res = await api.adminGetObservabilitySettings<{
				settings: ObservabilitySettings;
				builtin_mask_fields?: string[];
				permissions?: { can_write?: boolean };
			}>();
			if (res?.settings) {
				obsSettings = normalizeObservabilitySettings(res.settings);
				autoRefresh = obsSettings.ui_auto_refresh_default;
			}
			if (Array.isArray(res?.builtin_mask_fields) && res.builtin_mask_fields.length > 0) {
				builtinMaskFields = res.builtin_mask_fields;
			}
			if (typeof res?.permissions?.can_write === 'boolean') {
				serverCanWrite = res.permissions.can_write;
			}
		} catch (err) {
			console.error('관제 정책 설정 로드 실패:', err);
		}
	}

	async function refreshData(silent = false) {
		if (!silent) loading = true;
		try {
			const sumRes = await api.adminGetObservabilitySummary<ObservabilitySummary>().catch(() => null);
			if (sumRes) summary = sumRes;

			if (currentTab === 'SETTINGS') {
				return;
			}

			if (currentTab === 'SESSIONS') {
				liveSessions = await api.adminGetLiveSessions<LiveSessionItem[]>(
					includeSessionHistory,
					obsSettings.ui_session_history_limit
				);
				totalCount = liveSessions.length;
			} else {
				const pageSize = obsSettings.ui_log_page_size || 20;
				const logRes = await api.adminGetAuditLogs<{ items: AuditLogItem[]; total: number }>({
					log_type: currentTab,
					app_id: appFilter || undefined,
					severity: severityFilter || undefined,
					query: searchKeyword.trim() || undefined,
					page: currentPage,
					page_size: pageSize
				});
				auditLogs = logRes?.items || [];
				totalCount = logRes?.total || 0;
			}
		} catch (err) {
			if (!silent) toast.error(formatApiError(err, '관제 데이터를 불러오지 못했습니다.'));
		} finally {
			if (!silent) loading = false;
		}
	}

	function switchTab(tabId: ObservabilityTabId) {
		currentTab = tabId;
		currentPage = 1;
		if (tabId !== 'SETTINGS') {
			refreshData();
		}
	}

	function handleExportAuditCsv() {
		if (!obsSettings.allow_csv_export) {
			toast.warning('현재 관제 정책에 의해 CSV 내보내기가 비활성화되어 있습니다.');
			return;
		}
		const url = api.adminGetAuditLogsExportUrl({
			log_type: currentTab !== 'SESSIONS' && currentTab !== 'SETTINGS' ? currentTab : undefined,
			app_id: appFilter || undefined,
			severity: severityFilter || undefined,
			query: searchKeyword.trim() || undefined,
			limit: obsSettings.csv_export_max_rows
		});
		toast.info(`감사로그 CSV 다운로드(최대 ${obsSettings.csv_export_max_rows.toLocaleString()}건)를 시작합니다...`);
		window.location.href = url;
	}

	function handleDownloadSystemLog() {
		if (!obsSettings.allow_system_log_download) {
			toast.warning('현재 관제 정책에 의해 원시 콘솔 로그 다운로드가 비활성화되어 있습니다.');
			return;
		}
		const url = api.adminGetSystemLogDownloadUrl();
		toast.info(`서버 콘솔 로그(최대 ${obsSettings.system_log_max_download_mb}MB) 다운로드를 시작합니다...`);
		window.location.href = url;
	}

	async function handleConfirmKick(session: LiveSessionItem) {
		isKicking = true;
		try {
			await api.adminKickLiveSession(session.id);
			const label = session.real_name || session.username || `세션 #${session.id}`;
			toast.success(`${label} 세션이 성공적으로 강제 종료되었습니다.`);
			kickTargetSession = null;
			await refreshData(false);
		} catch (err) {
			toast.error(formatApiError(err, '세션 강제 종료에 실패했습니다.'));
		} finally {
			isKicking = false;
		}
	}

	async function handleSettingsSaved(updated: ObservabilitySettings) {
		obsSettings = updated;
		currentPage = 1;
		await refreshData(true);
	}

	onMount(async () => {
		const urlParams = page.url.searchParams;
		const queryTab = urlParams.get('tab')?.toUpperCase() as ObservabilityTabId | undefined;
		const queryApp = urlParams.get('app_id');

		if (
			queryTab &&
			(OBSERVABILITY_LOG_TABS.some((t) => t.id === queryTab) || queryTab === 'SETTINGS')
		) {
			currentTab = queryTab;
		}
		if (queryApp) {
			appFilter = queryApp;
		}

		await loadSettings();
		await refreshData();
	});

	// 동적 주기 자동 갱신 타이머 (설정된 ui_auto_refresh_sec 즉시 반영)
	$effect(() => {
		const enabled = autoRefresh && currentTab !== 'SETTINGS';
		const intervalMs = Math.max(3, Number(obsSettings.ui_auto_refresh_sec) || 10) * 1000;
		if (!enabled) return;

		const timer = setInterval(() => {
			refreshData(true);
		}, intervalMs);

		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>{getSiteTitle('접속 기록·감사 로그')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8 pb-20">
	<!-- 1. 통합 관리자 헤더 & 실시간 컨트롤 바 -->
	<header class="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-0.5 text-[11px] font-black tracking-wider text-emerald-400 uppercase">
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
					ENTERPRISE OBSERVABILITY
				</span>
				<span class="text-xs font-bold text-slate-400">
					Watchdog {obsSettings.watchdog_enabled ? 'ON' : 'PAUSED'} · 감사로그 {obsSettings.audit_log_retention_days}일 보존
				</span>
			</div>
			<h1 class="mt-1.5 text-xl sm:text-2xl font-black tracking-tight text-slate-900">
				접속 기록 · <span class="text-blue-600">전사 감사 로그 관제</span>
			</h1>
			<p class="mt-1 text-xs sm:text-sm font-medium text-slate-500">
				실시간 접속 세션 추적, 데이터 변경 Diff-Patch 감사, 장애·보안 위협 및 자율 감시 정책을 통합 관리합니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5">
			<label class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50">
				<input
					type="checkbox"
					bind:checked={autoRefresh}
					class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
				/>
				<span>{obsSettings.ui_auto_refresh_sec}초 자동 갱신</span>
			</label>

			{#if obsSettings.allow_system_log_download}
				<button
					type="button"
					onclick={handleDownloadSystemLog}
					class="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-100 shadow-2xs transition hover:bg-slate-700 active:scale-95"
					title="서버 런타임 원시 콘솔 로그(최대 {obsSettings.system_log_max_download_mb}MB) 다운로드"
				>
					<Icon icon="solar:server-square-bold-duotone" class="text-base text-emerald-400" />
					<span>콘솔 로그 (.log)</span>
				</button>
			{/if}

			<button
				type="button"
				onclick={() => refreshData(false)}
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:refresh-bold" class="text-base {loading ? 'animate-spin text-blue-600' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
			>
				<Icon icon="solar:home-2-bold" class="text-base" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- 2. 상단 4대 핵심 지표 요약 카드 -->
	<div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
		<button
			type="button"
			onclick={() => switchTab('SESSIONS')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-4 sm:p-5 text-left transition {currentTab === 'SESSIONS' ? 'border-emerald-600 bg-emerald-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase truncate">Live Sessions</span>
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
					<Icon icon="solar:users-group-rounded-bold-duotone" class="text-lg" />
				</div>
			</div>
			<div class="mt-3">
				<div class="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition">
					{summary.active_sessions.toLocaleString()}
					<span class="text-xs font-bold text-slate-500">명 접속</span>
				</div>
				<div class="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
					Redis 자기치유 활성
				</div>
			</div>
		</button>

		<button
			type="button"
			onclick={() => switchTab('ACCESS')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-4 sm:p-5 text-left transition {currentTab === 'ACCESS' ? 'border-blue-600 bg-blue-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase truncate">Today Access</span>
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
					<Icon icon="solar:shield-keyhole-bold-duotone" class="text-lg" />
				</div>
			</div>
			<div class="mt-3">
				<div class="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-blue-600 transition">
					{summary.today_access_count.toLocaleString()}
					<span class="text-xs font-bold text-slate-500">건</span>
				</div>
				<div class="mt-1 text-[11px] font-semibold text-slate-400">오늘 로그인·인증 이력</div>
			</div>
		</button>

		<button
			type="button"
			onclick={() => switchTab('CHANGE')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-4 sm:p-5 text-left transition {currentTab === 'CHANGE' ? 'border-amber-600 bg-amber-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase truncate">Today Changes</span>
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
					<Icon icon="solar:document-add-bold-duotone" class="text-lg" />
				</div>
			</div>
			<div class="mt-3">
				<div class="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-amber-600 transition">
					{summary.today_change_count.toLocaleString()}
					<span class="text-xs font-bold text-slate-500">건 수정</span>
				</div>
				<div class="mt-1 text-[11px] font-semibold text-amber-600">
					Diff 마스킹 {obsSettings.audit_mask_sensitive_fields ? '보호 중' : '해제됨'}
				</div>
			</div>
		</button>

		<button
			type="button"
			onclick={() => switchTab(summary.today_security_count > 0 ? 'SECURITY' : 'ERROR')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-4 sm:p-5 text-left transition {currentTab === 'ERROR' || currentTab === 'SECURITY' ? 'border-rose-600 bg-rose-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase truncate">Errors & Alerts</span>
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
					<Icon icon="solar:danger-triangle-bold-duotone" class="text-lg" />
				</div>
			</div>
			<div class="mt-3">
				<div class="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-rose-600 transition">
					{summary.today_error_alert_count.toLocaleString()}
					<span class="text-xs font-bold text-slate-500">건 감지</span>
				</div>
				<div class="mt-1 text-[11px] font-semibold {summary.today_error_alert_count > 0 ? 'text-rose-600' : 'text-slate-400'}">
					{summary.today_error_alert_count > 0 ? '확인 필요한 장애·보안 경보' : '이상 무 (정상 가동)'}
				</div>
			</div>
		</button>
	</div>

	<!-- 3. 메인 워크스페이스 패널 (표준 탭 바 + 우측 끝 '설정' 탭) -->
	<div class="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
		<div class="flex items-center border-b border-slate-200 bg-slate-50/70 overflow-x-auto scrollbar-none">
			{#each OBSERVABILITY_LOG_TABS as tab (tab.id)}
				<button
					type="button"
					onclick={() => switchTab(tab.id)}
					class="flex items-center gap-1.5 border-b-2 px-4 sm:px-5 py-3.5 text-xs font-black tracking-wide transition whitespace-nowrap {currentTab === tab.id ? 'border-blue-600 bg-white text-blue-600' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
				>
					<Icon icon={tab.icon} class="text-base" />
					<span>{tab.label}</span>
					{#if tab.id === 'SESSIONS'}
						<span class="ml-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-black {tab.badgeColor}">
							{summary.active_sessions}
						</span>
					{:else if tab.id === 'SECURITY' && (summary.today_security_count || 0) > 0}
						<span class="ml-0.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-700 animate-pulse">
							{summary.today_security_count}
						</span>
					{:else if tab.id === 'ERROR' && (summary.today_errors_count || 0) > 0}
						<span class="ml-0.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
							{summary.today_errors_count}
						</span>
					{/if}
				</button>
			{/each}

			{#if canWrite}
				<button
					type="button"
					onclick={() => switchTab('SETTINGS')}
					class="ml-auto flex items-center gap-1.5 border-b-2 px-4 sm:px-5 py-3.5 text-xs font-black tracking-wide transition whitespace-nowrap {currentTab === 'SETTINGS' ? 'border-indigo-600 bg-white text-indigo-600' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-indigo-700'}"
				>
					<Icon icon="solar:settings-bold-duotone" class="text-base" />
					<span>설정</span>
				</button>
			{/if}
		</div>

		<!-- 탭별 컨텐츠 -->
		{#if currentTab === 'SESSIONS'}
			<ObservabilitySessionsTab
				sessions={liveSessions}
				activeSessionsCount={summary.active_sessions}
				includeHistory={includeSessionHistory}
				historyLimit={obsSettings.ui_session_history_limit}
				isLoading={loading}
				{canWrite}
				onToggleHistory={(next) => {
					includeSessionHistory = next;
					refreshData();
				}}
				onRequestKick={(session) => (kickTargetSession = session)}
			/>
		{:else if currentTab === 'SETTINGS'}
			<ObservabilitySettingsTab
				settings={obsSettings}
				{builtinMaskFields}
				{canWrite}
				onSaved={handleSettingsSaved}
			/>
		{:else}
			<ObservabilityLogsTab
				logs={auditLogs}
				{totalCount}
				{currentPage}
				pageSize={obsSettings.ui_log_page_size}
				isLoading={loading}
				{appOptions}
				{appFilter}
				{severityFilter}
				{searchKeyword}
				settings={obsSettings}
				onAppFilterChange={(nextApp) => {
					appFilter = nextApp;
					currentPage = 1;
					refreshData();
				}}
				onSeverityFilterChange={(nextSev) => {
					severityFilter = nextSev;
					currentPage = 1;
					refreshData();
				}}
				onSearchSubmit={(kw) => {
					searchKeyword = kw;
					currentPage = 1;
					refreshData();
				}}
				onPageChange={(nextPage) => {
					currentPage = nextPage;
					refreshData();
				}}
				onExportCsv={handleExportAuditCsv}
				onOpenDiff={(log) => (activeDiffLog = log)}
				onOpenDetail={(log) => (activeDetailLog = log)}
			/>
		{/if}
	</div>
</div>

<!-- 모달 묶음 (Diff-Patch · 로그/오류 상세 · 세션 추방 확인) -->
<ObservabilityModals
	{activeDiffLog}
	onCloseDiff={() => (activeDiffLog = null)}
	{activeDetailLog}
	onCloseDetail={() => (activeDetailLog = null)}
	{kickTargetSession}
	{isKicking}
	onCloseKick={() => (kickTargetSession = null)}
	onConfirmKick={handleConfirmKick}
/>
