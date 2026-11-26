<script lang="ts">
	/**
	 * ============================================================================
	 * [백그라운드 태스크 & 자율신경계 관제 오케스트레이터 ((app)/v1/admin/tasks/+page.svelte)]
	 * ============================================================================
	 * - 관리자 표준 템플릿(통합 헤더 + 4대 동적 상태 카드 + 탭 바 + 우측 끝 '설정' 탭) 구조로 정비
	 * - 하드코딩된 상태·수치·크론 프리셋·window.confirm을 전면 제거하고
	 *   taskAdminService 및 전용 탭·모달·정책 설정 컴포넌트로 책임을 분리합니다.
	 */
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import {
		adminCancelTask,
		adminClearFailedTasks,
		adminCreateTask,
		adminGetTaskSettings,
		adminGetTasks,
		adminGetTasksSummary,
		adminGetTaskTypes,
		adminRetryTask,
		adminUpdateTask
	} from '$lib/api/admin';
	import { getSiteTitle } from '$lib/config/site';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		DEFAULT_TASK_SETTINGS,
		normalizeTaskSettings,
		type TaskSettings,
		type TaskSummary,
		type TaskTypeMeta
	} from '$lib/services/taskAdminService';
	import { formatApiError } from '$lib/utils/error';

	import TaskListTab from './components/TaskListTab.svelte';
	import TaskModals, { type TaskConfirmAction } from './components/TaskModals.svelte';
	import TaskRegisterTab from './components/TaskRegisterTab.svelte';
	import TaskSettingsTab from './components/TaskSettingsTab.svelte';

	const auth = getAuthContext();
	const userRank = $derived(Number(auth.user?.rank_level ?? 0));

	// --- 동적 정책 및 거버넌스 권한 상태 ---
	let taskSettings = $state<TaskSettings>(normalizeTaskSettings(DEFAULT_TASK_SETTINGS));
	let serverCanWrite = $state<boolean | null>(null);
	const canWrite = $derived(serverCanWrite !== null ? serverCanWrite : userRank >= 8);

	// --- 탭 및 필터 상태 ---
	type ActiveTab = 'monitor' | 'schedule' | 'register' | 'settings';
	let activeTab = $state<ActiveTab>('monitor');
	let selectedStatus = $state('');
	let searchQuery = $state('');
	let autoRefresh = $state(true);
	let isLoading = $state(false);

	// --- 관제 데이터 상태 ---
	let summary = $state<TaskSummary>({
		worker_status: 'ONLINE',
		worker_enabled: true,
		poll_interval_sec: 2,
		pending_count: 0,
		running_count: 0,
		failed_count: 0,
		scheduler_count: 0,
		completed_24h_count: 0
	});
	let taskTypes = $state<TaskTypeMeta[]>([]);
	let tasks = $state<any[]>([]);
	let totalTasks = $state(0);

	// --- 모달 상태 ---
	let detailTask = $state<any | null>(null);
	let editingTask = $state<any | null>(null);
	let confirmAction = $state<TaskConfirmAction | null>(null);
	let isConfirmBusy = $state(false);

	async function loadSettingsAndMeta() {
		try {
			const [cfgRes, typesRes] = await Promise.all([
				adminGetTaskSettings<{ settings: TaskSettings; permissions?: { can_write?: boolean } }>(),
				adminGetTaskTypes<TaskTypeMeta[] | { items: TaskTypeMeta[] }>()
			]);
			if (cfgRes?.settings) {
				taskSettings = normalizeTaskSettings(cfgRes.settings);
				autoRefresh = taskSettings.ui_auto_refresh_default;
			}
			if (typeof cfgRes?.permissions?.can_write === 'boolean') {
				serverCanWrite = cfgRes.permissions.can_write;
			}
			taskTypes = Array.isArray(typesRes) ? typesRes : typesRes?.items || [];
		} catch (err) {
			console.error('태스크 설정·유형 로드 실패:', err);
		}
	}

	async function loadSummary() {
		try {
			const res = await adminGetTasksSummary<TaskSummary>();
			if (res) summary = res;
		} catch (err) {
			console.error('태스크 요약 지표 로드 실패:', err);
		}
	}

	async function loadTasks(silent = false) {
		if (activeTab !== 'monitor' && activeTab !== 'schedule') return;
		if (!silent) isLoading = true;
		try {
			const res = await adminGetTasks<{ total: number; tasks?: any[]; items?: any[] }>({
				status: selectedStatus || undefined,
				is_scheduler: activeTab === 'schedule' ? true : undefined,
				search: searchQuery.trim() || undefined,
				limit: taskSettings.ui_page_limit || 50
			});
			tasks = res?.tasks || res?.items || [];
			totalTasks = res?.total ?? tasks.length;
		} catch (err) {
			if (!silent) toast.error(formatApiError(err, '태스크 목록을 불러오지 못했습니다.'));
		} finally {
			if (!silent) isLoading = false;
		}
	}

	async function refreshAll(silent = false) {
		await Promise.all([loadSummary(), loadTasks(silent)]);
	}

	function switchTab(nextTab: ActiveTab, statusFilter?: string) {
		activeTab = nextTab;
		if (statusFilter !== undefined) {
			selectedStatus = statusFilter;
		}
		if (nextTab === 'monitor' || nextTab === 'schedule') {
			loadTasks();
		}
	}

	// --- 액션 핸들러 (모두 커스텀 확인 모달 경유) ---
	function requestRetryTask(taskId: number) {
		confirmAction = {
			title: `작업 #${taskId} 즉시 재실행`,
			description:
				'선택한 실패 작업을 즉시 실행 대기열(PENDING)로 재투입합니다.\n재시도 카운트가 초기화되고 워커가 우선 처리합니다.',
			confirmLabel: '지금 다시 실행',
			tone: 'primary',
			onConfirm: async () => {
				isConfirmBusy = true;
				try {
					await adminRetryTask(taskId);
					toast.success(`작업 #${taskId} 재실행 요청이 등록되었습니다.`);
					confirmAction = null;
					await refreshAll(true);
				} catch (err) {
					toast.error(formatApiError(err, '재실행 요청 실패'));
				} finally {
					isConfirmBusy = false;
				}
			}
		};
	}

	function requestCancelTask(taskId: number) {
		confirmAction = {
			title: `대기 작업 #${taskId} 취소`,
			description:
				'현재 실행 대기 중인 작업을 취소(CANCELLED) 상태로 전환합니다.\n정기 스케줄 작업인 경우 다음 자동 실행도 중단됩니다.',
			confirmLabel: '작업 취소하기',
			tone: 'danger',
			onConfirm: async () => {
				isConfirmBusy = true;
				try {
					await adminCancelTask(taskId, false);
					toast.info(`작업 #${taskId}이(가) 취소되었습니다.`);
					confirmAction = null;
					await refreshAll(true);
				} catch (err) {
					toast.error(formatApiError(err, '작업 취소 실패'));
				} finally {
					isConfirmBusy = false;
				}
			}
		};
	}

	function requestHardDeleteTask(taskId: number) {
		confirmAction = {
			title: `작업 #${taskId} 영구 삭제`,
			description:
				'해당 작업 레코드와 오류 로그를 데이터베이스에서 완전히 삭제합니다.\n이 작업은 되돌릴 수 없습니다.',
			confirmLabel: '영구 삭제',
			tone: 'danger',
			onConfirm: async () => {
				isConfirmBusy = true;
				try {
					await adminCancelTask(taskId, true);
					toast.success(`작업 #${taskId} 내역이 영구 삭제되었습니다.`);
					confirmAction = null;
					await refreshAll(true);
				} catch (err) {
					toast.error(formatApiError(err, '영구 삭제 실패'));
				} finally {
					isConfirmBusy = false;
				}
			}
		};
	}

	function requestClearAllFailed() {
		if (summary.failed_count <= 0) return;
		confirmAction = {
			title: `실패 작업 ${summary.failed_count}건 일괄 영구 정리`,
			description: `현재 누적된 FAILED 상태 작업 ${summary.failed_count}건을 데이터베이스에서 일괄 영구 삭제합니다.\n원인 확인이 끝난 뒤 정리하는 것을 권장합니다.`,
			confirmLabel: `${summary.failed_count}건 일괄 삭제`,
			tone: 'danger',
			onConfirm: async () => {
				isConfirmBusy = true;
				try {
					const res = await adminClearFailedTasks<{ deleted_count: number; message: string }>('FAILED');
					toast.success(res?.message || '실패 작업이 일괄 정리되었습니다.');
					confirmAction = null;
					await refreshAll(true);
				} catch (err) {
					toast.error(formatApiError(err, '일괄 삭제 실패'));
				} finally {
					isConfirmBusy = false;
				}
			}
		};
	}

	async function handleCreateManualTask(
		payload: Record<string, any>,
		label: string,
		isRecurring: boolean
	) {
		await adminCreateTask(payload);
		toast.success(`'${label}' 작업이 정상 등록되었습니다.`);
		activeTab = isRecurring ? 'schedule' : 'monitor';
		selectedStatus = '';
		await refreshAll();
	}

	async function handleSaveEditedTask(taskId: number, payload: Record<string, any>) {
		try {
			await adminUpdateTask(taskId, payload);
			toast.success(`작업 #${taskId} 스케줄 및 옵션이 수정되었습니다.`);
			editingTask = null;
			await refreshAll(true);
		} catch (err) {
			toast.error(formatApiError(err, '스케줄 수정에 실패했습니다.'));
			throw err;
		}
	}

	async function handleSettingsSaved(updated: TaskSettings) {
		taskSettings = updated;
		await loadSummary();
	}

	onMount(async () => {
		await loadSettingsAndMeta();
		await refreshAll();
	});

	// 동적 주기 자동 갱신 타이머 (설정된 ui_auto_refresh_sec 즉시 반영)
	$effect(() => {
		const enabled = autoRefresh && (activeTab === 'monitor' || activeTab === 'schedule');
		const intervalMs = Math.max(3, Number(taskSettings.ui_auto_refresh_sec) || 10) * 1000;
		if (!enabled) return;

		const timer = setInterval(() => {
			refreshAll(true);
		}, intervalMs);

		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>{getSiteTitle('백그라운드 태스크 및 스케줄 관제')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
	<!-- 상단 통합 관리자 헤더 -->
	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<span class="rounded-md bg-blue-600 px-2.5 py-0.5 text-[11px] font-black tracking-wider text-white uppercase">
					AUTONOMIC WORKER
				</span>
				<span class="text-xs font-bold text-slate-400">System Background Queue & Cron Engine</span>
			</div>
			<h1 class="mt-1.5 text-xl sm:text-2xl font-black tracking-tight text-slate-900">
				백그라운드 작업 및 자동 스케줄 관제
			</h1>
			<p class="mt-1 text-xs sm:text-sm font-medium text-slate-500">
				정기 자동화 스케줄, 비동기 미디어·데이터 처리 큐, 워커 자가치유 및 경보 정책을 통합 제어합니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5">
			<label class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs">
				<input
					type="checkbox"
					bind:checked={autoRefresh}
					class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
				/>
				<span>{taskSettings.ui_auto_refresh_sec}초 자동 갱신</span>
			</label>

			<button
				type="button"
				onclick={() => refreshAll()}
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:refresh-bold" class="h-4 w-4 {isLoading ? 'animate-spin text-blue-600' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
			>
				<Icon icon="solar:home-2-bold" class="h-4 w-4" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- 상단 4대 동적 관제 지표 카드 -->
	<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
		<!-- 1. 워커 엔진 가동 상태 (동적 ONLINE / PAUSED 표시) -->
		<button
			type="button"
			onclick={() => canWrite && switchTab('settings')}
			class="text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition {summary.worker_status === 'PAUSED' ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400' : 'border-slate-200 bg-white hover:border-blue-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-bold text-slate-500 uppercase">Worker Engine</span>
				<span class="flex h-2.5 w-2.5 relative">
					{#if summary.worker_status === 'PAUSED'}
						<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
					{:else}
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
					{/if}
				</span>
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<span class="text-lg sm:text-xl font-black {summary.worker_status === 'PAUSED' ? 'text-amber-700' : 'text-emerald-600'}">
					{summary.worker_status === 'PAUSED' ? '일시정지 (PAUSED)' : '정상 가동 중'}
				</span>
			</div>
			<p class="mt-1 text-[11px] font-medium text-slate-400">
				현재 {summary.running_count}건 실행 중 · {taskSettings.worker_poll_interval_sec}초 폴링
			</p>
		</button>

		<!-- 2. 실행 대기열 -->
		<button
			type="button"
			onclick={() => switchTab('monitor', 'PENDING')}
			class="text-left rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition hover:border-blue-400"
		>
			<span class="text-[11px] font-bold text-slate-500 uppercase">Pending Queue</span>
			<div class="mt-2 text-lg sm:text-2xl font-black text-slate-900">
				{summary.pending_count}건 <span class="text-xs sm:text-sm font-bold text-slate-400">대기</span>
			</div>
			<p class="mt-1 text-[11px] font-medium text-slate-400">
				최근 24시간 완료: {(summary.completed_24h_count ?? 0).toLocaleString()}건
			</p>
		</button>

		<!-- 3. 정기 자동화 스케줄 -->
		<button
			type="button"
			onclick={() => switchTab('schedule', '')}
			class="text-left rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition hover:border-blue-400"
		>
			<span class="text-[11px] font-bold text-slate-500 uppercase">Scheduled Cron</span>
			<div class="mt-2 text-lg sm:text-2xl font-black text-blue-600">
				{summary.scheduler_count}개 <span class="text-xs sm:text-sm font-bold text-slate-400">활성</span>
			</div>
			<p class="mt-1 text-[11px] font-medium text-slate-400">정기 예약 일정표 확인하기</p>
		</button>

		<!-- 4. 실패 / 확인 필요 -->
		<button
			type="button"
			onclick={() => switchTab('monitor', 'FAILED')}
			class="text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition {summary.failed_count > 0 ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<span class="text-[11px] font-bold text-slate-500 uppercase">Failed Tasks</span>
			<div class="mt-2 text-lg sm:text-2xl font-black {summary.failed_count > 0 ? 'text-rose-600' : 'text-slate-900'}">
				{summary.failed_count}건 <span class="text-xs sm:text-sm font-bold text-slate-400">오류</span>
			</div>
			<p class="mt-1 text-[11px] font-medium {summary.failed_count > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}">
				{summary.failed_count > 0 ? '클릭하여 오류 로그 점검' : '모든 작업이 정상입니다'}
			</p>
		</button>
	</div>

	<!-- 메인 워크스페이스 패널 (탭 바 + 컨텐츠) -->
	<div class="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
		<!-- 표준 탭 네비게이션 (우측 끝 '설정' 탭 배치) -->
		<div class="flex flex-wrap items-center border-b border-slate-200 bg-slate-50/70 px-3 sm:px-4 pt-2.5 gap-1">
			<button
				type="button"
				onclick={() => switchTab('monitor')}
				class="flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs sm:text-sm font-black transition {activeTab === 'monitor' ? 'border-x border-t border-slate-200 bg-white text-blue-600 -mb-px' : 'text-slate-500 hover:text-slate-800'}"
			>
				<Icon icon="solar:list-check-bold-duotone" class="text-base" />
				<span>실시간 작업 목록</span>
			</button>

			<button
				type="button"
				onclick={() => switchTab('schedule')}
				class="flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs sm:text-sm font-black transition {activeTab === 'schedule' ? 'border-x border-t border-slate-200 bg-white text-blue-600 -mb-px' : 'text-slate-500 hover:text-slate-800'}"
			>
				<Icon icon="solar:alarm-bold-duotone" class="text-base" />
				<span>정기 예약 일정표 ({summary.scheduler_count})</span>
			</button>

			{#if canWrite}
				<button
					type="button"
					onclick={() => switchTab('register')}
					class="flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs sm:text-sm font-black transition {activeTab === 'register' ? 'border-x border-t border-slate-200 bg-white text-blue-600 -mb-px' : 'text-slate-500 hover:text-slate-800'}"
				>
					<Icon icon="solar:add-square-bold-duotone" class="text-base" />
					<span>작업 예약 등록</span>
				</button>

				<button
					type="button"
					onclick={() => switchTab('settings')}
					class="ml-auto flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs sm:text-sm font-black transition {activeTab === 'settings' ? 'border-x border-t border-slate-200 bg-white text-indigo-600 -mb-px' : 'text-slate-600 hover:text-indigo-700'}"
				>
					<Icon icon="solar:settings-bold-duotone" class="text-base" />
					<span>설정</span>
				</button>
			{/if}
		</div>

		<!-- 탭별 본문 렌더링 -->
		{#if activeTab === 'monitor' || activeTab === 'schedule'}
			<TaskListTab
				mode={activeTab}
				{tasks}
				total={totalTasks}
				{isLoading}
				{taskTypes}
				{selectedStatus}
				{searchQuery}
				failedCount={summary.failed_count}
				{canWrite}
				onStatusChange={(next) => {
					selectedStatus = next;
					loadTasks();
				}}
				onSearchChange={(q) => {
					searchQuery = q;
					loadTasks();
				}}
				onClearAllFailed={requestClearAllFailed}
				onViewDetail={(task) => (detailTask = task)}
				onOpenEdit={(task) => (editingTask = task)}
				onRetry={requestRetryTask}
				onCancel={requestCancelTask}
				onDelete={requestHardDeleteTask}
			/>
		{:else if activeTab === 'register'}
			<TaskRegisterTab
				{taskTypes}
				settings={taskSettings}
				onSubmitTask={handleCreateManualTask}
				onCancel={() => switchTab('monitor')}
			/>
		{:else if activeTab === 'settings'}
			<TaskSettingsTab
				settings={taskSettings}
				{canWrite}
				onSaved={handleSettingsSaved}
			/>
		{/if}
	</div>
</div>

<!-- 모달 묶음 (상세 뷰어 · 스케줄 수정 · 실행/삭제 확인) -->
<TaskModals
	{taskTypes}
	settings={taskSettings}
	{canWrite}
	{detailTask}
	onCloseDetail={() => (detailTask = null)}
	onRequestRetry={requestRetryTask}
	onRequestCancel={requestCancelTask}
	onRequestDelete={requestHardDeleteTask}
	onSwitchToEdit={(task) => (editingTask = task)}
	{editingTask}
	onCloseEdit={() => (editingTask = null)}
	onSaveEdit={handleSaveEditedTask}
	{confirmAction}
	{isConfirmBusy}
	onCloseConfirm={() => (confirmAction = null)}
/>
