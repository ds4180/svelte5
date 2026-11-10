<script>
	/**
	 * ============================================================================
	 * [전사 시스템 환경설정 및 데이터 라이프사이클 관제 (+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 1. 글로벌 사이트 타이틀 및 기본 랜딩 페이지 설정
	 * 2. 3대 회원 가입 정책 모드 (ADMIN_ONLY / APPROVAL / OPEN) 중앙 통제
	 * 3. 자율신경계 Watchdog 실시간 모니터링 정책 (실패 임계치, 보안 경보, 지시 지연)
	 * 4. 데이터 보존 수명 주기(Retention Policy) 및 인메모리 Redis 가비지 컬렉션(GC) 수동 트리거
	 */

	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';

	// 🌐 1. 글로벌 사이트 기본 설정
	let siteTitle = $state('My Application');
	let landingPage = $state('/');

	// 👥 2. 회원 가입 정책 모드: 'ADMIN_ONLY' | 'APPROVAL' | 'OPEN'
	let registerMode = $state('ADMIN_ONLY');

	// ⚡ 3. Watchdog 자율 이상 감지 & 자동 경보 설정
	let watchdogEnabled = $state(true);
	let watchdogFailThreshold = $state(3);
	let watchdogSecurityAlert = $state(true);
	let watchdogInstructionDelayMinutes = $state(30);

	// 🗑️ 4. Data Retention & GC 데이터 보존 및 Redis 메모리 관리 설정
	let retentionAuditLogDays = $state(180);
	let retentionSystemTaskDays = $state(30);
	let retentionSessionHistoryDays = $state(60);
	let retentionRedisDynamicHours = $state(48);

	// 상태 제어
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isGcRunning = $state(false);
	/** @type {any} */
	let lastGcResult = $state(null);
	/** @type {Record<string, any>} */
	let originalSettings = $state({});

	/**
	 * 🔄 백엔드 설정 데이터 로드
	 */
	async function loadSettings() {
		isLoading = true;
		try {
			const [configList, regModeRes] = await Promise.all([
				api.adminGetConfigs().catch(() => []),
				api.adminGetRegisterMode().catch(() => null)
			]);

			if (regModeRes && regModeRes.register_mode) {
				registerMode = regModeRes.register_mode;
			}

			/** @type {Record<string, any>} */
			const configMap = {};
			if (Array.isArray(configList)) {
				configList.forEach((item) => {
					configMap[item.key] = item.value;
				});
			}

			// 안전한 문자열/불리언/숫자 파싱 헬퍼
			const getStringValue = (val, defaultValue) => {
				if (typeof val === 'object' && val !== null) {
					return String(val.text || val.value || val.name || JSON.stringify(val));
				}
				return val !== undefined && val !== null ? String(val) : defaultValue;
			};

			siteTitle = getStringValue(configMap.site_title, 'My Application');
			landingPage = getStringValue(configMap.landing_page, '/');

			if (configMap.watchdog_enabled !== undefined) {
				watchdogEnabled = configMap.watchdog_enabled === true || configMap.watchdog_enabled === 'true';
			}
			if (configMap.watchdog_fail_threshold !== undefined) {
				watchdogFailThreshold = Number(configMap.watchdog_fail_threshold) || 3;
			}
			if (configMap.watchdog_security_alert !== undefined) {
				watchdogSecurityAlert = configMap.watchdog_security_alert === true || configMap.watchdog_security_alert === 'true';
			}
			if (configMap.watchdog_instruction_delay_minutes !== undefined) {
				watchdogInstructionDelayMinutes = Number(configMap.watchdog_instruction_delay_minutes) || 30;
			}

			if (configMap.retention_audit_log_days !== undefined) {
				retentionAuditLogDays = Number(configMap.retention_audit_log_days) || 180;
			}
			if (configMap.retention_system_task_days !== undefined) {
				retentionSystemTaskDays = Number(configMap.retention_system_task_days) || 30;
			}
			if (configMap.retention_session_history_days !== undefined) {
				retentionSessionHistoryDays = Number(configMap.retention_session_history_days) || 60;
			}
			if (configMap.retention_redis_dynamic_hours !== undefined) {
				retentionRedisDynamicHours = Number(configMap.retention_redis_dynamic_hours) || 48;
			}

			// 변경 비교용 원본 스냅샷 저장
			originalSettings = {
				site_title: siteTitle,
				landing_page: landingPage,
				register_mode: registerMode,
				watchdog_enabled: watchdogEnabled,
				watchdog_fail_threshold: watchdogFailThreshold,
				watchdog_security_alert: watchdogSecurityAlert,
				watchdog_instruction_delay_minutes: watchdogInstructionDelayMinutes,
				retention_audit_log_days: retentionAuditLogDays,
				retention_system_task_days: retentionSystemTaskDays,
				retention_session_history_days: retentionSessionHistoryDays,
				retention_redis_dynamic_hours: retentionRedisDynamicHours
			};
		} catch (e) {
			console.error('❌ [Config] 설정 불러오기 실패:', e);
			toast.error('환경설정 정보를 불러오는데 실패했습니다.');
		} finally {
			isLoading = false;
		}
	}

	/**
	 * 💾 설정 일괄 저장 (Batch Save)
	 */
	async function saveSettings() {
		if (isSaving) return;
		isSaving = true;

		try {
			/** @type {Record<string, any>} */
			const changedConfigs = {};

			if (siteTitle !== originalSettings.site_title) {
				changedConfigs.site_title = siteTitle;
			}
			if (landingPage !== originalSettings.landing_page) {
				changedConfigs.landing_page = landingPage;
			}
			if (watchdogEnabled !== originalSettings.watchdog_enabled) {
				changedConfigs.watchdog_enabled = watchdogEnabled;
			}
			if (watchdogFailThreshold !== originalSettings.watchdog_fail_threshold) {
				changedConfigs.watchdog_fail_threshold = Number(watchdogFailThreshold);
			}
			if (watchdogSecurityAlert !== originalSettings.watchdog_security_alert) {
				changedConfigs.watchdog_security_alert = watchdogSecurityAlert;
			}
			if (watchdogInstructionDelayMinutes !== originalSettings.watchdog_instruction_delay_minutes) {
				changedConfigs.watchdog_instruction_delay_minutes = Number(watchdogInstructionDelayMinutes);
			}
			if (retentionAuditLogDays !== originalSettings.retention_audit_log_days) {
				changedConfigs.retention_audit_log_days = Number(retentionAuditLogDays);
			}
			if (retentionSystemTaskDays !== originalSettings.retention_system_task_days) {
				changedConfigs.retention_system_task_days = Number(retentionSystemTaskDays);
			}
			if (retentionSessionHistoryDays !== originalSettings.retention_session_history_days) {
				changedConfigs.retention_session_history_days = Number(retentionSessionHistoryDays);
			}
			if (retentionRedisDynamicHours !== originalSettings.retention_redis_dynamic_hours) {
				changedConfigs.retention_redis_dynamic_hours = Number(retentionRedisDynamicHours);
			}

			// 1. 가입 정책 모드 변경 시 저장
			if (registerMode !== originalSettings.register_mode) {
				await api.adminUpdateRegisterMode(registerMode);
				originalSettings.register_mode = registerMode;
			}

			// 2. 변경된 시스템 환경설정 일괄 원자적 저장 (단 1회의 HTTP 요청)
			if (Object.keys(changedConfigs).length > 0) {
				await api.adminUpdateConfigsBatch(changedConfigs);
				Object.assign(originalSettings, changedConfigs);
			}

			toast.success('전사 시스템 환경설정이 성공적으로 저장되었습니다.');
		} catch (/** @type {any} */ e) {
			console.error('❌ [Config] 설정 저장 실패:', e);
			toast.error('설정 저장 중 오류가 발생했습니다: ' + (e.message || '서버 응답 오류'));
		} finally {
			isSaving = false;
		}
	}

	/**
	 * 🧹 수동 가비지 컬렉션(GC) 즉시 실행
	 */
	async function runGcNow() {
		if (isGcRunning) return;
		if (!confirm('보존 기간을 초과한 DB 이력 데이터와 Redis 만료/고아 키를 지금 즉시 정리하시겠습니까?\n작업 이력은 보안 감사로그에 안전하게 기록됩니다.')) {
			return;
		}

		isGcRunning = true;
		try {
			const res = await api.adminRunSystemGc();
			lastGcResult = res;
			toast.success(
				`가비지 컬렉션 완료! (태스크: ${res.deleted_tasks || 0}건, 세션: ${res.deleted_sessions || 0}건, 감사로그: ${res.deleted_audit_logs || 0}건 정리)`
			);
		} catch (/** @type {any} */ e) {
			console.error('❌ [Config] GC 실행 실패:', e);
			toast.error('가비지 컬렉션(GC) 실행 실패: ' + (e.message || '서버 오류'));
		} finally {
			isGcRunning = false;
		}
	}

	onMount(() => {
		loadSettings();
	});
</script>

<svelte:head>
	<title>{getSiteTitle('환경설정')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 액션 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Enterprise Configuration
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/config</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				환경설정 <span class="not-italic text-blue-600">시스템 총괄</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				글로벌 기본값, 회원 가입 정책, 자율 Watchdog 이상 징후 감시 및 데이터 보존(GC) 수명 주기 총괄 관리
			</p>
		</div>

		<!-- 상단 버튼 그룹 (맨 우측 [관리자 홈], 그 좌측 [새로고침] 고정, 이후 버튼은 새로고침 좌측) -->
		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={saveSettings}
				disabled={isSaving || isLoading}
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
			>
				{#if isSaving}
					<Icon icon="solar:refresh-circle-bold-duotone" class="h-4 w-4 animate-spin text-white" />
					<span>저장하는 중...</span>
				{:else}
					<Icon icon="solar:diskette-bold" class="text-base" />
					<span>설정 전체 저장</span>
				{/if}
			</button>

			<button
				onclick={loadSettings}
				disabled={isLoading}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {isLoading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 핵심 지표 요약 카드 (Status Cards: 1~4개) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Site Title</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="solar:widget-5-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-xl font-black text-slate-900 truncate" title={siteTitle}>{siteTitle}</div>
				<div class="mt-1 text-xs font-bold text-blue-600">랜딩: {landingPage}</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Register Policy</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
					<Icon icon="solar:users-group-rounded-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-xl font-black text-slate-900">
					{registerMode === 'ADMIN_ONLY' ? '초대 전용' : registerMode === 'APPROVAL' ? '가입 승인제' : '자율 가입'}
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400 font-mono">{registerMode}</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Watchdog Sentinel</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl {watchdogEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
					<Icon icon="solar:shield-warning-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-xl font-black {watchdogEnabled ? 'text-emerald-600' : 'text-rose-600'}">
					{watchdogEnabled ? '실시간 감시 ON' : '감시 OFF'}
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">임계치: {watchdogFailThreshold}회 실패</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Redis & GC Life</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:trash-bin-trash-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-xl font-black text-slate-900">{retentionRedisDynamicHours}시간 소멸</div>
				<div class="mt-1 text-xs font-bold text-slate-400">감사로그: {retentionAuditLogDays}일</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 전사 공통 탭 바 (최소 1개 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<div class="flex items-center border-b-2 border-slate-200">
		<button
			type="button"
			class="flex items-center gap-2 border-b-4 border-blue-600 bg-blue-50/50 px-6 py-3 text-xs font-black text-blue-600 rounded-t-2xl transition"
		>
			<Icon icon="solar:settings-bold-duotone" class="text-base" />
			<span>전체 환경설정</span>
		</button>
	</div>

	{#if isLoading}
		<div class="flex flex-col items-center justify-center py-20 text-slate-400">
			<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-blue-600" />
			<span class="mt-3 text-xs font-bold">시스템 환경설정 정보를 불러오는 중입니다...</span>
		</div>
	{:else}
		<!-- ===================================================================== -->
		<!-- 2. 카드 1: 사이트 기본 설정 (Global Basics) -->
		<!-- ===================================================================== -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm md:p-8">
			<div class="flex items-center gap-2.5 border-b border-slate-100 pb-4">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="solar:widget-5-bold-duotone" class="text-xl" />
				</div>
				<div>
					<h2 class="text-base font-black text-slate-900">글로벌 사이트 기본 설정</h2>
					<p class="text-xs text-slate-400 font-medium">웹 애플리케이션 상단 브랜드 타이틀 및 로그인 직후 이동할 랜딩 경로</p>
				</div>
			</div>

			<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<div>
					<label for="siteTitleInput" class="block text-xs font-black text-slate-700">
						상단 브랜드 타이틀
					</label>
					<input
						type="text"
						id="siteTitleInput"
						bind:value={siteTitle}
						placeholder="웹사이트 상단에 표시될 타이틀"
						class="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
					<span class="mt-1 block text-[11px] text-slate-400">브라우저 탭 및 상단 헤더에 표기되는 메인 명칭입니다.</span>
				</div>

				<div>
					<label for="landingPageInput" class="block text-xs font-black text-slate-700">
						기본 랜딩 페이지 경로
					</label>
					<input
						type="text"
						id="landingPageInput"
						bind:value={landingPage}
						placeholder="예: / 또는 /v1/admin"
						class="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
					<span class="mt-1 block text-[11px] text-slate-400">사용자가 로그인 완료 후 가장 먼저 진입하게 될 기본 URL 경로입니다.</span>
				</div>
			</div>
		</div>

		<!-- ===================================================================== -->
		<!-- 3. 카드 2: 회원 가입 정책 모드 (Register Governance) -->
		<!-- ===================================================================== -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm md:p-8">
			<div class="flex items-center gap-2.5 border-b border-slate-100 pb-4">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
					<Icon icon="solar:user-check-bold-duotone" class="text-xl" />
				</div>
				<div>
					<h2 class="text-base font-black text-slate-900">회원 가입 및 로그인 거버넌스 정책</h2>
					<p class="text-xs text-slate-400 font-medium">신규 사용자의 가입 진입 장벽 및 관리자 승인 절차 통제</p>
				</div>
			</div>

			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<!-- 모드 1: ADMIN_ONLY -->
				<label
					class="relative flex cursor-pointer flex-col justify-between rounded-xl border-2 p-5 transition {registerMode === 'ADMIN_ONLY' ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">가장 안전</span>
							<input
								type="radio"
								name="register_mode"
								value="ADMIN_ONLY"
								bind:group={registerMode}
								class="h-4 w-4 text-blue-600 focus:ring-blue-500"
							/>
						</div>
						<div class="mt-3 text-sm font-black text-slate-900">🔒 관리자 직접 등록만 허용</div>
						<p class="mt-1.5 text-xs text-slate-500 leading-relaxed">
							외부 일반 가입 창구를 완전 차단하며, 관리자가 [사원 직접 등록]으로 생성한 계정만 로그인 가능합니다.
						</p>
					</div>
				</label>

				<!-- 모드 2: APPROVAL -->
				<label
					class="relative flex cursor-pointer flex-col justify-between rounded-xl border-2 p-5 transition {registerMode === 'APPROVAL' ? 'border-amber-600 bg-amber-50/40 shadow-sm ring-2 ring-amber-500/20' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-black text-white">표준 승인제</span>
							<input
								type="radio"
								name="register_mode"
								value="APPROVAL"
								bind:group={registerMode}
								class="h-4 w-4 text-amber-600 focus:ring-amber-500"
							/>
						</div>
						<div class="mt-3 text-sm font-black text-slate-900">⏳ 가입 승인 대기제</div>
						<p class="mt-1.5 text-xs text-slate-500 leading-relaxed">
							누구나 가입 신청할 수 있으나, 관리자가 승인(Rank 부여)하기 전까지는 로그인이 제한됩니다.
						</p>
					</div>
				</label>

				<!-- 모드 3: OPEN -->
				<label
					class="relative flex cursor-pointer flex-col justify-between rounded-xl border-2 p-5 transition {registerMode === 'OPEN' ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">완전 공개</span>
							<input
								type="radio"
								name="register_mode"
								value="OPEN"
								bind:group={registerMode}
								class="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
							/>
						</div>
						<div class="mt-3 text-sm font-black text-slate-900">✨ 자유 즉시 가입</div>
						<p class="mt-1.5 text-xs text-slate-500 leading-relaxed">
							가입 완료 즉시 기본 Rank 1 권한이 부여되어 승인 절차 없이 즉시 시스템에 로그인할 수 있습니다.
						</p>
					</div>
				</label>
			</div>
		</div>

		<!-- ===================================================================== -->
		<!-- 4. 카드 3: 자율 이상 징후 감지 및 경보 (System Watchdog) -->
		<!-- ===================================================================== -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm md:p-8">
			<div class="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-2.5">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
						<Icon icon="solar:shield-warning-bold-duotone" class="text-xl" />
					</div>
					<div>
						<h2 class="text-base font-black text-slate-900">자율신경계 Watchdog 실시간 모니터링 정책</h2>
						<p class="text-xs text-slate-400 font-medium">워커 연속 실패, 비인가 보안 침해, 긴급 지시 미확인 지연 감지 시 관리자 자동 경보</p>
					</div>
				</div>

				<!-- Watchdog 활성화 토글 스위치 -->
				<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 shadow-xs transition hover:bg-slate-100">
					<span class="text-xs font-black text-slate-800">Watchdog 활성화</span>
					<input type="checkbox" bind:checked={watchdogEnabled} class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
				</label>
			</div>

			<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 {watchdogEnabled ? '' : 'opacity-40 pointer-events-none'}">
				<!-- 항목 1: 태스크 연속 실패 임계치 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
					<label for="taskFailThresholdInput" class="block text-xs font-black text-slate-800">
						워커 연속 실패(FAILED) 경보 임계치
					</label>
					<span class="mt-1 block text-[11px] text-slate-500 font-medium">
						최근 1시간 내 백그라운드 태스크가 지정 횟수 이상 영구 실패 시 즉각 관리자 L4 알림을 자동 발송합니다.
					</span>
					<div class="mt-3 flex items-center gap-3">
						<input
							type="number"
							id="taskFailThresholdInput"
							min="1"
							max="10"
							bind:value={watchdogFailThreshold}
							class="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-700">회 연속 실패 시 경보</span>
					</div>
				</div>

				<!-- 항목 2: 보안 침해 감지 즉시 경보 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-between">
					<div>
						<span class="block text-xs font-black text-slate-800">
							보안 침해 시도 즉시 경보
						</span>
						<span class="mt-1 block text-[11px] text-slate-500 font-medium">
							403 Forbidden 권한 침해 또는 위조 토큰 감지 시 즉각 관리자 L4 알림을 발송합니다.
						</span>
					</div>
					<div class="mt-4">
						<label class="inline-flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								bind:checked={watchdogSecurityAlert}
								class="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
							/>
							<span class="text-xs font-bold text-slate-800">
								{watchdogSecurityAlert ? '즉시 발송 활성화됨' : '비활성화됨'}
							</span>
						</label>
					</div>
				</div>

				<!-- 항목 3: 현장 지시사항 미확인 인지 지연 감시 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5 md:col-span-2">
					<label for="instructionDelayInput" class="block text-xs font-black text-slate-800">
						현장 지시사항 미확인 인지 지연 감시 기준
					</label>
					<span class="mt-1 block text-[11px] text-slate-500 font-medium">
						긴급 지시사항 발행 후 지정 시간이 경과했음에도 미확인율이 50% 이상 지속될 때 관제탑 경보를 발송합니다.
					</span>
					<div class="mt-3 flex items-center gap-3">
						<input
							type="number"
							id="instructionDelayInput"
							min="5"
							max="180"
							step="5"
							bind:value={watchdogInstructionDelayMinutes}
							class="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-700">분 경과 후 미확인율 점검</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ===================================================================== -->
		<!-- 5. 카드 4: 데이터 보존 주기 및 가비지 컬렉션 (Data Retention & GC) -->
		<!-- ===================================================================== -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm md:p-8">
			<div class="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-2.5">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
						<Icon icon="solar:broom-bold-duotone" class="text-xl" />
					</div>
					<div>
						<h2 class="text-base font-black text-slate-900">데이터 보존 수명 주기 및 자율 가비지 컬렉션(GC)</h2>
						<p class="text-xs text-slate-400 font-medium">Redis 만료 기한(TTL) 강제 및 DB 누적 감사로그/세션/태스크 이력 자동 정리</p>
					</div>
				</div>

				<!-- 수동 GC 즉시 실행 버튼 -->
				<button
					onclick={runGcNow}
					disabled={isGcRunning}
					class="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-600 hover:text-white active:scale-95 disabled:opacity-50"
				>
					<Icon icon={isGcRunning ? "solar:refresh-circle-bold-duotone" : "solar:play-bold"} class="text-base {isGcRunning ? 'animate-spin' : ''}" />
					<span>{isGcRunning ? '정리 수행 중...' : '지금 즉시 정리 (Run GC)'}</span>
				</button>
			</div>

			<!-- 최근 실행 결과 배너 (실행 시에만 표시) -->
			{#if lastGcResult}
				<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-900">
					<div class="font-black flex items-center gap-1.5 mb-1 text-emerald-700">
						<Icon icon="solar:check-circle-bold" class="text-base" />
						최근 가비지 컬렉션 수행 결과
					</div>
					<div class="flex flex-wrap gap-4 text-[11px] text-slate-600">
						<span>태스크 삭제: <b>{lastGcResult.deleted_tasks || 0}</b>건</span>
						<span>세션 이력 삭제: <b>{lastGcResult.deleted_sessions || 0}</b>건</span>
						<span>감사로그 삭제: <b>{lastGcResult.deleted_audit_logs || 0}</b>건</span>
						<span>Redis TTL 주입: <b>{lastGcResult.redis_ttl_enforced || 0}</b>건</span>
						<span>Redis 고아키 수거: <b>{lastGcResult.redis_orphans_removed || 0}</b>건</span>
					</div>
				</div>
			{/if}

			<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- 보존 1: 감사로그 보존 기간 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
					<label for="auditLogRetentionInput" class="block text-xs font-black text-slate-800">
						감사로그 (Audit Log) 보존 기간
					</label>
					<span class="mt-1 block text-[11px] text-slate-500 font-medium">
						보안 및 법적 컴플라이언스 이력을 지정 일수 동안 보존한 후 자동 영구 파기합니다.
					</span>
					<div class="mt-3 flex items-center gap-3">
						<input
							type="number"
							id="auditLogRetentionInput"
							min="30"
							max="730"
							step="30"
							bind:value={retentionAuditLogDays}
							class="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-700">일간 보존</span>
					</div>
				</div>

				<!-- 보존 2: 백그라운드 태스크 보존 기간 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
					<label for="systemTaskRetentionInput" class="block text-xs font-black text-slate-800">
						완료/실패 태스크 이력 보존 기간
					</label>
					<span class="mt-1 block text-[11px] text-slate-500 font-medium">
						SUCCESS 또는 FAILED로 종료된 백그라운드 작업 이력을 지정 일수 후 자동 정리합니다.
					</span>
					<div class="mt-3 flex items-center gap-3">
						<input
							type="number"
							id="systemTaskRetentionInput"
							min="7"
							max="180"
							step="7"
							bind:value={retentionSystemTaskDays}
							class="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-700">일간 보존</span>
					</div>
				</div>

				<!-- 보존 3: 만료 세션 이력 보존 기간 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
					<label for="sessionHistoryRetentionInput" class="block text-xs font-black text-slate-800">
						로그아웃/만료 세션 이력 보존 기간
					</label>
					<span class="mt-1 block text-[11px] text-slate-500 font-medium">
						로그아웃되거나 관리자에 의해 강제 추방(KICKED)된 세션 레코드를 자동 정리합니다.
					</span>
					<div class="mt-3 flex items-center gap-3">
						<input
							type="number"
							id="sessionHistoryRetentionInput"
							min="7"
							max="365"
							step="7"
							bind:value={retentionSessionHistoryDays}
							class="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-700">일간 보존</span>
					</div>
				</div>

				<!-- 보존 4: Redis 동적 타겟 그룹 만료 기한 -->
				<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
					<label for="redisDynamicTtlInput" class="block text-xs font-black text-slate-800">
						Redis 동적 그룹 만료 기한 (TTL)
					</label>
					<span class="mt-1 block text-[11px] text-slate-500 font-medium">
						일별 배차/휴무 동적 타겟 그룹 키가 메모리에 잔류할 수 있는 최대 수명(TTL)을 지정합니다.
					</span>
					<div class="mt-3 flex items-center gap-3">
						<input
							type="number"
							id="redisDynamicTtlInput"
							min="12"
							max="168"
							step="12"
							bind:value={retentionRedisDynamicHours}
							class="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 text-center focus:border-blue-500 focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-700">시간 후 자동 소멸</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ===================================================================== -->
		<!-- 6. 하단 고정 액션 바 -->
		<!-- ===================================================================== -->
		<div class="flex items-center justify-end gap-3 pt-2">
			<button
				onclick={saveSettings}
				disabled={isSaving}
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
			>
				{#if isSaving}
					<Icon icon="solar:refresh-circle-bold-duotone" class="h-4 w-4 animate-spin text-white" />
					<span>저장하는 중...</span>
				{:else}
					<Icon icon="solar:diskette-bold" class="text-lg" />
					<span>설정 전체 저장</span>
				{/if}
			</button>
		</div>
	{/if}
</div>
