<script>
	/**
	 * ============================================================================
	 * [전사 비동기 태스크 및 자율신경계 스케줄러 관제 (+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 1. 백그라운드 로봇 일꾼(워커)의 실시간 가동 상태 종합 모니터링
	 * 2. 야간 청소, 기사 그룹 동기화, 사진 썸네일 생성 등 정기 예약 스케줄 총괄
	 * 3. 실패한 작업의 원클릭 즉시 재시도 및 쉬운 작업 예약 등록
	 */

	import { onMount, onDestroy } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { getSiteTitle } from '$lib/config/site';
	import { formatDateTime, timeAgo } from '$lib/utils';
	import Icon from '@iconify/svelte';

	// 📑 3대 직관적 탭: 'monitor' (실시간 작업) | 'schedule' (정기 예약 일정) | 'register' (작업 등록)
	let activeTab = $state('monitor');

	// 📊 상단 4대 로봇 일꾼 상태 요약
	let summary = $state({
		worker_status: 'ONLINE',
		pending_count: 0,
		running_count: 0,
		failed_count: 0,
		scheduler_count: 0
	});

	// 📋 태스크 목록 및 메타데이터
	let tasks = $state(/** @type {any[]} */ ([]));
	let taskTypes = $state(/** @type {any[]} */ ([]));
	let total = $state(0);
	let isLoading = $state(true);
	let selectedStatus = $state('');
	let autoRefresh = $state(true);
	let refreshTimer = /** @type {any} */ (null);

	// 🔍 상세 보기 모달 상태
	let selectedDetailTask = $state(/** @type {any} */ (null));

	// ✏️ 작업 스케줄 수정 모달 상태
	let isEditModalOpen = $state(false);
	let editingTask = $state(/** @type {any} */ (null));
	let isSavingEdit = $state(false);
	let editForm = $state({
		priority: 5,
		scheduled_at: '',
		cron_expression: '',
		repeat_interval: /** @type {number|null} */ (null),
		payload_str: '{}',
		tags_str: ''
	});

	function openEditModal(task) {
		editingTask = task;
		editForm.priority = task.priority ?? 5;
		if (task.scheduled_at) {
			const d = new Date(task.scheduled_at);
			if (!isNaN(d.getTime())) {
				const pad = (n) => String(n).padStart(2, '0');
				editForm.scheduled_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
			} else {
				editForm.scheduled_at = '';
			}
		} else {
			editForm.scheduled_at = '';
		}
		editForm.cron_expression = task.cron_expression || '';
		editForm.repeat_interval = task.repeat_interval || null;
		editForm.payload_str = JSON.stringify(task.payload || {}, null, 2);
		editForm.tags_str = (task.tags || []).join(', ');
		isEditModalOpen = true;
	}

	async function handleSaveEdit() {
		if (!editingTask) return;
		isSavingEdit = true;
		try {
			let parsedPayload = {};
			try {
				parsedPayload = JSON.parse(editForm.payload_str || '{}');
			} catch (jsonErr) {
				toast.error('입력값(Payload)이 올바른 JSON 형식이 아닙니다.');
				isSavingEdit = false;
				return;
			}

			const payload = {
				priority: Number(editForm.priority),
				payload: parsedPayload,
				cron_expression: editForm.cron_expression.trim() || null,
				repeat_interval: editForm.repeat_interval ? Number(editForm.repeat_interval) : null,
				tags: editForm.tags_str.split(',').map((t) => t.trim()).filter(Boolean)
			};

			if (editForm.scheduled_at) {
				payload.scheduled_at = new Date(editForm.scheduled_at).toISOString();
			}

			await api.adminUpdateTask(editingTask.id, payload);
			toast.success(`작업 #${editingTask.id} 스케줄이 성공적으로 수정되었습니다.`);
			isEditModalOpen = false;
			editingTask = null;
			await loadAllData(false);
		} catch (/** @type {any} */ err) {
			toast.error('작업 수정 실패: ' + (err.detail || err.message || '서버 오류'));
		} finally {
			isSavingEdit = false;
		}
	}

	// ➕ 쉬운 작업 등록 폼 상태
	let scheduleMode = $state('once_now'); // 'once_now' | 'daily' | 'interval' | 'specific_time'
	let selectedTypeItem = $state(/** @type {any} */ (null));
	let showAdvancedOptions = $state(false);

	let newTask = $state({
		task_type: '',
		payload_str: '{}',
		priority: 5,
		unique_key: '',
		scheduled_at: '',
		cron_expression: '',
		repeat_interval: /** @type {number|null} */ (null),
		max_retries: 3,
		timeout_sec: 300,
		tags_str: ''
	});

	// 원클릭 시간표 프리셋 정의
	const CRON_PRESETS = [
		{ label: '매일 새벽 3시 (야간 청소)', cron: '0 3 * * *', desc: '이용자가 적은 새벽에 시스템 정리' },
		{ label: '매일 아침 7시 (출근 전 준비)', cron: '0 7 * * *', desc: '오늘 운행 기사님 단체방 준비' },
		{ label: '매 시간 정각마다', cron: '0 * * * *', desc: '1시간 주기 상태 점검' },
		{ label: '10분마다 주기적 반복', cron: '*/10 * * * *', desc: '실시간에 준하는 고빈도 동기화' }
	];

	/**
	 * 🔄 상단 요약 통계 및 태스크 목록 통합 로드
	 */
	async function loadAllData(silent = false) {
		if (!silent) isLoading = true;
		try {
			// 1. 요약 통계 로드
			const sumRes = await api.adminGetTasksSummary().catch(() => null);
			if (sumRes) summary = sumRes;

			// 2. 태스크 유형 메타데이터 로드 (처음 1회)
			if (taskTypes.length === 0) {
				taskTypes = await api.adminGetTaskTypes().catch(() => []);
				if (taskTypes.length > 0 && !newTask.task_type) {
					selectTaskType(taskTypes[0]);
				}
			}

			// 3. 현재 탭에 맞는 작업 목록 로드
			if (activeTab !== 'register') {
				const params = {
					limit: 50,
					offset: 0,
					is_scheduler: activeTab === 'schedule' ? true : false,
					status: selectedStatus || undefined
				};
				const res = await api.adminGetTasks(params);
				tasks = res.tasks || [];
				total = res.total || 0;
			}
		} catch (e) {
			console.error('❌ [Tasks] 데이터 로딩 실패:', e);
		} finally {
			if (!silent) isLoading = false;
		}
	}

	/**
	 * 🎯 태스크 유형 선택 시 예시 페이로드 자동 주입
	 * @param {any} item
	 */
	function selectTaskType(item) {
		selectedTypeItem = item;
		newTask.task_type = item.type;
		newTask.payload_str = JSON.stringify(item.example || {}, null, 2);
	}

	/**
	 * ⏰ 프리셋 Cron 적용
	 * @param {string} cron
	 */
	function applyCronPreset(cron) {
		scheduleMode = 'daily';
		newTask.cron_expression = cron;
		toast.info(`스케줄이 '${cron}'으로 자동 설정되었습니다.`);
	}

	/**
	 * ➕ 쉬운 작업 등록 실행
	 */
	async function handleRegisterTask() {
		if (!newTask.task_type) {
			toast.error('수행할 작업의 종류를 선택해 주세요.');
			return;
		}

		try {
			let parsedPayload = {};
			try {
				parsedPayload = JSON.parse(newTask.payload_str || '{}');
			} catch (jsonErr) {
				toast.error('입력값(Payload)이 올바른 JSON 형식이 아닙니다. 형식을 확인해 주세요.');
				return;
			}

			const tags = newTask.tags_str.split(',').map((t) => t.trim()).filter(Boolean);

			// 스케줄 모드에 따른 시점 정리
			let finalCron = null;
			let finalInterval = null;
			let finalScheduledAt = null;

			if (scheduleMode === 'daily') {
				finalCron = newTask.cron_expression || '0 3 * * *';
			} else if (scheduleMode === 'interval') {
				finalInterval = Number(newTask.repeat_interval) || 3600;
			} else if (scheduleMode === 'specific_time') {
				finalScheduledAt = newTask.scheduled_at || null;
			}

			const body = {
				task_type: newTask.task_type,
				payload: parsedPayload,
				priority: Number(newTask.priority) || 5,
				unique_key: newTask.unique_key ? newTask.unique_key.trim() : null,
				scheduled_at: finalScheduledAt,
				cron_expression: finalCron,
				repeat_interval: finalInterval,
				max_retries: Number(newTask.max_retries) || 3,
				timeout_sec: Number(newTask.timeout_sec) || 300,
				tags
			};

			await api.adminCreateTask(body);
			toast.success(`새로운 작업 '${selectedTypeItem?.label || newTask.task_type}'이(가) 성공적으로 예약 등록되었습니다.`);

			// 등록 후 해당 탭으로 자동 이동
			activeTab = finalCron || finalInterval ? 'schedule' : 'monitor';
			await loadAllData(false);

			// 폼 초기화
			scheduleMode = 'once_now';
			newTask.cron_expression = '';
			newTask.repeat_interval = null;
			newTask.scheduled_at = '';
			newTask.unique_key = '';
		} catch (/** @type {any} */ err) {
			toast.error('작업 등록 실패: ' + (err.message || '서버 오류'));
		}
	}

	/**
	 * 🔄 실패 작업 즉시 재실행
	 * @param {number} taskId
	 */
	async function handleRetryTask(taskId) {
		if (!confirm(`실패했던 작업 #${taskId}을(를) 지금 즉시 다시 실행하시겠습니까?`)) return;
		try {
			await api.adminRetryTask(taskId);
			toast.success(`작업 #${taskId}이(가) 다시 실행 대기(PENDING) 큐에 투입되었습니다.`);
			if (selectedDetailTask && selectedDetailTask.id === taskId) {
				selectedDetailTask = null;
			}
			await loadAllData(false);
		} catch (/** @type {any} */ err) {
			toast.error('작업 재실행 실패: ' + (err.message || '서버 오류'));
		}
	}

	/**
	 * 🚫 대기 중인 작업 취소
	 * @param {number} taskId
	 */
	async function handleCancelTask(taskId) {
		if (!confirm(`대기 중인 작업 #${taskId}을(를) 취소하시겠습니까?`)) return;
		try {
			await api.adminCancelTask(taskId);
			toast.info(`작업 #${taskId}이(가) 취소되었습니다.`);
			await loadAllData(false);
		} catch (/** @type {any} */ err) {
			toast.error('작업 취소 실패: ' + (err.message || '서버 오류'));
		}
	}

	/**
	 * 🗑️ 실패/취소 작업 영구 삭제
	 * @param {number} taskId
	 */
	async function handleDeleteTask(taskId) {
		if (!confirm(`작업 #${taskId}을(를) 영구 삭제하시겠습니까?`)) return;
		try {
			await api.adminCancelTask(taskId, true);
			toast.success(`작업 #${taskId}이(가) 영구 삭제되었습니다.`);
			await loadAllData(false);
		} catch (/** @type {any} */ err) {
			toast.error('작업 삭제 실패: ' + (err.message || '서버 오류'));
		}
	}

	/**
	 * 🧹 실패한 모든 고아 작업 일괄 정리/삭제
	 */
	async function handleClearAllFailed() {
		if (!confirm(`실패(FAILED) 상태인 모든 작업을 일괄 영구 삭제하시겠습니까?`)) return;
		try {
			const res = await api.adminClearFailedTasks();
			toast.success(res.message || '실패한 작업들이 모두 정리되었습니다.');
			await loadAllData(false);
		} catch (/** @type {any} */ err) {
			toast.error('일괄 삭제 실패: ' + (err.message || '서버 오류'));
		}
	}

	/**
	 * 상태 뱃지 스타일 매핑
	 * @param {string} status
	 */
	function getStatusBadge(status) {
		switch (status) {
			case 'SUCCESS':
				return { label: '성공', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
			case 'RUNNING':
				return { label: '실행 중', color: 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse font-bold' };
			case 'FAILED':
				return { label: '실패 (확인 필요)', color: 'bg-rose-50 text-rose-700 border-rose-300 font-bold' };
			case 'CANCELLED':
				return { label: '취소됨', color: 'bg-slate-100 text-slate-500 border-slate-300' };
			default:
				return { label: '실행 대기', color: 'bg-amber-50 text-amber-700 border-amber-300' };
		}
	}

	/**
	 * 태스크 유형에 맞는 친절한 한글 정보 반환
	 * @param {string} typeName
	 */
	function getTaskTypeInfo(typeName) {
		const found = taskTypes.find((t) => t.type === typeName);
		if (found) return found;
		return {
			type: typeName,
			label: typeName,
			description: '시스템 백그라운드 작업',
			icon: 'solar:cpu-bolt-bold-duotone'
		};
	}

	onMount(() => {
		loadAllData();

		// 10초 주기 안전한 자동 새로고침 타이머
		refreshTimer = setInterval(() => {
			if (autoRefresh && activeTab !== 'register') {
				loadAllData(true);
			}
		}, 10000);
	});

	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});
</script>

<svelte:head>
	<title>{getSiteTitle('예약 작업 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 실시간 컨트롤 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Autonomous Background Worker
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/tasks</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				예약 작업 관리 <span class="not-italic text-blue-600">자율신경계 워커</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				새벽 자동 청소, 기사 그룹 동기화, 사진 축소판 생성 등 24시간 뒤에서 일하는 로봇 일꾼 관리탑
			</p>
		</div>

		<!-- 상단 버튼 그룹 (새로고침과 관리자 홈은 필수 기본값) -->
		<div class="flex flex-wrap items-center gap-3">
			<label class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
				<input type="checkbox" bind:checked={autoRefresh} class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
				<span class="flex items-center gap-1.5">
					<Icon icon="solar:refresh-circle-bold-duotone" class="text-base text-blue-600 {autoRefresh ? 'animate-spin' : ''}" />
					10초 자동 갱신
				</span>
			</label>

			<button
				onclick={() => loadAllData(false)}
				class="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-600 active:scale-95"
			>
				<Icon icon="solar:restart-bold" class="text-base {isLoading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 로봇 일꾼 상태 요약 카드 (Status Cards: 1~4개) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<!-- 카드 1: 워커 가동 상태 -->
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Worker Engine</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
					<Icon icon="solar:robot-2-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900">
					1대 가동 중
				</div>
				<div class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					24시간 자율 가동 (정상)
				</div>
			</div>
		</div>

		<!-- 카드 2: 밀린 할 일 (대기중) -->
		<button
			onclick={() => { activeTab = 'monitor'; selectedStatus = 'PENDING'; loadAllData(); }}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition {activeTab === 'monitor' && selectedStatus === 'PENDING' ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Pending Queue</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
					<Icon icon="solar:clock-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900 group-hover:text-amber-600 transition">
					{summary.pending_count}
					<span class="text-xs font-normal text-slate-500">건 대기 중</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					{summary.pending_count === 0 ? '밀린 작업 없음 (원활)' : '차례대로 처리 진행 중'}
				</div>
			</div>
		</button>

		<!-- 카드 3: 매일 정기 작업 (Cron) -->
		<button
			onclick={() => { activeTab = 'schedule'; selectedStatus = ''; loadAllData(); }}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition {activeTab === 'schedule' ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Scheduled Cron</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
					<Icon icon="solar:calendar-date-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition">
					{summary.scheduler_count}
					<span class="text-xs font-normal text-slate-500">개 등록됨</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-blue-600">
					새벽 청소 / 정기 점검 일정
				</div>
			</div>
		</button>

		<!-- 카드 4: 실패한 작업 (오류) -->
		<button
			onclick={() => { activeTab = 'monitor'; selectedStatus = 'FAILED'; loadAllData(); }}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition {summary.failed_count > 0 ? 'border-rose-500 bg-rose-50/50 shadow-md ring-2 ring-rose-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Failed Tasks</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
					<Icon icon="solar:danger-triangle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900 group-hover:text-rose-600 transition">
					{summary.failed_count}
					<span class="text-xs font-normal text-slate-500">건 오류</span>
				</div>
				<div class="mt-1 text-xs font-semibold {summary.failed_count > 0 ? 'text-rose-600 font-black animate-pulse' : 'text-slate-400'}">
					{summary.failed_count > 0 ? '확인 및 재시도 필요' : '모든 작업 정상 완료'}
				</div>
			</div>
		</button>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 관제 탭 & 툴바 -->
	<!-- ===================================================================== -->
	<div class="rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
		<!-- 3대 직관적 탭 헤더 -->
		<div class="flex border-b border-slate-200 bg-slate-50/70 overflow-x-auto">
			<button
				onclick={() => { activeTab = 'monitor'; loadAllData(); }}
				class="flex items-center gap-2 border-b-2 px-6 py-4 text-xs font-black tracking-wide transition whitespace-nowrap {activeTab === 'monitor' ? 'border-blue-600 bg-white text-blue-600 shadow-xs' : 'border-transparent text-slate-600 hover:bg-slate-100'}"
			>
				<Icon icon="solar:monitor-smartphone-bold-duotone" class="text-lg" />
				<span>📋 실시간 작업 목록 (지금 처리 중인 일)</span>
			</button>

			<button
				onclick={() => { activeTab = 'schedule'; loadAllData(); }}
				class="flex items-center gap-2 border-b-2 px-6 py-4 text-xs font-black tracking-wide transition whitespace-nowrap {activeTab === 'schedule' ? 'border-blue-600 bg-white text-blue-600 shadow-xs' : 'border-transparent text-slate-600 hover:bg-slate-100'}"
			>
				<Icon icon="solar:calendar-mark-bold-duotone" class="text-lg" />
				<span>⏰ 정기 예약 일정표 (새벽 청소 / 정기 점검)</span>
				<span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
					{summary.scheduler_count}
				</span>
			</button>

			<button
				onclick={() => { activeTab = 'register'; }}
				class="flex items-center gap-2 border-b-2 px-6 py-4 text-xs font-black tracking-wide transition whitespace-nowrap {activeTab === 'register' ? 'border-blue-600 bg-white text-blue-600 shadow-xs' : 'border-transparent text-slate-600 hover:bg-slate-100'}"
			>
				<Icon icon="solar:add-circle-bold-duotone" class="text-lg text-emerald-600" />
				<span class="text-emerald-700 font-black">➕ 쉬운 작업 예약 등록</span>
			</button>
		</div>

		<!-- 필터 컨트롤 바 (목록/스케줄 탭일 때만 표기) -->
		{#if activeTab !== 'register'}
			<div class="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex flex-wrap items-center gap-3">
					<span class="text-xs font-bold text-slate-500">상태 필터:</span>
					<select
						bind:value={selectedStatus}
						onchange={() => loadAllData()}
						class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
					>
						<option value="">모든 상태 보기</option>
						<option value="PENDING">대기중 (PENDING)</option>
						<option value="RUNNING">실행중 (RUNNING)</option>
						<option value="SUCCESS">성공 (SUCCESS)</option>
						<option value="FAILED">실패 (FAILED)</option>
						<option value="CANCELLED">취소됨 (CANCELLED)</option>
					</select>
				</div>

				<div class="flex items-center gap-3">
					{#if summary.failed_count > 0}
						<button
							onclick={handleClearAllFailed}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition shadow-xs"
						>
							<Icon icon="solar:trash-bin-trash-bold" class="text-sm" />
							<span>실패 작업({summary.failed_count}건) 일괄 정리</span>
						</button>
					{/if}
					<div class="text-xs font-bold text-slate-400">
						총 <span class="text-blue-600 font-black">{total.toLocaleString()}</span>건의 작업 내역
					</div>
				</div>
			</div>
		{/if}

		<!-- ================================================================= -->
		<!-- 4. 탭별 화면 렌더링 -->
		<!-- ================================================================= -->
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-20 text-slate-400">
				<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-blue-600" />
				<span class="mt-3 text-xs font-bold">로봇 일꾼의 작업 목록을 불러오는 중입니다...</span>
			</div>
		{:else if activeTab === 'monitor' || activeTab === 'schedule'}
			<!-- ------------------------------------------------------------- -->
			<!-- TAB 1 & 2: 실시간 작업 목록 & 정기 예약 일정표 -->
			<!-- ------------------------------------------------------------- -->
			{#if tasks.length === 0}
				<div class="py-20 text-center text-slate-400">
					<Icon icon="solar:box-minimalistic-broken" class="mx-auto h-12 w-12 text-slate-300" />
					<p class="mt-2 text-sm font-bold">
						{activeTab === 'schedule' ? '등록된 정기 예약 일정이 없습니다.' : '현재 조건에 해당하는 작업이 없습니다.'}
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
							<tr>
								<th class="px-5 py-3.5">작업 ID</th>
								<th class="px-4 py-3.5">어떤 작업인가요?</th>
								<th class="px-4 py-3.5">진행 상태</th>
								<th class="px-4 py-3.5">{activeTab === 'schedule' ? '정기 반복 주기' : '진행률'}</th>
								<th class="px-4 py-3.5">재시도</th>
								<th class="px-4 py-3.5">{activeTab === 'schedule' ? '다음 실행 예약' : '등록 시각'}</th>
								<th class="px-5 py-3.5 text-right">관리 제어</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
							{#each tasks as task}
								{@const typeInfo = getTaskTypeInfo(task.task_type)}
								{@const statusBadge = getStatusBadge(task.status)}
								<tr class="hover:bg-slate-50/80 transition {task.status === 'FAILED' ? 'bg-rose-50/30' : ''}">
									<!-- 작업 ID -->
									<td class="px-5 py-4 font-mono font-bold text-slate-500">
										#{task.id}
									</td>

									<!-- 작업 유형 & 친절한 한글 라벨 -->
									<td class="px-4 py-4">
										<div class="flex items-center gap-2.5">
											<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
												<Icon icon={typeInfo.icon} class="text-base" />
											</div>
											<div>
												<div class="font-black text-slate-900 text-xs">
													{typeInfo.label}
												</div>
												<div class="text-[10px] font-mono text-slate-400 mt-0.5">
													{task.task_type}
													{#if task.unique_key}
														· <span class="text-slate-500">{task.unique_key}</span>
													{/if}
												</div>
											</div>
										</div>
									</td>

									<!-- 상태 뱃지 -->
									<td class="px-4 py-4 whitespace-nowrap">
										<span class="inline-block rounded-md border px-2.5 py-1 text-[11px] font-black {statusBadge.color}">
											{statusBadge.label}
										</span>
									</td>

									<!-- 스케줄 주기 / 진행률 -->
									<td class="px-4 py-4">
										{#if activeTab === 'schedule'}
											<div class="space-y-1">
												{#if task.cron_expression}
													<span class="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-black text-blue-700">
														<Icon icon="solar:clock-circle-bold" class="text-xs" />
														Cron: {task.cron_expression}
													</span>
												{/if}
												{#if task.repeat_interval}
													<span class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
														매 {task.repeat_interval}초마다
													</span>
												{/if}
											</div>
										{:else}
											<div class="flex items-center gap-2 max-w-[120px]">
												<div class="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
													<div class="h-full bg-blue-600 transition-all" style="width: {task.progress_pct || 0}%"></div>
												</div>
												<span class="text-[10px] font-bold text-slate-600 whitespace-nowrap">{task.progress_pct || 0}%</span>
											</div>
										{/if}
									</td>

									<!-- 재시도 -->
									<td class="px-4 py-4 font-mono text-xs">
										<span class={task.retry_count > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
											{task.retry_count}
										</span>
										<span class="text-slate-400">/{task.max_retries}</span>
									</td>

									<!-- 시간 -->
									<td class="px-4 py-4 whitespace-nowrap">
										{#if activeTab === 'schedule' && task.scheduled_at}
											<div class="font-bold text-blue-700">{formatDateTime(task.scheduled_at)}</div>
											<div class="text-[10px] text-slate-400">{timeAgo(task.scheduled_at)}</div>
										{:else}
											<div class="font-bold text-slate-900">{timeAgo(task.created_at)}</div>
											<div class="text-[10px] text-slate-400">{formatDateTime(task.created_at)}</div>
										{/if}
									</td>

									<!-- 관리 제어 액션 -->
									<td class="px-5 py-4 text-right whitespace-nowrap">
										<div class="inline-flex items-center gap-1.5">
											<button
												onclick={() => (selectedDetailTask = task)}
												class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
											>
												상세보기
											</button>

											{#if task.status === 'FAILED'}
												<button
													onclick={() => handleRetryTask(task.id)}
													class="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
												>
													<Icon icon="solar:restart-bold" class="text-xs" />
													<span>다시 실행</span>
												</button>
												<button
													onclick={() => handleDeleteTask(task.id)}
													class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
													title="실패한 작업을 목록에서 영구 삭제합니다."
												>
													<Icon icon="solar:trash-bin-trash-bold" class="text-xs" />
													<span>삭제</span>
												</button>
											{/if}

											{#if task.status === 'PENDING'}
												<button
													onclick={() => openEditModal(task)}
													class="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
													title="작업 실행 시간표 및 옵션을 수정합니다."
												>
													<Icon icon="solar:pen-bold" class="text-xs" />
													<span>수정</span>
												</button>
												<button
													onclick={() => handleCancelTask(task.id)}
													class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
												>
													취소
												</button>
											{/if}

											{#if task.status === 'CANCELLED'}
												<button
													onclick={() => handleDeleteTask(task.id)}
													class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-400 hover:text-rose-600 transition hover:bg-rose-50"
													title="취소된 기록 영구 삭제"
												>
													삭제
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

		<!-- ------------------------------------------------------------- -->
		<!-- TAB 3: 쉬운 작업 예약 등록 -->
		<!-- ------------------------------------------------------------- -->
		{:else if activeTab === 'register'}
			<div class="p-6 md:p-8 space-y-8 max-w-4xl">
				<!-- 안내 문구 -->
				<div class="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs font-medium text-blue-900">
					<div class="flex items-center gap-2 font-black text-sm text-blue-700">
						<Icon icon="solar:info-circle-bold" class="text-lg" />
						로봇 일꾼에게 시킬 작업을 직관적으로 선택하세요
					</div>
					<p class="mt-1 text-slate-600">
						복잡한 프로그래밍 코드를 짤 필요 없이, 아래에서 시킬 작업 종류와 실행 시간을 선택하기만 하면 로봇 일꾼이 자동으로 실행합니다.
					</p>
				</div>

				<!-- 1단계: 작업 종류 선택 -->
				<div>
					<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
						<span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">1</span>
						어떤 작업을 시키시겠습니까? (작업 종류 선택)
					</h3>

					<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each taskTypes as item}
							<button
								type="button"
								onclick={() => selectTaskType(item)}
								class="flex items-start gap-3 rounded-xl border-2 p-4 text-left transition {newTask.task_type === item.type ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
							>
								<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
									<Icon icon={item.icon} class="text-xl" />
								</div>
								<div>
									<div class="text-xs font-black text-slate-900">{item.label}</div>
									<p class="mt-1 text-[11px] text-slate-500 leading-relaxed">{item.description}</p>
									<span class="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
										{item.type}
									</span>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- 2단계: 언제 실행할까요? -->
				<div>
					<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
						<span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">2</span>
						언제 실행할까요? (실행 주기 및 시간 선택)
					</h3>

					<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
						<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition {scheduleMode === 'once_now' ? 'border-blue-600 bg-blue-50/40 shadow-xs' : 'border-slate-200 bg-white'}">
							<input type="radio" bind:group={scheduleMode} value="once_now" class="h-4 w-4 text-blue-600" />
							<div>
								<div class="text-xs font-black text-slate-900">⚡ 지금 즉시 1번만 실행</div>
								<span class="text-[10px] text-slate-400">등록 즉시 큐에 진입하여 처리</span>
							</div>
						</label>

						<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition {scheduleMode === 'daily' ? 'border-blue-600 bg-blue-50/40 shadow-xs' : 'border-slate-200 bg-white'}">
							<input type="radio" bind:group={scheduleMode} value="daily" class="h-4 w-4 text-blue-600" />
							<div>
								<div class="text-xs font-black text-slate-900">⏰ 정해진 시간에 매일 반복</div>
								<span class="text-[10px] text-slate-400">새벽 청소 등 정기 스케줄</span>
							</div>
						</label>

						<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition {scheduleMode === 'specific_time' ? 'border-blue-600 bg-blue-50/40 shadow-xs' : 'border-slate-200 bg-white'}">
							<input type="radio" bind:group={scheduleMode} value="specific_time" class="h-4 w-4 text-blue-600" />
							<div>
								<div class="text-xs font-black text-slate-900">📅 특정 날짜/시간에 예약</div>
								<span class="text-[10px] text-slate-400">지정된 미래 시점에 1회 실행</span>
							</div>
						</label>
					</div>

					<!-- 정기 반복 스케줄 선택 시 프리셋 버튼들 -->
					{#if scheduleMode === 'daily'}
						<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
							<span class="block text-xs font-black text-slate-700 mb-2">자주 쓰는 정기 시간표 (원클릭 선택):</span>
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{#each CRON_PRESETS as preset}
									<button
										type="button"
										onclick={() => applyCronPreset(preset.cron)}
										class="flex flex-col rounded-lg border bg-white p-3 text-left transition hover:border-blue-500 {newTask.cron_expression === preset.cron ? 'border-blue-600 bg-blue-50/30' : 'border-slate-200'}"
									>
										<div class="text-xs font-bold text-slate-900">{preset.label}</div>
										<span class="text-[10px] text-slate-400 mt-0.5">{preset.desc} (Cron: <code>{preset.cron}</code>)</span>
									</button>
								{/each}
							</div>
						</div>
					{:else if scheduleMode === 'specific_time'}
						<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
							<label for="schedAtInput" class="block text-xs font-black text-slate-700 mb-1">예약 실행 일시:</label>
							<input
								type="datetime-local"
								id="schedAtInput"
								bind:value={newTask.scheduled_at}
								class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
							/>
						</div>
					{/if}
				</div>

				<!-- 3단계: 고급 옵션 (접기/펼치기) -->
				<div class="border-t border-slate-200 pt-4">
					<button
						type="button"
						onclick={() => (showAdvancedOptions = !showAdvancedOptions)}
						class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
					>
						<Icon icon={showAdvancedOptions ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} />
						<span>고급 엔지니어링 옵션 (JSON 매개변수, 재시도 횟수 등) {showAdvancedOptions ? '접기' : '펼치기'}</span>
					</button>

					{#if showAdvancedOptions}
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl bg-slate-50 p-5 border border-slate-200">
							<div>
								<label for="uniqKeyInput" class="block text-xs font-bold text-slate-700 mb-1">중복 방지 고유키 (Unique Key):</label>
								<input
									type="text"
									id="uniqKeyInput"
									bind:value={newTask.unique_key}
									placeholder="동일 작업 중복 대기 방지용"
									class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
								/>
							</div>

							<div>
								<label for="maxRetriesInput" class="block text-xs font-bold text-slate-700 mb-1">실패 시 최대 재시도 횟수:</label>
								<input
									type="number"
									id="maxRetriesInput"
									min="1"
									max="10"
									bind:value={newTask.max_retries}
									class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
								/>
							</div>

							<div class="sm:col-span-2">
								<label for="payloadInput" class="block text-xs font-bold text-slate-700 mb-1">전달 매개변수 (JSON Payload):</label>
								<textarea
									id="payloadInput"
									bind:value={newTask.payload_str}
									rows="3"
									class="w-full rounded-xl border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-emerald-400 focus:outline-none"
								></textarea>
							</div>
						</div>
					{/if}
				</div>

				<!-- 제출 버튼 바 -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
					<button
						type="button"
						onclick={() => (activeTab = 'monitor')}
						class="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
					>
						취소
					</button>

					<button
						type="button"
						onclick={handleRegisterTask}
						class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-blue-700 active:scale-95"
					>
						<Icon icon="solar:check-circle-bold" class="text-base" />
						<span>로봇 일꾼에게 작업 지시하기</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ========================================================================= -->
<!-- 5. 태스크 상세 정보 및 에러 원인 확인 모달 -->
<!-- ========================================================================= -->
{#if selectedDetailTask}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
		<div class="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
						<Icon icon="solar:info-circle-bold" class="text-lg" />
					</div>
					<div>
						<h3 class="text-sm font-black text-slate-900">작업 상세 정보 #{selectedDetailTask.id}</h3>
						<span class="text-[11px] text-slate-400 font-mono">{selectedDetailTask.task_type}</span>
					</div>
				</div>

				<button
					onclick={() => (selectedDetailTask = null)}
					class="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
				>
					<Icon icon="solar:close-circle-bold" class="text-xl" />
				</button>
			</div>

			<!-- 모달 본문 -->
			<div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
				<!-- 상태 요약 -->
				<div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
					<div><strong>진행 상태:</strong> <span class="font-black text-blue-700">{selectedDetailTask.status}</span></div>
					<div><strong>재시도:</strong> {selectedDetailTask.retry_count} / {selectedDetailTask.max_retries}회</div>
					<div><strong>워커 식별자:</strong> <span class="font-mono">{selectedDetailTask.worker_id || '(미할당)'}</span></div>
					<div><strong>등록 시각:</strong> {formatDateTime(selectedDetailTask.created_at)}</div>
					{#if selectedDetailTask.cron_expression}
						<div class="col-span-2"><strong>정기 Cron:</strong> <code>{selectedDetailTask.cron_expression}</code></div>
					{/if}
				</div>

				<!-- 에러 로그가 있는 경우 -->
				{#if selectedDetailTask.error_log}
					<div>
						<div class="text-xs font-black text-rose-600 flex items-center gap-1.5 mb-1.5">
							<Icon icon="solar:danger-triangle-bold" />
							실패 원인 및 에러 로그:
						</div>
						<pre class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[11px] font-mono text-rose-800 whitespace-pre-wrap max-h-40 overflow-y-auto">{selectedDetailTask.error_log}</pre>
					</div>
				{/if}

				<!-- 매개변수 & 결과 -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<span class="block text-xs font-bold text-slate-700 mb-1">입력값 (Payload):</span>
						<pre class="rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-emerald-400 max-h-36 overflow-y-auto">{JSON.stringify(selectedDetailTask.payload, null, 2)}</pre>
					</div>
					<div>
						<span class="block text-xs font-bold text-slate-700 mb-1">처리 결과 (Result):</span>
						<pre class="rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-slate-300 max-h-36 overflow-y-auto">{JSON.stringify(selectedDetailTask.result || '(결과 대기 중)', null, 2)}</pre>
					</div>
				</div>
			</div>

			<!-- 모달 푸터 -->
			<div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
				{#if selectedDetailTask.status === 'FAILED'}
					<button
						onclick={() => handleRetryTask(selectedDetailTask.id)}
						class="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-rose-700"
					>
						<Icon icon="solar:restart-bold" class="text-sm" />
						<span>원클릭 다시 실행</span>
					</button>
					<button
						onclick={() => { const id = selectedDetailTask.id; selectedDetailTask = null; handleDeleteTask(id); }}
						class="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
					>
						<Icon icon="solar:trash-bin-trash-bold" class="text-sm" />
						<span>작업 삭제</span>
					</button>
				{/if}
				{#if selectedDetailTask.status === 'PENDING'}
					<button
						onclick={() => { const task = selectedDetailTask; selectedDetailTask = null; openEditModal(task); }}
						class="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
					>
						<Icon icon="solar:pen-bold" class="text-sm" />
						<span>스케줄 수정하기</span>
					</button>
				{/if}
				<button
					onclick={() => (selectedDetailTask = null)}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ✏️ 태스크 스케줄 및 옵션 수정 모달 -->
{#if isEditModalOpen && editingTask}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
		<div class="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
						<Icon icon="solar:pen-new-square-bold-duotone" class="text-xl" />
					</div>
					<div>
						<h3 class="text-sm font-black text-slate-900">
							작업 #{editingTask.id} 스케줄 및 설정 수정
						</h3>
						<span class="text-[11px] text-slate-400 font-mono">유형: {editingTask.task_type}</span>
					</div>
				</div>
				<button
					onclick={() => (isEditModalOpen = false)}
					class="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
				>
					<Icon icon="solar:close-circle-bold" class="text-xl" />
				</button>
			</div>

			<!-- 모달 본문 -->
			<div class="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
				<!-- 1. 실행 예정 일시 -->
				<div>
					<label for="edit-scheduled-at" class="block text-xs font-black text-slate-700 mb-1.5">
						📅 실행 예정 일시 (지정 시각 실행)
					</label>
					<input
						id="edit-scheduled-at"
						type="datetime-local"
						bind:value={editForm.scheduled_at}
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
					<p class="text-[10px] text-slate-400 mt-1">지정한 일시가 되면 로봇 일꾼이 자동으로 작업을 실행합니다.</p>
				</div>

				<!-- 2. 정기 Cron 표현식 -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="edit-cron" class="text-xs font-black text-slate-700">
							⏰ 정기 반복 Cron 표현식 (선택)
						</label>
						{#if editForm.cron_expression}
							<button 
								type="button" 
								onclick={() => editForm.cron_expression = ''} 
								class="text-[10px] font-bold text-rose-500 hover:underline"
							>
								Cron 제거 (단발성 실행 전환)
							</button>
						{/if}
					</div>
					<input
						id="edit-cron"
						type="text"
						bind:value={editForm.cron_expression}
						placeholder="예: 0 7 * * * (매일 07:00), 0 3 * * * (새벽 3시)"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
					/>

					<!-- 빠른 프리셋 뱃지 -->
					<div class="flex flex-wrap gap-1.5 mt-2">
						{#each CRON_PRESETS as preset}
							<button
								type="button"
								onclick={() => editForm.cron_expression = preset.cron}
								class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- 3. 우선순위 -->
				<div>
					<label for="edit-priority" class="block text-xs font-black text-slate-700 mb-1.5">
						⚡ 처리 우선순위 (1: 매우 높음 ~ 10: 여유)
					</label>
					<select
						id="edit-priority"
						bind:value={editForm.priority}
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
					>
						<option value={1}>1 - 최우선 긴급 처리</option>
						<option value={3}>3 - 높은 우선순위</option>
						<option value={5}>5 - 일반 보통 작업 (기본값)</option>
						<option value={8}>8 - 여유있는 야간/정리 작업</option>
						<option value={10}>10 - 가장 낮은 우선순위</option>
					</select>
				</div>

				<!-- 4. 입력값 (Payload JSON) -->
				<div>
					<label for="edit-payload" class="block text-xs font-black text-slate-700 mb-1.5">
						📦 작업 매개변수 (Payload JSON)
					</label>
					<textarea
						id="edit-payload"
						rows="4"
						bind:value={editForm.payload_str}
						class="w-full rounded-xl border border-slate-300 bg-slate-900 p-3 text-[11px] font-mono text-emerald-400 focus:border-blue-500 focus:outline-none"
					></textarea>
				</div>

				<!-- 5. 태그 -->
				<div>
					<label for="edit-tags" class="block text-xs font-black text-slate-700 mb-1.5">
						🏷️ 검색용 태그 (쉼표로 구분)
					</label>
					<input
						id="edit-tags"
						type="text"
						bind:value={editForm.tags_str}
						placeholder="예: core, dynamic_group, manual"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
				</div>
			</div>

			<!-- 모달 푸터 -->
			<div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
				<button
					onclick={() => (isEditModalOpen = false)}
					disabled={isSavingEdit}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
				>
					취소
				</button>
				<button
					onclick={handleSaveEdit}
					disabled={isSavingEdit}
					class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
				>
					<Icon icon="solar:disk-bold" class="text-sm" />
					<span>{isSavingEdit ? '저장 중...' : '수정사항 저장'}</span>
				</button>
			</div>
		</div>
	</div>
{/if}
