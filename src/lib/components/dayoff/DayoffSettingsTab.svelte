<script lang="ts">
	/**
	 * ============================================================================
	 * [결근계 관리자 — 설정 탭 (DayoffSettingsTab.svelte)]
	 * ============================================================================
	 * 💡 항상 맨 오른쪽 마지막 탭으로 배치되어 결근계 앱의 비즈니스 로직을 통제합니다:
	 * 1. 선착순(운전직) vs 승인제(사무직) 분류 및 시행일 예약 정책 (Append-Only)
	 * 2. 신청 제한 규칙 (월 횟수, 1회 일수, 사전 신청 기간) & 캘린더 표시 정책
	 * 3. 특정일 예외 정원 관리 (기존 DayoffDateOverrideModal 인라인 통합)
	 */
	import * as dayoffApi from '$lib/api/dayoff';
	import type { DayoffPolicy } from '$lib/api/dayoff';
	import {
		extractDisplaySettings,
		type DayoffDisplaySettings
	} from '$lib/services/dayoffAdminService';
	import { timestampToDateString } from '$lib/utils';
	import { getDatesInRange } from '$lib/utils/dayoff';
	import { toast } from '$lib/runes/toast.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		todayStr: string;
		todayPolicy: DayoffPolicy;
		reservedPolicy: DayoffPolicy | null;
		dateOverrides: Record<string, number>;
		availableGroups: string[];
		onSaved: () => Promise<void>;
		onApplyOverride: (dates: string[], quota: number | null) => Promise<void>;
	}

	let {
		todayStr,
		todayPolicy,
		reservedPolicy,
		dateOverrides,
		availableGroups,
		onSaved,
		onApplyOverride
	}: Props = $props();

	let viewingReserved = $state(false);
	let savingPolicy = $state(false);
	let savingOverride = $state(false);
	let newGroupInput = $state('');
	let localGroups = $state<string[]>([]);

	let draft = $state({
		effective_date: '',
		classify_mode: 'BOTH',
		fcfs_groups: [] as string[],
		fcfs_ranks: [1] as number[],
		daily_quota: 3,
		max_monthly_count: 0,
		max_days_per_request: 0,
		min_advance_days: 0,
		max_advance_days: 0
	});
	let displaySettings = $state<DayoffDisplaySettings>({ show_quota_bg_alarm: true });

	// 특정일 예외 정원 상태
	let ovStartDate = $state('');
	let ovEndDate = $state('');
	let ovQuotaInput = $state(3);

	const hasReserved = $derived(reservedPolicy !== null);
	const canSave = $derived(!hasReserved || viewingReserved);
	const isLocked = $derived(hasReserved && !viewingReserved);
	const sortedOverrides = $derived(
		Object.entries(dateOverrides || {}).sort(([a], [b]) => a.localeCompare(b))
	);

	function loadDraftFrom(src: DayoffPolicy | null | undefined, effDate: string) {
		const s = src || ({} as Partial<DayoffPolicy>);
		draft = {
			effective_date: effDate || todayStr,
			classify_mode: s.classify_mode || 'BOTH',
			fcfs_groups: Array.isArray(s.fcfs_groups) ? [...s.fcfs_groups] : [],
			fcfs_ranks: Array.isArray(s.fcfs_ranks) ? [...s.fcfs_ranks] : [],
			daily_quota: Number(s.daily_quota ?? 3),
			max_monthly_count: Number(s.max_monthly_count ?? 0),
			max_days_per_request: Number(s.max_days_per_request ?? 0),
			min_advance_days: Number(s.min_advance_days ?? 0),
			max_advance_days: Number(s.max_advance_days ?? 0)
		};
		displaySettings = extractDisplaySettings(src);
		localGroups = Array.isArray(availableGroups) ? [...availableGroups] : [];
		newGroupInput = '';
	}

	$effect(() => {
		if (!viewingReserved) {
			loadDraftFrom(todayPolicy, todayStr);
		}
		if (!ovStartDate) {
			ovStartDate = todayStr;
			ovEndDate = todayStr;
			ovQuotaInput = Number(todayPolicy?.daily_quota ?? 3);
		}
	});

	function shiftDateStr(baseStr: string, offsetDays: number): string {
		const [y, m, d] = String(baseStr || todayStr)
			.slice(0, 10)
			.split('-')
			.map(Number);
		const dt = new Date(y, (m || 1) - 1, (d || 1) + Number(offsetDays || 0));
		return timestampToDateString(dt.getTime());
	}

	function toggleFcfsGroup(gCode: string) {
		if (draft.fcfs_groups.includes(gCode)) {
			draft.fcfs_groups = draft.fcfs_groups.filter((g) => g !== gCode);
		} else {
			draft.fcfs_groups = [...draft.fcfs_groups, gCode];
		}
	}

	function addCustomGroup() {
		const trimmed = newGroupInput.trim();
		if (!trimmed) return;
		if (!localGroups.includes(trimmed)) localGroups = [...localGroups, trimmed];
		if (!draft.fcfs_groups.includes(trimmed)) draft.fcfs_groups = [...draft.fcfs_groups, trimmed];
		newGroupInput = '';
	}

	function toggleFcfsRank(rank: number) {
		if (draft.fcfs_ranks.includes(rank)) {
			draft.fcfs_ranks = draft.fcfs_ranks.filter((r) => r !== rank);
		} else {
			draft.fcfs_ranks = [...draft.fcfs_ranks, rank].sort((a, b) => a - b);
		}
	}

	function handleViewReserved() {
		if (!reservedPolicy) return;
		viewingReserved = true;
		loadDraftFrom(reservedPolicy, reservedPolicy.effective_date);
	}

	function handleViewToday() {
		viewingReserved = false;
		loadDraftFrom(todayPolicy, todayStr);
	}

	async function handleCancelReserved() {
		if (!reservedPolicy?.id) return;
		if (
			!confirm(
				`${reservedPolicy.effective_date}부터 적용 예정인 예약 정책(정원 ${reservedPolicy.daily_quota}명)을 취소하시겠습니까?`
			)
		) {
			return;
		}
		savingPolicy = true;
		try {
			await dayoffApi.adminDeleteDayoffPolicyRow(reservedPolicy.id);
			viewingReserved = false;
			toast.success('예약된 정책이 취소되었습니다.');
			await onSaved();
		} catch (e: any) {
			toast.error(`예약 취소 실패: ${e.message}`);
		} finally {
			savingPolicy = false;
		}
	}

	async function handleSavePolicy() {
		if (!canSave || savingPolicy) return;
		savingPolicy = true;
		try {
			const mergedEtc = {
				...(todayPolicy?.etc || {}),
				show_quota_bg_alarm: displaySettings.show_quota_bg_alarm
			};
			await dayoffApi.adminUpdateDayoffPolicy({
				effective_date: draft.effective_date || todayStr,
				classify_mode: draft.classify_mode,
				fcfs_groups: draft.fcfs_groups,
				fcfs_ranks: draft.fcfs_ranks,
				daily_quota: Number(draft.daily_quota),
				max_monthly_count: Number(draft.max_monthly_count),
				max_days_per_request: Number(draft.max_days_per_request),
				min_advance_days: Number(draft.min_advance_days),
				max_advance_days: Number(draft.max_advance_days),
				etc: mergedEtc
			});
			toast.success(
				draft.effective_date > todayStr
					? `${draft.effective_date}부터 적용되는 정책이 예약되었습니다.`
					: '근태·휴무 정책이 저장되었습니다.'
			);
			await onSaved();
		} catch (e: any) {
			toast.error(`정책 저장 실패: ${e.message}`);
		} finally {
			savingPolicy = false;
		}
	}

	async function handleApplyOverrideRange(dates: string[], quota: number | null) {
		if (!dates.length || savingOverride) return;
		savingOverride = true;
		try {
			await onApplyOverride(dates, quota);
		} finally {
			savingOverride = false;
		}
	}
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
	<!-- 좌측 7열: 기본 정책 · 직군 분류 · 신청 제한 · 캘린더 표시 정책 -->
	<div class="space-y-5 lg:col-span-7">
		<div class="space-y-5 rounded-[2rem] border-2 border-slate-200 bg-white p-6 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
				<div>
					<span
						class="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-emerald-400 uppercase"
					>
						Dayoff Business Policy
					</span>
					<h3 class="mt-1.5 text-lg font-black text-slate-900">
						직군 분류 · 선착순 정원 · 신청 규칙
					</h3>
					<p class="text-xs font-medium text-slate-500">
						시행일 기준 Append-Only 원장으로 저장되며, 예약 정책이 있을 때는 예약 수정/취소만
						가능합니다.
					</p>
				</div>

				{#if hasReserved}
					<div class="flex flex-wrap items-center gap-2">
						{#if viewingReserved}
							<button
								type="button"
								onclick={handleViewToday}
								class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
							>
								현재 적용 정책 보기
							</button>
						{:else}
							<button
								type="button"
								onclick={handleViewReserved}
								class="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700"
							>
								예약 정책 보기 ({reservedPolicy?.effective_date})
							</button>
						{/if}
						<button
							type="button"
							disabled={savingPolicy}
							onclick={handleCancelReserved}
							class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
						>
							예약 취소
						</button>
					</div>
				{/if}
			</div>

			{#if isLocked}
				<div
					class="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800"
				>
					📅 {reservedPolicy?.effective_date} 시행 예정인 예약 정책(일 정원 {reservedPolicy?.daily_quota}명)이
					있어 현재 정책은 읽기 전용입니다. 수정하려면 <b>예약 정책 보기</b>를 눌러 주세요.
				</div>
			{/if}

			<!-- 1. 시행일 & 일일 기본 정원 -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="set-eff-date" class="mb-1 block text-xs font-black text-slate-700"
						>적용 시행일</label
					>
					<div class="flex items-center gap-1.5">
						<input
							id="set-eff-date"
							type="date"
							disabled={isLocked}
							bind:value={draft.effective_date}
							min={todayStr}
							class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 disabled:bg-slate-100"
						/>
						<button
							type="button"
							disabled={isLocked}
							onclick={() => (draft.effective_date = shiftDateStr(todayStr, 1))}
							class="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"
						>
							내일
						</button>
					</div>
				</div>
				<div>
					<label for="set-daily-quota" class="mb-1 block text-xs font-black text-slate-700"
						>운전직 선착순 일일 정원 (명/일)</label
					>
					<input
						id="set-daily-quota"
						type="number"
						min="0"
						max="100"
						disabled={isLocked}
						bind:value={draft.daily_quota}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 disabled:bg-slate-100"
					/>
				</div>
			</div>

			<!-- 2. 직군 판별 기준 -->
			<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="text-xs font-black text-slate-800">선착순(FCFS) 대상 직군 판별 방식</span>
					<div class="flex gap-1.5">
						{#each [{ id: 'BOTH', label: '그룹 + 직급 모두' }, { id: 'GROUP', label: '그룹 기준' }, { id: 'RANK', label: '직급(Lv) 기준' }] as cm (cm.id)}
							<button
								type="button"
								disabled={isLocked}
								onclick={() => (draft.classify_mode = cm.id)}
								class="rounded-lg px-2.5 py-1 text-[11px] font-black transition {draft.classify_mode ===
								cm.id
									? 'bg-slate-900 text-white'
									: 'border border-slate-300 bg-white text-slate-600'} disabled:opacity-50"
							>
								{cm.label}
							</button>
						{/each}
					</div>
				</div>

				{#if draft.classify_mode !== 'RANK'}
					<div class="space-y-2">
						<span class="block text-[11px] font-bold text-slate-600">선착순 적용 그룹</span>
						<div class="flex flex-wrap gap-1.5">
							{#each localGroups as grp (grp)}
								<button
									type="button"
									disabled={isLocked}
									onclick={() => toggleFcfsGroup(grp)}
									class="rounded-lg border px-2.5 py-1 text-xs font-bold {draft.fcfs_groups.includes(
										grp
									)
										? 'border-emerald-600 bg-emerald-100 text-emerald-800'
										: 'border-slate-300 bg-white text-slate-600'} disabled:opacity-50"
								>
									{grp}
								</button>
							{/each}
						</div>
						<div class="flex items-center gap-2 pt-1">
							<input
								type="text"
								disabled={isLocked}
								bind:value={newGroupInput}
								placeholder="새 그룹명 직접 추가"
								class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold disabled:bg-slate-100"
							/>
							<button
								type="button"
								disabled={isLocked}
								onclick={addCustomGroup}
								class="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
							>
								추가
							</button>
						</div>
					</div>
				{/if}

				{#if draft.classify_mode !== 'GROUP'}
					<div class="space-y-1.5">
						<span class="block text-[11px] font-bold text-slate-600">선착순 적용 직급(Lv)</span>
						<div class="flex flex-wrap gap-1.5">
							{#each [0, 1, 2, 3, 4, 5] as r (r)}
								<button
									type="button"
									disabled={isLocked}
									onclick={() => toggleFcfsRank(r)}
									class="rounded-lg border px-2.5 py-1 text-xs font-bold {draft.fcfs_ranks.includes(
										r
									)
										? 'border-emerald-600 bg-emerald-100 text-emerald-800'
										: 'border-slate-300 bg-white text-slate-600'} disabled:opacity-50"
								>
									Lv.{r}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- 3. 신청 제한 규칙 -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div>
					<label for="set-max-month" class="mb-1 block text-[11px] font-black text-slate-600"
						>월 최대 횟수 (0=무제한)</label
					>
					<input
						id="set-max-month"
						type="number"
						min="0"
						disabled={isLocked}
						bind:value={draft.max_monthly_count}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-black disabled:bg-slate-100"
					/>
				</div>
				<div>
					<label for="set-max-days" class="mb-1 block text-[11px] font-black text-slate-600"
						>1회 최대 일수 (0=무제한)</label
					>
					<input
						id="set-max-days"
						type="number"
						min="0"
						disabled={isLocked}
						bind:value={draft.max_days_per_request}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-black disabled:bg-slate-100"
					/>
				</div>
				<div>
					<label for="set-min-adv" class="mb-1 block text-[11px] font-black text-slate-600"
						>최소 사전일 (D+X)</label
					>
					<input
						id="set-min-adv"
						type="number"
						min="0"
						disabled={isLocked}
						bind:value={draft.min_advance_days}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-black disabled:bg-slate-100"
					/>
				</div>
				<div>
					<label for="set-max-adv" class="mb-1 block text-[11px] font-black text-slate-600"
						>최대 사전일 (0=무제한)</label
					>
					<input
						id="set-max-adv"
						type="number"
						min="0"
						disabled={isLocked}
						bind:value={draft.max_advance_days}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-black disabled:bg-slate-100"
					/>
				</div>
			</div>

			<!-- 4. 캘린더 표시 정책 -->
			<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
				<label
					class="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700"
				>
					<input
						type="checkbox"
						disabled={isLocked}
						bind:checked={displaySettings.show_quota_bg_alarm}
						class="rounded text-blue-600"
					/>
					<span>월간 캘린더에서 예외 정원·마감일 셀 배경 강조 알람 표시</span>
				</label>
			</div>

			<div class="flex justify-end border-t border-slate-100 pt-4">
				<button
					type="button"
					disabled={!canSave || savingPolicy}
					onclick={handleSavePolicy}
					class="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-blue-600 disabled:opacity-40"
				>
					<Icon icon="solar:diskette-bold" class="text-sm" />
					<span
						>{savingPolicy
							? '저장 중...'
							: viewingReserved
								? '예약 정책 수정 저장'
								: '정책 저장'}</span
					>
				</button>
			</div>
		</div>
	</div>

	<!-- 우측 5열: 특정일 예외 정원 관리 -->
	<div class="space-y-5 lg:col-span-5">
		<div class="space-y-4 rounded-[2rem] border-2 border-amber-200 bg-white p-6 shadow-sm">
			<div class="border-b border-slate-100 pb-3">
				<span
					class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800 uppercase"
				>
					Date Quota Override
				</span>
				<h3 class="mt-1.5 text-lg font-black text-slate-900">특정일 예외 정원 관리</h3>
				<p class="text-xs font-medium text-slate-500">
					기본 정원({todayPolicy.daily_quota}명)보다 우선 적용할 날짜(기간) 정원을 지정합니다. (0명
					입력 시 신청 차단)
				</p>
			</div>

			<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="tab-ov-start" class="mb-1 block text-[11px] font-black text-slate-600"
							>시작일</label
						>
						<input
							id="tab-ov-start"
							type="date"
							bind:value={ovStartDate}
							onchange={() => {
								if (ovEndDate < ovStartDate) ovEndDate = ovStartDate;
							}}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
						/>
					</div>
					<div>
						<label for="tab-ov-end" class="mb-1 block text-[11px] font-black text-slate-600"
							>종료일</label
						>
						<input
							id="tab-ov-end"
							type="date"
							bind:value={ovEndDate}
							min={ovStartDate}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between gap-3">
					<label for="tab-ov-quota" class="text-xs font-black text-slate-700"
						>지정 정원 (명 / 일):</label
					>
					<input
						id="tab-ov-quota"
						type="number"
						min="0"
						max="100"
						bind:value={ovQuotaInput}
						class="w-24 rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-center text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<button
					type="button"
					disabled={savingOverride}
					onclick={() =>
						handleApplyOverrideRange(getDatesInRange(ovStartDate, ovEndDate), Number(ovQuotaInput))}
					class="btn w-full rounded-xl border-none bg-blue-600 font-black text-white hover:bg-blue-700"
				>
					{savingOverride ? '적용 중...' : '선택한 날짜 정원 적용'}
				</button>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs font-black text-slate-700"
						>등록된 예외 정원 ({sortedOverrides.length}일)</span
					>
				</div>
				<div class="max-h-72 space-y-1.5 overflow-y-auto pr-1">
					{#each sortedOverrides as [dStr, q] (dStr)}
						<div
							class="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2 text-xs"
						>
							<div class="flex items-center gap-2">
								<span class="font-mono font-black text-slate-900">{dStr}</span>
								<span
									class="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800"
								>
									정원 {q}명
								</span>
							</div>
							<button
								type="button"
								disabled={savingOverride}
								onclick={() => handleApplyOverrideRange([dStr], null)}
								class="text-[11px] font-black text-rose-600 underline hover:text-rose-800"
							>
								기본값 복원
							</button>
						</div>
					{:else}
						<div
							class="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs font-bold text-slate-400"
						>
							등록된 특정일 예외 정원이 없습니다.
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
