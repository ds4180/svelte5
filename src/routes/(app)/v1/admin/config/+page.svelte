<script>
	import { onMount } from 'svelte';
	import { fastApi } from '$lib/api'; // Assuming fastApi is available from central api.js
	import Icon from '@iconify/svelte'; // Icon 컴포넌트 추가

	let topTitle = $state('My Application');
	let darkMode = $state(false);
	let redirectRank1 = $state(false);
	let landingPage = $state('/');

	// ⚡ [Watchdog 자율 이상 감지 & 자동 경보 설정]
	let watchdogEnabled = $state(true);
	let watchdogFailThreshold = $state(3);
	let watchdogSecurityAlert = $state(true);
	let watchdogInstructionDelayMinutes = $state(30);

	// 🗑️ [Data Retention & GC 데이터 보존 및 Redis 메모리 관리 설정]
	let retentionAuditLogDays = $state(180);
	let retentionSystemTaskDays = $state(30);
	let retentionSessionHistoryDays = $state(60);
	let retentionRedisDynamicHours = $state(48);
	let isGcRunning = $state(false);
	let lastGcResult = $state(null);

	console.log('Config page script is running!');
	// State to hold original values from backend for comparison or reset
	let originalSettings = $state({});
	// Function to load settings from backend
	async function loadSettings() {
		try {
			// Assuming GET /v1/admin/config returns a list of {key, value} objects OR a dictionary {key: value}
			const response = await fastApi('GET', '/api/v1/admin/config');
			const configList = Array.isArray(response)
				? response
				: Object.entries(response).map(([key, value]) => ({ key, value }));

			if (configList) {
				// Map backend keys to frontend state
				const configMap = {};
				configList.forEach((item) => {
					configMap[item.key] = item.value;
				});

				// Helper to safely get string value from JSONB, handling objects
				const getStringValue = (val, defaultValue) => {
					if (typeof val === 'object' && val !== null) {
						// Try common keys or just stringify the object
						return String(val.text || val.value || val.name || JSON.stringify(val));
					}
					return String(val || defaultValue);
				};

				topTitle = getStringValue(configMap.site_title, 'My Application');
				darkMode = configMap.theme_mode === 'dark'; // Boolean conversion is fine
				redirectRank1 = configMap.redirect_rank1_to_profile === true;
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

				// 🗑️ Data Retention 설정 로드
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

				// Store original for comparison
				originalSettings = {
					site_title: topTitle,
					theme_mode: darkMode ? 'dark' : 'light',
					redirect_rank1_to_profile: redirectRank1,
					landing_page: landingPage,
					watchdog_enabled: watchdogEnabled,
					watchdog_fail_threshold: watchdogFailThreshold,
					watchdog_security_alert: watchdogSecurityAlert,
					watchdog_instruction_delay_minutes: watchdogInstructionDelayMinutes,
					retention_audit_log_days: retentionAuditLogDays,
					retention_system_task_days: retentionSystemTaskDays,
					retention_session_history_days: retentionSessionHistoryDays,
					retention_redis_dynamic_hours: retentionRedisDynamicHours
				};
			}
		} catch (e) {
			console.error('Failed to load settings:', e);
			// Optionally, show an alert
			alert('설정을 불러오는데 실패했습니다.');
		}
	}

	// Function to save settings to backend
	async function saveSettings() {
		try {
			// Collect changes and send only changed values
			// Backend expects PUT /v1/admin/config/{key} with {value: ...}

			if (topTitle !== originalSettings.site_title) {
				await fastApi('PUT', '/api/v1/admin/config/site_title', { value: topTitle });
				originalSettings.site_title = topTitle;
			}
			/* 다크모드 임시 사용 중지
			if ((darkMode ? 'dark' : 'light') !== originalSettings.theme_mode) {
				await fastApi('PUT', '/api/v1/admin/config/theme_mode', {
					value: darkMode ? 'dark' : 'light'
				});
				originalSettings.theme_mode = darkMode ? 'dark' : 'light';
			}
			*/
			if (landingPage !== originalSettings.landing_page) {
				await fastApi('PUT', '/api/v1/admin/config/landing_page', { value: landingPage });
				originalSettings.landing_page = landingPage;
			}
			/* 랭킹별 리다이렉트 임시 삭제
			if (redirectRank1 !== originalSettings.redirect_rank1_to_profile) {
				await fastApi('PUT', '/api/v1/admin/config/redirect_rank1_to_profile', { value: redirectRank1 });
				originalSettings.redirect_rank1_to_profile = redirectRank1;
			}
			*/

			// ⚡ Watchdog 설정 저장
			if (watchdogEnabled !== originalSettings.watchdog_enabled) {
				await fastApi('PUT', '/api/v1/admin/config/watchdog_enabled', { value: watchdogEnabled });
				originalSettings.watchdog_enabled = watchdogEnabled;
			}
			if (watchdogFailThreshold !== originalSettings.watchdog_fail_threshold) {
				await fastApi('PUT', '/api/v1/admin/config/watchdog_fail_threshold', { value: Number(watchdogFailThreshold) });
				originalSettings.watchdog_fail_threshold = watchdogFailThreshold;
			}
			if (watchdogSecurityAlert !== originalSettings.watchdog_security_alert) {
				await fastApi('PUT', '/api/v1/admin/config/watchdog_security_alert', { value: watchdogSecurityAlert });
				originalSettings.watchdog_security_alert = watchdogSecurityAlert;
			}
			if (watchdogInstructionDelayMinutes !== originalSettings.watchdog_instruction_delay_minutes) {
				await fastApi('PUT', '/api/v1/admin/config/watchdog_instruction_delay_minutes', { value: Number(watchdogInstructionDelayMinutes) });
				originalSettings.watchdog_instruction_delay_minutes = watchdogInstructionDelayMinutes;
			}

			// 🗑️ Data Retention 설정 저장
			if (retentionAuditLogDays !== originalSettings.retention_audit_log_days) {
				await fastApi('PUT', '/api/v1/admin/config/retention_audit_log_days', { value: Number(retentionAuditLogDays) });
				originalSettings.retention_audit_log_days = retentionAuditLogDays;
			}
			if (retentionSystemTaskDays !== originalSettings.retention_system_task_days) {
				await fastApi('PUT', '/api/v1/admin/config/retention_system_task_days', { value: Number(retentionSystemTaskDays) });
				originalSettings.retention_system_task_days = retentionSystemTaskDays;
			}
			if (retentionSessionHistoryDays !== originalSettings.retention_session_history_days) {
				await fastApi('PUT', '/api/v1/admin/config/retention_session_history_days', { value: Number(retentionSessionHistoryDays) });
				originalSettings.retention_session_history_days = retentionSessionHistoryDays;
			}
			if (retentionRedisDynamicHours !== originalSettings.retention_redis_dynamic_hours) {
				await fastApi('PUT', '/api/v1/admin/config/retention_redis_dynamic_hours', { value: Number(retentionRedisDynamicHours) });
				originalSettings.retention_redis_dynamic_hours = retentionRedisDynamicHours;
			}

			alert('설정이 저장되었습니다.');
			// Reload the page to ensure all UI elements reflect the updated configuration
			window.location.reload();
		} catch (e) {
			console.error('Failed to save settings:', e);
			// Optionally, show an alert
			alert('설정 저장에 실패했습니다.');
		}
	}

	// 🧹 수동 가비지 컬렉션(GC) 즉시 실행 함수
	async function runGcNow() {
		if (isGcRunning) return;
		if (!confirm('보존 기간을 초과한 DB 이력 데이터와 Redis 만료/고아 키를 지금 즉시 정리하시겠습니까?')) return;

		isGcRunning = true;
		try {
			const res = await fastApi('POST', '/api/v1/admin/system/gc/run');
			lastGcResult = res;
			alert(
				`가비지 컬렉션(GC) 완료!\n` +
				`- 만료 태스크 삭제: ${res.deleted_tasks}건\n` +
				`- 만료 세션 이력 삭제: ${res.deleted_sessions}건\n` +
				`- 만료 감사로그 삭제: ${res.deleted_audit_logs}건\n` +
				`- Redis TTL 강제 적용: ${res.redis_ttl_enforced}건\n` +
				`- Redis 고아 키 삭제: ${res.redis_orphans_removed}건`
			);
		} catch (e) {
			console.error('Failed to run GC:', e);
			alert('가비지 컬렉션(GC) 실행에 실패했습니다.');
		} finally {
			isGcRunning = false;
		}
	}

	// Function to send push notification to all users
	async function sendPushNotificationToAll() {
		try {
			await fastApi('POST', '/push/send-to-all');
			alert('모든 사용자에게 푸시 알림을 전송했습니다.');
		} catch (e) {
			console.error('Failed to send push notification:', e);
			alert('푸시 알림 전송에 실패했습니다.');
		}
	}

	// Load settings when the component mounts
	onMount(() => {
		loadSettings();
	});
</script>

<svelte:head>
	<title>{topTitle}</title>
</svelte:head>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-6 px-4 pb-20 font-['Noto_Sans_KR','Outfit'] md:space-y-10 md:px-6 md:pb-40 lg:px-8"
>
	<!-- 페이지 헤더 -->
	<div
		class="flex flex-col items-start justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:gap-6 md:border-b-4 md:pb-8"
	>
		<div>
			<span
				class="mb-1 block text-[8px] font-black tracking-[0.2em] text-slate-400 uppercase md:mb-2 md:text-[10px] md:tracking-[0.4em]"
				>System Administration</span
			>
			<h1 class="text-3xl font-black tracking-tighter text-black uppercase italic md:text-5xl">
				기본 <span class="NOT-ITALIC text-blue-600"
					>설정 <Icon
						icon="mdi:cog"
						class="ml-1 inline-block align-text-bottom text-blue-600"
					/></span
				>
			</h1>
			<p class="mt-2 text-xs font-bold text-slate-500 md:mt-3 md:text-sm">
				시스템 전반에 걸친 기본 설정을 관리합니다.
			</p>
		</div>
		<div class="flex gap-2 md:gap-4">
			<a
				href="/v1/admin"
				class="btn rounded-lg border-none bg-slate-200 px-4 font-black text-slate-700 shadow-md transition-all btn-sm hover:bg-slate-300 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
			>
				<Icon icon="mdi:home-outline" class="h-4 w-4 md:h-6 md:w-6" />
				관리자 홈
			</a>
			<button
				onclick={sendPushNotificationToAll}
				class="btn rounded-lg border-none bg-purple-600 px-4 font-black text-white shadow-md transition-all btn-sm hover:bg-purple-700 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
			>
				<Icon icon="mdi:bell-outline" class="h-4 w-4 md:h-6 md:w-6" />
				푸시 알림 전송
			</button>
			<button
				onclick={saveSettings}
				class="btn rounded-lg border-none bg-blue-600 px-4 font-black text-white shadow-md transition-all btn-sm hover:bg-blue-700 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
			>
				<Icon icon="mdi:content-save-outline" class="h-4 w-4 md:h-6 md:w-6" />
				설정 저장
			</button>
		</div>
	</div>

	<!-- 설정 폼 카드 -->
	<div class="card mb-8 border border-base-300 bg-base-100 shadow-md">
		<div class="card-body space-y-4 rounded-b-xl bg-base-200 p-5 md:p-8">
			<div class="form-control w-full">
				<label class="label" for="topTitleInput"
					><span class="label-text font-bold text-black">상단 타이틀</span></label
				>
				<input
					type="text"
					id="topTitleInput"
					class="input-bordered input w-full bg-white text-black"
					bind:value={topTitle}
					placeholder="웹사이트 상단에 표시될 타이틀"
				/>
			</div>

			<!-- 다크모드 임시 사용 중지 
			<div class="form-control w-full">
				<label class="label cursor-pointer justify-start gap-3">
					<span class="label-text font-bold text-base-content">다크 모드 활성화</span>
					<input type="checkbox" class="toggle toggle-primary" bind:checked={darkMode} />
				</label>
			</div>
			-->

			<div class="form-control w-full">
				<label class="label" for="landingPageInput"
					><span class="label-text font-bold text-base-content">기본 랜딩 페이지</span></label
				>
				<input
					type="text"
					id="landingPageInput"
					class="input-bordered input w-full"
					bind:value={landingPage}
					placeholder="로그인 후 이동할 기본 페이지 경로"
				/>
			</div>

			<!-- 랭킹별 리다이렉트 임시 삭제
			<div class="form-control w-full">
				<label class="label cursor-pointer justify-start gap-3">
					<span class="label-text font-bold text-base-content">최소 권한 유저(Rank 1) 프로필 리다이렉트</span>
					<input type="checkbox" class="toggle toggle-warning" bind:checked={redirectRank1} />
				</label>
				<span class="px-1 text-[10px] text-slate-500">활성화 시 Rank 1 유저는 접속 시 프로필 페이지로 강제 이동합니다.</span>
			</div>
			-->
		</div>
	</div>

	<!-- ⚡ 구분선: 자율 이상 징후 감지 및 경보 (System Watchdog) -->
	<div class="divider my-8 font-black text-slate-500 uppercase tracking-widest text-xs md:text-sm">
		<Icon icon="mdi:shield-alert-outline" class="inline-block text-amber-500 h-5 w-5 mr-1 align-text-bottom" />
		자율 이상 징후 감지 및 경보 (System Watchdog)
	</div>

	<!-- Watchdog 설정 카드 -->
	<div class="card mb-8 border border-base-300 bg-base-100 shadow-md">
		<div class="card-body space-y-6 rounded-b-xl bg-base-200 p-5 md:p-8">
			<!-- 카드 헤더 및 전체 활성화 토글 -->
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-300 pb-4">
				<div>
					<h3 class="text-lg font-black text-slate-800 flex items-center gap-2">
						<Icon icon="mdi:radar" class="text-blue-600 h-5 w-5" />
						자율신경계 Watchdog 실시간 모니터링 정책
					</h3>
					<p class="text-xs font-semibold text-slate-500 mt-1">
						워커 연속 실패, 비인가 보안 침해, 긴급 지시 미확인 지연 감지 시 최고 관리자에게 L4 경보를 자동 발송합니다.
					</p>
				</div>
				<label class="label cursor-pointer gap-3 bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-200 shrink-0">
					<span class="label-text font-black text-sm text-slate-800">Watchdog 활성화</span>
					<input type="checkbox" class="toggle toggle-primary toggle-sm md:toggle-md" bind:checked={watchdogEnabled} />
				</label>
			</div>

			<!-- 설정 항목 그리드 -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2" class:opacity-50={!watchdogEnabled}>
				<!-- 1. 태스크 연속 실패 임계치 -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
					<label class="label pb-1" for="taskFailThresholdInput">
						<span class="label-text font-black text-slate-800 flex items-center gap-1.5">
							<Icon icon="mdi:alert-circle-outline" class="text-rose-500 h-4 w-4" />
							워커 연속 실패(FAILED) 경보 임계치
						</span>
					</label>
					<span class="text-[11px] text-slate-500 mb-2 font-medium">최근 1시간 내 태스크가 지정 횟수 이상 영구 실패 시 즉각 관리자 L4 알림을 발송합니다.</span>
					<div class="flex items-center gap-3">
						<input
							type="number"
							id="taskFailThresholdInput"
							class="input input-bordered w-32 font-black text-slate-900 bg-slate-50"
							min="1"
							max="10"
							bind:value={watchdogFailThreshold}
							disabled={!watchdogEnabled}
						/>
						<span class="text-xs font-bold text-slate-600">회 연속 실패 시</span>
					</div>
				</div>

				<!-- 2. 보안 침해 감지 즉시 경보 -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs justify-between">
					<div>
						<label class="label pb-1 cursor-pointer justify-start gap-2">
							<Icon icon="mdi:shield-lock-outline" class="text-amber-500 h-4 w-4" />
							<span class="label-text font-black text-slate-800">보안 침해 시도 즉시 경보</span>
						</label>
						<span class="text-[11px] text-slate-500 mb-2 font-medium block">403 Forbidden 권한 침해 또는 위조 토큰 감지 시 즉각 관리자 L4 알림을 발송합니다.</span>
					</div>
					<div class="pt-2">
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="checkbox"
								class="toggle toggle-warning"
								bind:checked={watchdogSecurityAlert}
								disabled={!watchdogEnabled}
							/>
							<span class="text-xs font-bold text-slate-700">{watchdogSecurityAlert ? '즉시 발송 활성화됨' : '비활성화됨'}</span>
						</label>
					</div>
				</div>

				<!-- 3. 현장 지시사항 미확인 지연 기준 시간 -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs md:col-span-2">
					<label class="label pb-1" for="instructionDelayInput">
						<span class="label-text font-black text-slate-800 flex items-center gap-1.5">
							<Icon icon="mdi:clock-alert-outline" class="text-blue-600 h-4 w-4" />
							현장 지시사항 미확인 인지 지연 감시 기준
						</span>
					</label>
					<span class="text-[11px] text-slate-500 mb-2 font-medium">긴급 지시사항 발행 후 지정 시간이 경과했음에도 미확인율이 50% 이상 지속될 때 관제탑 경보를 발송합니다.</span>
					<div class="flex items-center gap-3">
						<input
							type="number"
							id="instructionDelayInput"
							class="input input-bordered w-32 font-black text-slate-900 bg-slate-50"
							min="5"
							max="180"
							step="5"
							bind:value={watchdogInstructionDelayMinutes}
							disabled={!watchdogEnabled}
						/>
						<span class="text-xs font-bold text-slate-600">분 경과 후 미확인율 점검</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 🗑️ 구분선: 시스템 데이터 보존 및 가비지 컬렉션 (Data Retention & GC) -->
	<div class="divider my-8 font-black text-slate-500 uppercase tracking-widest text-xs md:text-sm">
		<Icon icon="mdi:database-clock-outline" class="inline-block text-emerald-500 h-5 w-5 mr-1 align-text-bottom" />
		데이터 보존 주기 및 메모리 관리 (Data Retention & GC)
	</div>

	<!-- Data Retention 설정 카드 -->
	<div class="card mb-8 border border-base-300 bg-base-100 shadow-md">
		<div class="card-body space-y-6 rounded-b-xl bg-base-200 p-5 md:p-8">
			<!-- 카드 헤더 및 즉시 GC 실행 버튼 -->
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-300 pb-4">
				<div>
					<h3 class="text-lg font-black text-slate-800 flex items-center gap-2">
						<Icon icon="mdi:broom" class="text-emerald-600 h-5 w-5" />
						자율 가비지 컬렉션(GC) 및 저장소 수명 주기 정책
					</h3>
					<p class="text-xs font-semibold text-slate-500 mt-1">
						Redis 만료 기한(TTL)을 강제하고, DB에 누적된 감사로그/세션/태스크 이력을 자동 정리하여 용량을 보존합니다.
					</p>
				</div>
				<button
					onclick={runGcNow}
					disabled={isGcRunning}
					class="btn rounded-xl border-none bg-emerald-600 px-5 font-black text-white shadow-md transition-all hover:bg-emerald-700 btn-sm md:btn-md shrink-0 flex items-center gap-2"
				>
					<Icon icon={isGcRunning ? "mdi:loading" : "mdi:play-circle-outline"} class={`h-4 w-4 md:h-5 md:w-5 ${isGcRunning ? 'animate-spin' : ''}`} />
					{isGcRunning ? '정리 수행 중...' : '지금 즉시 정리 (Run GC Now)'}
				</button>
			</div>

			<!-- 설정 항목 그리드 -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
				<!-- 1. 감사로그 보존 기간 -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
					<label class="label pb-1" for="auditLogRetentionInput">
						<span class="label-text font-black text-slate-800 flex items-center gap-1.5">
							<Icon icon="mdi:file-document-outline" class="text-blue-500 h-4 w-4" />
							감사로그 (Audit Log) 보존 기간
						</span>
					</label>
					<span class="text-[11px] text-slate-500 mb-2 font-medium">법적 컴플라이언스 및 보안 감사 이력을 지정 일수 동안 보존 후 자동 파기합니다.</span>
					<div class="flex items-center gap-3">
						<input
							type="number"
							id="auditLogRetentionInput"
							class="input input-bordered w-32 font-black text-slate-900 bg-slate-50"
							min="30"
							max="730"
							step="30"
							bind:value={retentionAuditLogDays}
						/>
						<span class="text-xs font-bold text-slate-600">일간 보존</span>
					</div>
				</div>

				<!-- 2. 완료/실패 백그라운드 태스크 보존 기간 -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
					<label class="label pb-1" for="systemTaskRetentionInput">
						<span class="label-text font-black text-slate-800 flex items-center gap-1.5">
							<Icon icon="mdi:checkbox-marked-circle-outline" class="text-emerald-500 h-4 w-4" />
							완료/실패 태스크 이력 보존 기간
						</span>
					</label>
					<span class="text-[11px] text-slate-500 mb-2 font-medium">SUCCESS 또는 FAILED로 종료된 백그라운드 작업 이력을 지정 일수 후 자동 삭제합니다.</span>
					<div class="flex items-center gap-3">
						<input
							type="number"
							id="systemTaskRetentionInput"
							class="input input-bordered w-32 font-black text-slate-900 bg-slate-50"
							min="7"
							max="180"
							step="7"
							bind:value={retentionSystemTaskDays}
						/>
						<span class="text-xs font-bold text-slate-600">일간 보존</span>
					</div>
				</div>

				<!-- 3. 만료 세션 이력 보존 기간 -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
					<label class="label pb-1" for="sessionHistoryRetentionInput">
						<span class="label-text font-black text-slate-800 flex items-center gap-1.5">
							<Icon icon="mdi:history" class="text-indigo-500 h-4 w-4" />
							로그아웃/만료 세션 이력 보존 기간
						</span>
					</label>
					<span class="text-[11px] text-slate-500 mb-2 font-medium">로그아웃되거나 강제 추방(KICKED_OUT)된 세션 이력을 지정 일수 후 자동 정리합니다.</span>
					<div class="flex items-center gap-3">
						<input
							type="number"
							id="sessionHistoryRetentionInput"
							class="input input-bordered w-32 font-black text-slate-900 bg-slate-50"
							min="7"
							max="365"
							step="7"
							bind:value={retentionSessionHistoryDays}
						/>
						<span class="text-xs font-bold text-slate-600">일간 보존</span>
					</div>
				</div>

				<!-- 4. Redis 동적 타겟 그룹 만료 시간 (TTL) -->
				<div class="form-control w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
					<label class="label pb-1" for="redisDynamicTtlInput">
						<span class="label-text font-black text-slate-800 flex items-center gap-1.5">
							<Icon icon="mdi:timer-outline" class="text-rose-500 h-4 w-4" />
							Redis 동적 그룹 만료 기한 (TTL)
						</span>
					</label>
					<span class="text-[11px] text-slate-500 mb-2 font-medium">일별 배차/휴무 동적 타겟 그룹 키가 메모리에 잔류할 수 있는 최대 수명(TTL)을 지정합니다.</span>
					<div class="flex items-center gap-3">
						<input
							type="number"
							id="redisDynamicTtlInput"
							class="input input-bordered w-32 font-black text-slate-900 bg-slate-50"
							min="12"
							max="168"
							step="12"
							bind:value={retentionRedisDynamicHours}
						/>
						<span class="text-xs font-bold text-slate-600">시간 후 자동 소멸</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 하단 액션 바 -->
	<div class="flex justify-end gap-3 pt-2">
		<button
			onclick={saveSettings}
			class="btn rounded-xl border-none bg-blue-600 px-8 font-black text-white shadow-lg transition-all hover:bg-blue-700 btn-md md:btn-lg"
		>
			<Icon icon="mdi:content-save-outline" class="h-5 w-5" />
			설정 전체 저장
		</button>
	</div>
</div>
