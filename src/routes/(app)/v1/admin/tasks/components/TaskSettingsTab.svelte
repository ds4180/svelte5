<script lang="ts">
	/**
	 * ============================================================================
	 * [태스크 관제 — 비즈니스 정책 설정 탭 (TaskSettingsTab.svelte)]
	 * ============================================================================
	 * - 워커 엔진 가동/일시정지 스위치, 폴링·좀비 회수 주기, 기본 실행·지수 백오프 정책,
	 *   보존 기간 및 Watchdog 연속 실패 경보 임계치, 6대 핵심 자율신경계 스케줄(DB 실시간 연동),
	 *   관제 UI 자동 갱신 및 원클릭 Cron 프리셋을 코드 수정 없이 동적으로 제어합니다.
	 */
	import Icon from '@iconify/svelte';
	import { adminUpdateTaskSettings } from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		DEFAULT_TASK_SETTINGS,
		normalizeTaskSettings,
		type CoreScheduleItem,
		type CronPresetItem,
		type TaskSettings
	} from '$lib/services/taskAdminService';
	import { formatApiError } from '$lib/utils/error';

	interface Props {
		settings: TaskSettings;
		canWrite: boolean;
		onSaved: (updated: TaskSettings) => void;
	}

	let { settings, canWrite = false, onSaved }: Props = $props();

	let draft = $state<TaskSettings>(normalizeTaskSettings(DEFAULT_TASK_SETTINGS));
	let isSaving = $state(false);

	$effect(() => {
		draft = normalizeTaskSettings(settings);
	});

	function handleResetDefaults() {
		draft = normalizeTaskSettings(DEFAULT_TASK_SETTINGS);
		toast.info('기본 권장 정책값을 편집 폼에 불러왔습니다. [정책 설정 저장]을 눌러 반영하세요.');
	}

	function switchCoreMode(item: CoreScheduleItem, mode: 'cron' | 'interval') {
		item.mode = mode;
		if (mode === 'cron') {
			if (!item.cron_expression) item.cron_expression = '0 3 * * *';
			item.repeat_interval = null;
		} else {
			if (!item.repeat_interval || item.repeat_interval < 10) item.repeat_interval = 300;
			item.cron_expression = null;
		}
	}

	function addCronPreset() {
		draft.cron_presets = [
			...draft.cron_presets,
			{ label: '새 스케줄 프리셋', cron: '0 2 * * *', desc: '사용자 정의 정기 실행 주기' }
		];
	}

	function removeCronPreset(idx: number) {
		draft.cron_presets = draft.cron_presets.filter((_, i) => i !== idx);
	}

	async function handleSave() {
		if (!canWrite) return;

		// 유효성 사전 검증
		const validPresets: CronPresetItem[] = draft.cron_presets
			.map((p) => ({
				label: (p.label || '').trim(),
				cron: (p.cron || '').trim(),
				desc: (p.desc || '').trim()
			}))
			.filter((p) => p.label && p.cron);

		if (validPresets.length === 0) {
			toast.warning('최소 1개 이상의 Cron 프리셋을 유지해 주세요.');
			return;
		}

		isSaving = true;
		try {
			const payload: TaskSettings = {
				...draft,
				cron_presets: validPresets
			};
			const res = await adminUpdateTaskSettings<{ settings: TaskSettings; message?: string }>(payload);
			const normalized = normalizeTaskSettings(res?.settings ?? payload);
			onSaved(normalized);
			toast.success(res?.message || '태스크·워커 정책 설정 및 정기 스케줄이 즉시 반영되었습니다.');
		} catch (err) {
			toast.error(formatApiError(err, '태스크 정책 설정 저장에 실패했습니다.'));
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="p-5 sm:p-6 md:p-8 space-y-8">
	<!-- 상단 안내 배너 -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 sm:p-5">
		<div class="space-y-1">
			<div class="flex items-center gap-2 text-sm font-black text-indigo-900">
				<Icon icon="solar:settings-minimalistic-bold-duotone" class="text-xl text-indigo-600" />
				<span>비동기 태스크 워커 & 자율신경계 통합 정책 제어</span>
			</div>
			<p class="text-xs text-slate-600 leading-relaxed">
				저장 즉시 백그라운드 워커 루프(최대 5초 내 핫리로드), 데이터 보존 GC, 이상징후 감시(Watchdog) 및 PostgreSQL 정기 예약 테이블(<code>system_tasks</code>)에 실시간 동기화됩니다.
			</p>
		</div>
		{#if canWrite}
			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onclick={handleResetDefaults}
					class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
				>
					기본값 복원
				</button>
				<button
					type="button"
					onclick={handleSave}
					disabled={isSaving}
					class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
				>
					<Icon icon="solar:diskette-bold" class="text-sm" />
					<span>{isSaving ? '동기화 중...' : '정책 설정 저장'}</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- 섹션 1: 워커 엔진 가동 및 자가치유 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
			<div>
				<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
					<Icon icon="solar:cpu-bolt-bold-duotone" class="text-lg text-blue-600" />
					<span>1. 워커 엔진 가동 · 자가치유(Self-Healing) 정책</span>
				</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					큐 폴링 주기 및 비정상 중단(RUNNING 고착) 작업 자동 회수 주기를 제어합니다.
				</p>
			</div>

			<label class="inline-flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition {draft.worker_enabled ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-300 bg-amber-50'}">
				<input
					type="checkbox"
					bind:checked={draft.worker_enabled}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
				/>
				<div>
					<div class="text-xs font-black {draft.worker_enabled ? 'text-emerald-800' : 'text-amber-800'}">
						{draft.worker_enabled ? '워커 엔진 가동 중 (ONLINE)' : '워커 신규 소비 일시정지 (PAUSED)'}
					</div>
					<div class="text-[10px] text-slate-500">
						해제 시 컨테이너 종료 없이 새 작업 착수만 안전하게 대기합니다.
					</div>
				</div>
			</label>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div>
				<label for="cfgPollSec" class="block text-xs font-black text-slate-700 mb-1">
					큐 폴링 주기 (1~60초)
				</label>
				<input
					id="cfgPollSec"
					type="number"
					min="1"
					max="60"
					disabled={!canWrite}
					bind:value={draft.worker_poll_interval_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">유휴 시 DB 큐를 재확인하는 대기 간격 (권장: 2초)</p>
			</div>

			<div>
				<label for="cfgReclaimSec" class="block text-xs font-black text-slate-700 mb-1">
					타임아웃 좀비 작업 회수 주기 (10~600초)
				</label>
				<input
					id="cfgReclaimSec"
					type="number"
					min="10"
					max="600"
					disabled={!canWrite}
					bind:value={draft.reclaim_check_interval_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">제한시간을 초과한 RUNNING 작업을 감시·복구하는 간격</p>
			</div>

			<div>
				<label for="cfgBootHealSec" class="block text-xs font-black text-slate-700 mb-1">
					서버 재기동 시 고착 복구 기준 (60~3600초)
				</label>
				<input
					id="cfgBootHealSec"
					type="number"
					min="60"
					max="3600"
					disabled={!canWrite}
					bind:value={draft.bootstrap_heal_stuck_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">컨테이너 재시작 시 이전 RUNNING 고착 건을 PENDING으로 되돌릴 기준</p>
			</div>
		</div>
	</section>

	<!-- 섹션 2: 기본 실행 및 지수 백오프 재시도 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:restart-square-bold-duotone" class="text-lg text-indigo-600" />
				<span>2. 기본 실행 옵션 · 지수 백오프(Exponential Backoff) 재시도 정책</span>
			</h3>
			<p class="mt-0.5 text-xs text-slate-500">
				신규 등록 작업의 기본값 및 오류 발생 시 재시도 대기시간 공식(<code>min(최대상한, 밑수 × 2^(재시도-1))</code>초)을 제어합니다.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<div>
				<label for="cfgDefPrio" class="block text-xs font-black text-slate-700 mb-1">기본 우선순위 (1~10)</label>
				<input
					id="cfgDefPrio"
					type="number"
					min="1"
					max="10"
					disabled={!canWrite}
					bind:value={draft.default_priority}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">1이 가장 높음 (긴급)</p>
			</div>

			<div>
				<label for="cfgDefRetry" class="block text-xs font-black text-slate-700 mb-1">기본 최대 재시도 (0~10회)</label>
				<input
					id="cfgDefRetry"
					type="number"
					min="0"
					max="10"
					disabled={!canWrite}
					bind:value={draft.default_max_retries}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">초과 시 최종 FAILED 전환</p>
			</div>

			<div>
				<label for="cfgDefTimeout" class="block text-xs font-black text-slate-700 mb-1">기본 제한시간 (10~3600초)</label>
				<input
					id="cfgDefTimeout"
					type="number"
					min="10"
					max="3600"
					disabled={!canWrite}
					bind:value={draft.default_timeout_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">개별 작업의 타임아웃 기본치</p>
			</div>

			<div>
				<label for="cfgBackoffBase" class="block text-xs font-black text-slate-700 mb-1">재시도 백오프 밑수 (2~120초)</label>
				<input
					id="cfgBackoffBase"
					type="number"
					min="2"
					max="120"
					disabled={!canWrite}
					bind:value={draft.retry_backoff_base_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">1차 실패 시 대기 초수</p>
			</div>

			<div>
				<label for="cfgBackoffMax" class="block text-xs font-black text-slate-700 mb-1">재시도 백오프 상한 (30~3600초)</label>
				<input
					id="cfgBackoffMax"
					type="number"
					min="30"
					max="3600"
					disabled={!canWrite}
					bind:value={draft.retry_backoff_max_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">최대 지연 상한선</p>
			</div>
		</div>
	</section>

	<!-- 섹션 3: 완료 이력 보존 및 자율 감시(Watchdog) 경보 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:shield-warning-bold-duotone" class="text-lg text-rose-600" />
				<span>3. 작업 이력 보존 · 연속 실패 자율경보(Watchdog) 정책</span>
			</h3>
			<p class="mt-0.5 text-xs text-slate-500">
				<code>retention_system_task_days</code> 및 <code>watchdog_fail_threshold</code> 전역 키와 양방향 자동 동기화됩니다.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
			<div>
				<label for="cfgRetDays" class="block text-xs font-black text-slate-700 mb-1">
					완료·실패 태스크 보존 일수 (1~365일)
				</label>
				<input
					id="cfgRetDays"
					type="number"
					min="1"
					max="365"
					disabled={!canWrite}
					bind:value={draft.completed_retention_days}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">야간 데이터 청소(GC) 시 경과된 비반복 이력 자동 영구 삭제</p>
			</div>

			<div>
				<label for="cfgWdThresh" class="block text-xs font-black text-slate-700 mb-1">
					최근 1시간 연속 실패 경보 임계치 (1~20건)
				</label>
				<input
					id="cfgWdThresh"
					type="number"
					min="1"
					max="20"
					disabled={!canWrite}
					bind:value={draft.watchdog_fail_threshold}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">최근 1시간 내 FAILED 건수가 임계치 이상이면 관리자 긴급 알림 발송</p>
			</div>

			<div class="pt-5">
				<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
					<input
						type="checkbox"
						bind:checked={draft.watchdog_fail_alert_enabled}
						disabled={!canWrite}
						class="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
					/>
					<div>
						<div class="text-xs font-black text-slate-800">태스크 연속 실패 시 관리자 알림 발송</div>
						<div class="text-[10px] text-slate-500">해제 시 Watchdog 점검에서 태스크 실패 경보를 생략합니다.</div>
					</div>
				</label>
			</div>
		</div>
	</section>

	<!-- 섹션 4: 6대 핵심 자율신경계 정기 스케줄 편집기 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:calendar-mark-bold-duotone" class="text-lg text-emerald-600" />
				<span>4. 6대 자율신경계 핵심 정기 스케줄 마스터 (DB 실시간 연동)</span>
			</h3>
			<p class="mt-0.5 text-xs text-slate-500">
				각 시스템 핵심 작업의 활성화 여부, 실행 방식(Cron 시각 vs 초 단위 간격), 주기 및 우선순위를 조정하면 저장 즉시 <code>system_tasks</code> 예약 행에 반영됩니다.
			</p>
		</div>

		<div class="space-y-3">
			{#each draft.core_schedules as item (item.unique_key)}
				<div class="rounded-xl border p-4 transition {item.enabled ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-slate-100/70 opacity-75'}">
					<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
						<div class="flex items-start gap-3 min-w-0">
							<input
								type="checkbox"
								bind:checked={item.enabled}
								disabled={!canWrite}
								class="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
							/>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-xs font-black text-slate-900">{item.label}</span>
									<span class="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 border border-slate-200">
										{item.task_type}
									</span>
								</div>
								<div class="text-[10px] font-mono text-slate-400 mt-0.5">고유키: {item.unique_key}</div>
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-2.5">
							<!-- 모드 스위치 -->
							<div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
								<button
									type="button"
									disabled={!canWrite}
									onclick={() => switchCoreMode(item, 'cron')}
									class="rounded-md px-2.5 py-1 text-[11px] font-bold transition {item.mode === 'cron' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}"
								>
									Cron 시각
								</button>
								<button
									type="button"
									disabled={!canWrite}
									onclick={() => switchCoreMode(item, 'interval')}
									class="rounded-md px-2.5 py-1 text-[11px] font-bold transition {item.mode === 'interval' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}"
								>
									초 간격
								</button>
							</div>

							{#if item.mode === 'cron'}
								<input
									type="text"
									disabled={!canWrite}
									bind:value={item.cron_expression}
									placeholder="0 3 * * *"
									aria-label="{item.label} Cron 표현식"
									class="w-36 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-blue-700"
								/>
							{:else}
								<div class="flex items-center gap-1">
									<input
										type="number"
										min="10"
										max="86400"
										disabled={!canWrite}
										bind:value={item.repeat_interval}
										aria-label="{item.label} 반복 초"
										class="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-slate-800"
									/>
									<span class="text-[11px] font-bold text-slate-500">초마다</span>
								</div>
							{/if}

							<div class="flex items-center gap-1">
								<span class="text-[11px] font-bold text-slate-400">우선순위</span>
								<input
									type="number"
									min="1"
									max="10"
									disabled={!canWrite}
									bind:value={item.priority}
									aria-label="{item.label} 우선순위"
									class="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold text-slate-800"
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- 섹션 5: 관제 화면(UI) 옵션 및 Cron 프리셋 편집기 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:widget-5-bold-duotone" class="text-lg text-amber-600" />
				<span>5. 관제 대시보드 UI · 원클릭 Cron 프리셋 관리</span>
			</h3>
			<p class="mt-0.5 text-xs text-slate-500">
				실시간 모니터링 자동 새로고침 주기, 페이지당 표시 건수 및 작업 등록·수정 창에서 제공하는 Cron 단축 버튼 목록을 관리합니다.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
			<div>
				<label for="cfgUiRefreshSec" class="block text-xs font-black text-slate-700 mb-1">
					자동 갱신 주기 (3~120초)
				</label>
				<input
					id="cfgUiRefreshSec"
					type="number"
					min="3"
					max="120"
					disabled={!canWrite}
					bind:value={draft.ui_auto_refresh_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="cfgUiLimit" class="block text-xs font-black text-slate-700 mb-1">
					목록 기본 조회 건수 (10~200건)
				</label>
				<input
					id="cfgUiLimit"
					type="number"
					min="10"
					max="200"
					disabled={!canWrite}
					bind:value={draft.ui_page_limit}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div class="pt-5">
				<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
					<input
						type="checkbox"
						bind:checked={draft.ui_auto_refresh_default}
						disabled={!canWrite}
						class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-xs font-black text-slate-800">화면 진입 시 자동 갱신 기본 켜기</span>
				</label>
			</div>
		</div>

		<!-- Cron 프리셋 목록 편집 -->
		<div class="pt-2 space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black text-slate-700">원클릭 Cron 프리셋 목록 ({draft.cron_presets.length}개)</span>
				{#if canWrite}
					<button
						type="button"
						onclick={addCronPreset}
						class="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
					>
						<Icon icon="solar:add-circle-bold" /> 프리셋 추가
					</button>
				{/if}
			</div>

			<div class="space-y-2">
				{#each draft.cron_presets as preset, idx (idx)}
					<div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 bg-slate-50 p-2.5">
						<input
							type="text"
							disabled={!canWrite}
							bind:value={preset.label}
							placeholder="프리셋 이름 (예: 매일 새벽 3시)"
							aria-label="프리셋 이름"
							class="sm:col-span-4 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
						/>
						<input
							type="text"
							disabled={!canWrite}
							bind:value={preset.cron}
							placeholder="0 3 * * *"
							aria-label="Cron 표현식"
							class="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-blue-700"
						/>
						<input
							type="text"
							disabled={!canWrite}
							bind:value={preset.desc}
							placeholder="설명 문구"
							aria-label="프리셋 설명"
							class="sm:col-span-4 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600"
						/>
						{#if canWrite}
							<div class="sm:col-span-1 flex justify-end">
								<button
									type="button"
									onclick={() => removeCronPreset(idx)}
									class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
									aria-label="프리셋 삭제"
								>
									<Icon icon="solar:trash-bin-trash-bold" class="text-base" />
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	{#if canWrite}
		<div class="flex items-center justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={handleResetDefaults}
				class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
			>
				기본값 복원
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={isSaving}
				class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
			>
				<Icon icon="solar:diskette-bold" class="text-base" />
				<span>{isSaving ? '저장 및 스케줄 동기화 중...' : '정책 설정 저장'}</span>
			</button>
		</div>
	{/if}
</div>
