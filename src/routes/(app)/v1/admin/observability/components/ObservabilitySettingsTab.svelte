<script lang="ts">
	/**
	 * ============================================================================
	 * [통합 관제 — 비즈니스 정책 설정 탭 (ObservabilitySettingsTab.svelte)]
	 * ============================================================================
	 * - Watchdog 감시·쿨다운·예외 행위, 감사로그·세션 이력 보존 일수(Retention GC),
	 *   개인정보 Diff 마스킹 필드, CSV/콘솔로그 다운로드 정책, 대시보드 UI 옵션을
	 *   코드 수정 없이 실시간 제어합니다.
	 */
	import Icon from '@iconify/svelte';
	import { adminUpdateObservabilitySettings } from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		DEFAULT_OBSERVABILITY_SETTINGS,
		normalizeObservabilitySettings,
		type ObservabilitySettings
	} from '$lib/services/observabilityAdminService';
	import { formatApiError } from '$lib/utils/error';

	interface Props {
		settings: ObservabilitySettings;
		builtinMaskFields: string[];
		canWrite: boolean;
		onSaved: (updated: ObservabilitySettings) => void;
	}

	let { settings, builtinMaskFields = [], canWrite = false, onSaved }: Props = $props();

	let draft = $state<ObservabilitySettings>(normalizeObservabilitySettings(DEFAULT_OBSERVABILITY_SETTINGS));
	let newIgnoreAction = $state('');
	let newExtraMaskField = $state('');
	let isSaving = $state(false);

	$effect(() => {
		draft = normalizeObservabilitySettings(settings);
	});

	function handleResetDefaults() {
		draft = normalizeObservabilitySettings(DEFAULT_OBSERVABILITY_SETTINGS);
		toast.info('기본 권장 관제 정책값을 불러왔습니다. [정책 설정 저장]을 눌러 반영하세요.');
	}

	function addIgnoreAction() {
		const cleaned = newIgnoreAction.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
		if (!cleaned) return;
		if (!draft.security_alert_ignore_actions.includes(cleaned)) {
			draft.security_alert_ignore_actions = [...draft.security_alert_ignore_actions, cleaned];
		}
		newIgnoreAction = '';
	}

	function removeIgnoreAction(action: string) {
		draft.security_alert_ignore_actions = draft.security_alert_ignore_actions.filter((a) => a !== action);
	}

	function addExtraMaskField() {
		const cleaned = newExtraMaskField.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
		if (!cleaned) return;
		if (builtinMaskFields.includes(cleaned)) {
			toast.info(`'${cleaned}' 필드는 코어 기본 마스킹으로 이미 영구 보호되고 있습니다.`);
			newExtraMaskField = '';
			return;
		}
		if (!draft.audit_extra_mask_fields.includes(cleaned)) {
			draft.audit_extra_mask_fields = [...draft.audit_extra_mask_fields, cleaned];
		}
		newExtraMaskField = '';
	}

	function removeExtraMaskField(field: string) {
		draft.audit_extra_mask_fields = draft.audit_extra_mask_fields.filter((f) => f !== field);
	}

	async function handleSave() {
		if (!canWrite) return;
		isSaving = true;
		try {
			const res = await adminUpdateObservabilitySettings<{
				settings: ObservabilitySettings;
				message?: string;
			}>(draft);
			const normalized = normalizeObservabilitySettings(res?.settings ?? draft);
			onSaved(normalized);
			toast.success(res?.message || '통합 관제 정책 설정이 저장되었습니다.');
		} catch (err) {
			toast.error(formatApiError(err, '관제 정책 설정 저장에 실패했습니다.'));
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
				<span>통합 관제 · 자율 감시(Watchdog) · 감사 보존 정책 제어</span>
			</div>
			<p class="text-xs text-slate-600 leading-relaxed">
				저장 즉시 Watchdog 경보 엔진, 야간 데이터 보존 GC, Diff 개인정보 마스킹 및 로그 내보내기 보안 제한에 실시간 반영됩니다.
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
					<span>{isSaving ? '저장 중...' : '정책 설정 저장'}</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- 섹션 1: 자율 감시(Watchdog) & 보안 경보 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
			<div>
				<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
					<Icon icon="solar:shield-warning-bold-duotone" class="text-lg text-rose-600" />
					<span>1. 자율 감시(Watchdog) · 보안 경보 · 쿨다운 정책</span>
				</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					비인가 403 접근 시도, 현장 지시사항 미확인 지연 감시 및 동일 경보 중복 억제 쿨다운을 설정합니다.
				</p>
			</div>

			<label class="inline-flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition {draft.watchdog_enabled ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-300 bg-amber-50'}">
				<input
					type="checkbox"
					bind:checked={draft.watchdog_enabled}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
				/>
				<div>
					<div class="text-xs font-black {draft.watchdog_enabled ? 'text-emerald-800' : 'text-amber-800'}">
						{draft.watchdog_enabled ? 'Watchdog 감시 엔진 가동 중' : 'Watchdog 감시 일시 중지'}
					</div>
					<div class="text-[10px] text-slate-500">전체 자율 이상징후 경보 마스터 스위치</div>
				</div>
			</label>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label for="obsCooldown" class="block text-xs font-black text-slate-700 mb-1">
					경보 중복 방지 쿨다운 (1~120분)
				</label>
				<input
					id="obsCooldown"
					type="number"
					min="1"
					max="120"
					disabled={!canWrite}
					bind:value={draft.watchdog_cooldown_minutes}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">동일 유형 경보의 연속 발송 억제 간격</p>
			</div>

			<div>
				<label for="obsDelayMin" class="block text-xs font-black text-slate-700 mb-1">
					지시 미확인 지연 기준 (5~240분)
				</label>
				<input
					id="obsDelayMin"
					type="number"
					min="5"
					max="240"
					disabled={!canWrite}
					bind:value={draft.watchdog_instruction_delay_minutes}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">발행 후 경과 시 지연으로 판정할 시간</p>
			</div>

			<div>
				<label for="obsDelayCnt" class="block text-xs font-black text-slate-700 mb-1">
					지연 경보 최소 누적 건수 (1~50건)
				</label>
				<input
					id="obsDelayCnt"
					type="number"
					min="1"
					max="50"
					disabled={!canWrite}
					bind:value={draft.watchdog_instruction_min_count}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">미확인 지시가 이 건수 이상일 때 경보</p>
			</div>

			<div class="pt-4">
				<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
					<input
						type="checkbox"
						bind:checked={draft.watchdog_security_alert}
						disabled={!canWrite}
						class="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
					/>
					<div>
						<div class="text-xs font-black text-slate-800">403 보안 침해 즉시 경보</div>
						<div class="text-[10px] text-slate-500">비인가 접근 감지 시 관리자 알림</div>
					</div>
				</label>
			</div>
		</div>

		<!-- 보안 경보 제외 정상 행위(Action) 화이트리스트 -->
		<div class="pt-2 space-y-2.5">
			<span class="block text-xs font-black text-slate-700">
				보안 침해 경보에서 제외할 정상 행위 코드 (Ignore Actions)
			</span>
			<div class="flex flex-wrap gap-1.5">
				{#each draft.security_alert_ignore_actions as act (act)}
					<span class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700">
						{act}
						{#if canWrite}
							<button
								type="button"
								onclick={() => removeIgnoreAction(act)}
								class="text-slate-400 hover:text-rose-600"
								aria-label="{act} 제거"
							>
								<Icon icon="ph:x-bold" class="text-[10px]" />
							</button>
						{/if}
					</span>
				{/each}
			</div>
			{#if canWrite}
				<div class="flex items-center gap-2 max-w-md">
					<input
						type="text"
						bind:value={newIgnoreAction}
						onkeydown={(e) => e.key === 'Enter' && addIgnoreAction()}
						placeholder="예: AUDIT_EXPORT_REPORT"
						class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-800"
					/>
					<button
						type="button"
						onclick={addIgnoreAction}
						class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
					>
						추가
					</button>
				</div>
			{/if}
		</div>
	</section>

	<!-- 섹션 2: 감사로그 & 세션 이력 보존(Retention GC) 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:database-bold-duotone" class="text-lg text-blue-600" />
				<span>2. 감사로그 · 세션 이력 보존 기간 (Data Retention GC 연동)</span>
			</h3>
			<p class="mt-0.5 text-xs text-slate-500">
				<code>retention_audit_log_days</code> 및 <code>retention_session_history_days</code> 전역 설정과 양방향 자동 동기화됩니다.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="obsAuditDays" class="block text-xs font-black text-slate-700 mb-1">
					전사 감사로그 보존 기간 (7~3650일)
				</label>
				<input
					id="obsAuditDays"
					type="number"
					min="7"
					max="3650"
					disabled={!canWrite}
					bind:value={draft.audit_log_retention_days}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">보존 기간 경과 로그를 야간 GC에서 자동 영구 정리 (기본: 180일)</p>
			</div>

			<div>
				<label for="obsSessDays" class="block text-xs font-black text-slate-700 mb-1">
					만료·추방 세션 접속 이력 보존 기간 (7~365일)
				</label>
				<input
					id="obsSessDays"
					type="number"
					min="7"
					max="365"
					disabled={!canWrite}
					bind:value={draft.session_history_retention_days}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[11px] text-slate-400">종료된 UserSession 이력을 보존할 일수 (기본: 60일)</p>
			</div>
		</div>
	</section>

	<!-- 섹션 3: 감사로그 민감정보 마스킹 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
			<div>
				<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
					<Icon icon="solar:lock-password-bold-duotone" class="text-lg text-indigo-600" />
					<span>3. 감사로그 Diff-Patch 개인정보 자동 마스킹 정책</span>
				</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					데이터 변경 Diff 기록 시 민감 필드 값을 <code>********</code>로 치환하여 개인정보 유출을 차단합니다.
				</p>
			</div>

			<label class="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
				<input
					type="checkbox"
					bind:checked={draft.audit_mask_sensitive_fields}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-indigo-600"
				/>
				<span class="text-xs font-black text-slate-800">민감 필드 자동 마스킹 활성화</span>
			</label>
		</div>

		<div class="space-y-3">
			<div>
				<span class="block text-[11px] font-bold text-slate-500 mb-1.5">코어 기본 보호 필드 (고정):</span>
				<div class="flex flex-wrap gap-1.5">
					{#each builtinMaskFields as field (field)}
						<span class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-mono text-[11px] font-bold text-indigo-700">
							🔒 {field}
						</span>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				<span class="block text-[11px] font-bold text-slate-500">
					추가 사용자 정의 마스킹 필드 키워드 ({draft.audit_extra_mask_fields.length}개):
				</span>
				{#if draft.audit_extra_mask_fields.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each draft.audit_extra_mask_fields as field (field)}
							<span class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-800">
								{field}
								{#if canWrite}
									<button
										type="button"
										onclick={() => removeExtraMaskField(field)}
										class="text-amber-500 hover:text-rose-600"
										aria-label="{field} 제거"
									>
										<Icon icon="ph:x-bold" class="text-[10px]" />
									</button>
								{/if}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-[11px] text-slate-400">추가 등록된 마스킹 필드가 없습니다. (예: phone, mobile, bank_account)</p>
				{/if}

				{#if canWrite}
					<div class="flex items-center gap-2 max-w-md">
						<input
							type="text"
							bind:value={newExtraMaskField}
							onkeydown={(e) => e.key === 'Enter' && addExtraMaskField()}
							placeholder="추가 마스킹 필드명 (영문 소문자/언더바)"
							class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-800"
						/>
						<button
							type="button"
							onclick={addExtraMaskField}
							class="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
						>
							추가
						</button>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- 섹션 4: CSV 내보내기 & 시스템 콘솔 로그 다운로드 보안 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:file-download-bold-duotone" class="text-lg text-emerald-600" />
				<span>4. 감사로그 CSV 내보내기 · 원시 콘솔 로그 다운로드 제한</span>
			</h3>
			<p class="mt-0.5 text-xs text-slate-500">
				대용량 파일 유출 및 메모리 과부하를 방지하기 위해 내보내기 허용 여부와 최대 추출 용량을 통제합니다.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
			<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 mt-4">
				<input
					type="checkbox"
					bind:checked={draft.allow_csv_export}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-emerald-600"
				/>
				<div>
					<div class="text-xs font-black text-slate-800">CSV 내보내기 허용</div>
					<div class="text-[10px] text-slate-500">해제 시 API 403 차단 및 버튼 숨김</div>
				</div>
			</label>

			<div>
				<label for="obsCsvMax" class="block text-xs font-black text-slate-700 mb-1">
					CSV 1회 최대 건수 (100~50,000건)
				</label>
				<input
					id="obsCsvMax"
					type="number"
					min="100"
					max="50000"
					disabled={!canWrite}
					bind:value={draft.csv_export_max_rows}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 mt-4">
				<input
					type="checkbox"
					bind:checked={draft.allow_system_log_download}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-emerald-600"
				/>
				<div>
					<div class="text-xs font-black text-slate-800">원시 system.log 다운로드 허용</div>
					<div class="text-[10px] text-slate-500">해제 시 콘솔 로그 다운로드 차단</div>
				</div>
			</label>

			<div>
				<label for="obsLogMaxMb" class="block text-xs font-black text-slate-700 mb-1">
					system.log 최대 용량 (1~100MB)
				</label>
				<input
					id="obsLogMaxMb"
					type="number"
					min="1"
					max="100"
					disabled={!canWrite}
					bind:value={draft.system_log_max_download_mb}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-[10px] text-slate-400">초과 시 최신 Tail 구간만 안전 절삭</p>
			</div>
		</div>
	</section>

	<!-- 섹션 5: 관제 대시보드 화면(UI) 옵션 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:widget-5-bold-duotone" class="text-lg text-amber-600" />
				<span>5. 관제 대시보드 UI · 페이징 · 자동 갱신 기본값</span>
			</h3>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
			<div>
				<label for="obsUiSec" class="block text-xs font-black text-slate-700 mb-1">
					자동 갱신 주기 (3~120초)
				</label>
				<input
					id="obsUiSec"
					type="number"
					min="3"
					max="120"
					disabled={!canWrite}
					bind:value={draft.ui_auto_refresh_sec}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="obsUiPage" class="block text-xs font-black text-slate-700 mb-1">
					감사로그 페이지당 건수 (10~100건)
				</label>
				<input
					id="obsUiPage"
					type="number"
					min="10"
					max="100"
					disabled={!canWrite}
					bind:value={draft.ui_log_page_size}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="obsUiSessLim" class="block text-xs font-black text-slate-700 mb-1">
					과거 세션 이력 조회 한도 (20~500건)
				</label>
				<input
					id="obsUiSessLim"
					type="number"
					min="20"
					max="500"
					disabled={!canWrite}
					bind:value={draft.ui_session_history_limit}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<div class="pt-5">
				<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
					<input
						type="checkbox"
						bind:checked={draft.ui_auto_refresh_default}
						disabled={!canWrite}
						class="h-4 w-4 rounded border-slate-300 text-blue-600"
					/>
					<span class="text-xs font-black text-slate-800">진입 시 자동 갱신 기본 켜기</span>
				</label>
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
				<span>{isSaving ? '저장 중...' : '정책 설정 저장'}</span>
			</button>
		</div>
	{/if}
</div>
