<script>
	/**
	 * @file DayoffPolicyModal.svelte
	 * @description 결근/휴무 기본 정책 설정 모달 (Append-Only · 예약 최대 1건 · 3버튼 구조)
	 */
	import * as api from '$lib/api/admin';
	import { timestampToDateString } from '$lib/utils';
	import { toast } from '$lib/runes/toast.svelte';
	import Icon from '@iconify/svelte';

	let {
		open = $bindable(false),
		todayStr = '',
		todayPolicy = null,
		reservedPolicy = null,
		availableGroups = ['운전직', '운수팀', '사무직', '관리팀'],
		onSaved = async () => {}
	} = $props();

	/** 모달 내부 편집 전용 상태 (취소 시 외부 화면 값에 영향 없음) */
	let draft = $state({
		effective_date: '',
		classify_mode: 'BOTH',
		fcfs_groups: /** @type {string[]} */ ([]),
		fcfs_ranks: /** @type {number[]} */ ([]),
		daily_quota: 3,
		max_monthly_count: 0,
		max_days_per_request: 0,
		min_advance_days: 0,
		max_advance_days: 0
	});
	let etcJsonText = $state('{}');
	let localGroups = $state(/** @type {string[]} */ ([]));
	let newGroupInput = $state('');
	let viewingReserved = $state(false);
	let saving = $state(false);

	let hasReserved = $derived(reservedPolicy !== null);
	let canSave = $derived(!hasReserved || viewingReserved);
	let isLocked = $derived(hasReserved && !viewingReserved);

	/** @param {any} src @param {string} effDate */
	function loadDraftFrom(src, effDate) {
		const s = src || {};
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
		etcJsonText = JSON.stringify(s.etc || {}, null, 2);
		localGroups = Array.isArray(availableGroups) ? [...availableGroups] : [];
		newGroupInput = '';
	}

	// 모달이 열릴 때마다 초기 상태(오늘 적용 정책 표시, viewingReserved=false)로 세팅
	$effect(() => {
		if (open) {
			viewingReserved = false;
			loadDraftFrom(todayPolicy, todayStr);
		}
	});

	/** @param {string} baseStr @param {number} offsetDays */
	function shiftDateStr(baseStr, offsetDays) {
		const [y, m, d] = String(baseStr || todayStr).slice(0, 10).split('-').map(Number);
		const dt = new Date(y, (m || 1) - 1, (d || 1) + Number(offsetDays || 0));
		return timestampToDateString(dt.getTime());
	}

	/** @param {string} gCode */
	function toggleFcfsGroup(gCode) {
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

	/** @param {number} rank */
	function toggleFcfsRank(rank) {
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

	async function handleCancelReserved() {
		if (!reservedPolicy) return;
		if (
			!confirm(
				`${reservedPolicy.effective_date}부터 적용 예정인 예약 정책(정원 ${reservedPolicy.daily_quota}명)을 취소하시겠습니까?`
			)
		) {
			return;
		}
		saving = true;
		try {
			await api.adminDeleteDayoffPolicyRow(reservedPolicy.id);
			viewingReserved = false;
			toast.success('예약된 정책이 취소되었습니다.');
			await onSaved();
			open = false;
		} catch (error) {
			toast.error(`예약 취소 실패: ${/** @type {Error} */ (error).message}`);
		} finally {
			saving = false;
		}
	}

	async function handleSave() {
		if (!canSave) return;

		let parsedEtc = {};
		try {
			const rawTxt = (etcJsonText || '{}').trim();
			const obj = rawTxt ? JSON.parse(rawTxt) : {};
			if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
				toast.error('확장 설정(etc)은 JSON 객체({ ... }) 형식이어야 합니다.');
				return;
			}
			parsedEtc = obj;
		} catch {
			toast.error('확장 설정(etc)의 JSON 문법이 올바르지 않습니다.');
			return;
		}

		if (!draft.effective_date) {
			toast.error('적용 날짜를 선택해 주세요.');
			return;
		}

		const minAdv = Math.max(0, Number(draft.min_advance_days ?? 0));
		const maxAdv = Math.max(0, Number(draft.max_advance_days ?? 0));
		if (maxAdv > 0 && maxAdv < minAdv) {
			toast.error(`최대 신청 가능일(D+${maxAdv})은 최소 신청 가능일(D+${minAdv})보다 작을 수 없습니다.`);
			return;
		}

		const targetDate = draft.effective_date <= todayStr ? todayStr : draft.effective_date;
		const payload = {
			...draft,
			effective_date: targetDate,
			daily_quota: Math.max(0, Number(draft.daily_quota ?? 0)),
			max_monthly_count: Math.max(0, Number(draft.max_monthly_count ?? 0)),
			max_days_per_request: Math.max(0, Number(draft.max_days_per_request ?? 0)),
			min_advance_days: minAdv,
			max_advance_days: maxAdv,
			etc: parsedEtc
		};

		saving = true;
		try {
			// 예약 수정 상태에서 적용 날짜를 오늘로 앞당겨 저장하는 경우 기존 예약 선삭제
			if (viewingReserved && reservedPolicy && targetDate <= todayStr) {
				await api.adminDeleteDayoffPolicyRow(reservedPolicy.id);
			}
			const res = await api.adminUpdateDayoffPolicy(payload);
			const savedEff = res?.policy?.effective_date || targetDate;
			toast.success(
				savedEff > todayStr
					? `${savedEff}부터 적용되는 예약 정책이 등록되었습니다.`
					: `${savedEff} 기준 새 정책이 등록·적용되었습니다.`
			);
			await onSaved();
			open = false;
		} catch (error) {
			toast.error(`정책 저장 실패: ${/** @type {Error} */ (error).message}`);
		} finally {
			saving = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="dayoff-policy-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') open = false;
		}}
	>
		<div
			class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border-2 border-slate-900 bg-white shadow-2xl"
		>
			<!-- 헤더 -->
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-5 text-white">
				<div>
					<span class="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-emerald-300">
						결근·휴무 운영 정책
					</span>
					<h3 id="dayoff-policy-modal-title" class="mt-1 text-lg font-black text-white md:text-xl">
						자동승인(선착순) · 허가제(승인제) 정책 설정
					</h3>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-rose-500 hover:text-white"
					aria-label="닫기"
				>
					<Icon icon="solar:close-circle-bold" class="text-xl" />
				</button>
			</div>

			<!-- 본문 -->
			<div class="flex-1 space-y-5 overflow-y-auto p-6">
				<!-- 적용 날짜 & 상태 배너 -->
				<div
					class="rounded-2xl border-2 {viewingReserved
						? 'border-amber-400 bg-amber-50/50'
						: isLocked
							? 'border-rose-300 bg-rose-50/50'
							: 'border-blue-200 bg-blue-50/40'} p-4"
				>
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<span
								class="text-xs font-black {viewingReserved
									? 'text-amber-900'
									: isLocked
										? 'text-rose-900'
										: 'text-blue-900'}"
							>
								{#if viewingReserved && reservedPolicy}
									📅 예약 정책 확인 · 수정 ({reservedPolicy.effective_date} 적용 예정)
								{:else if isLocked && reservedPolicy}
									🔒 예약된 정책이 있어 현재 설정은 저장할 수 없습니다
								{:else}
									📅 적용 날짜 (오늘: 즉시 등록 / 미래: 예약 등록)
								{/if}
							</span>
							<p class="mt-0.5 text-[11px] font-medium text-slate-600">
								{#if viewingReserved}
									수정 후 저장하면 기존 예약을 대체하여 새 예약 레코드가 등록됩니다.
								{:else if isLocked && reservedPolicy}
									하단 '예약' 버튼을 누르면 {reservedPolicy.effective_date} 예약 내용을 확인·수정하거나 취소할 수 있습니다.
								{:else}
									기존 레코드는 수정하지 않고 새 레코드를 추가합니다.
								{/if}
							</p>
						</div>
						<input
							type="date"
							bind:value={draft.effective_date}
							disabled={isLocked}
							aria-label="정책 적용 날짜"
							class="rounded-xl border-2 border-blue-400 bg-white px-3 py-2 text-xs font-black text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
						/>
					</div>
				</div>

				<!-- 1. 판별 방식 -->
				<div class="space-y-2">
					<span class="block text-xs font-black text-slate-800">1. 운전직(선착순) 대상 판별 방식</span>
					<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
						{#each [
							{ id: 'BOTH', label: '그룹 또는 랭크 (권장)', desc: '지정 그룹 또는 랭크면 선착순' },
							{ id: 'GROUP', label: '소속 그룹 기준', desc: '지정된 그룹 소속 사원만 선착순' },
							{ id: 'RANK', label: '권한 랭크 기준', desc: '지정된 랭크(Lv) 사원만 선착순' }
						] as modeItem (modeItem.id)}
							<button
								type="button"
								disabled={isLocked}
								onclick={() => (draft.classify_mode = modeItem.id)}
								class="flex flex-col items-start rounded-2xl border-2 p-3 text-left transition disabled:opacity-60 {draft.classify_mode === modeItem.id
									? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm'
									: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
							>
								<span class="text-xs font-black">{modeItem.label}</span>
								<span class="mt-1 text-[10px] font-medium text-slate-500">{modeItem.desc}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- 2. 선착순 적용 그룹 -->
				{#if draft.classify_mode === 'BOTH' || draft.classify_mode === 'GROUP'}
					<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
						<div class="flex items-center justify-between">
							<span class="text-xs font-black text-slate-800">2. 선착순(운전직) 대상 그룹 선택</span>
							<span class="text-[11px] font-bold text-emerald-700">
								선택됨: {draft.fcfs_groups.length > 0 ? draft.fcfs_groups.join(', ') : '없음'}
							</span>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each localGroups as gCode (gCode)}
								{@const active = draft.fcfs_groups.includes(gCode)}
								<button
									type="button"
									disabled={isLocked}
									onclick={() => toggleFcfsGroup(gCode)}
									class="inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition disabled:opacity-60 {active
										? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
										: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
								>
									<Icon icon={active ? 'solar:check-circle-bold' : 'solar:add-circle-linear'} />
									<span>{gCode}</span>
								</button>
							{/each}
						</div>
						<div class="flex gap-2 pt-1">
							<input
								type="text"
								disabled={isLocked}
								placeholder="직접 그룹명 추가 (예: 승무1팀)"
								bind:value={newGroupInput}
								onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomGroup())}
								class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
							/>
							<button
								type="button"
								disabled={isLocked}
								onclick={addCustomGroup}
								class="btn btn-sm rounded-xl border-none bg-slate-800 font-black text-white hover:bg-slate-900"
							>
								그룹 추가
							</button>
						</div>
					</div>
				{/if}

				<!-- 3. 선착순 적용 권한 랭크 -->
				{#if draft.classify_mode === 'BOTH' || draft.classify_mode === 'RANK'}
					<div class="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
						<div class="flex items-center justify-between">
							<span class="text-xs font-black text-slate-800">3. 선착순(운전직) 대상 권한 랭크(Rank)</span>
							<span class="text-[11px] font-bold text-emerald-700">
								선택됨: {draft.fcfs_ranks.length > 0 ? draft.fcfs_ranks.map((r) => `Lv.${r}`).join(', ') : '없음'}
							</span>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as rk (rk)}
								{@const active = draft.fcfs_ranks.includes(rk)}
								<button
									type="button"
									disabled={isLocked}
									onclick={() => toggleFcfsRank(rk)}
									class="rounded-xl border-2 px-3 py-1.5 text-xs font-black transition disabled:opacity-60 {active
										? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
										: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
								>
									Lv.{rk}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 4. 기본 일일 정원 -->
				<div class="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
					<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
						<div>
							<span class="text-xs font-black text-emerald-900">4. 운전직 기본 일일 선착순 정원 (명 / 일)</span>
							<p class="mt-0.5 text-[11px] font-medium text-emerald-700">
								특정일 예외 정원이 없는 날짜에 기본 적용되는 하루 최대 휴무 인원입니다.
							</p>
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								disabled={isLocked}
								onclick={() => (draft.daily_quota = Math.max(0, Number(draft.daily_quota) - 1))}
								class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
							>
								-
							</button>
							<input
								type="number"
								min="0"
								max="100"
								disabled={isLocked}
								bind:value={draft.daily_quota}
								class="h-10 w-20 rounded-xl border-2 border-emerald-500 bg-white text-center text-lg font-black text-slate-900 focus:outline-none disabled:bg-slate-100"
							/>
							<button
								type="button"
								disabled={isLocked}
								onclick={() => (draft.daily_quota = Number(draft.daily_quota) + 1)}
								class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
							>
								+
							</button>
						</div>
					</div>
				</div>

				<!-- 5. 자동승인(선착순) 전용 사용 및 날짜 제한 -->
				<div class="space-y-3 rounded-2xl border-2 border-emerald-200/80 bg-emerald-50/25 p-4">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span class="text-xs font-black text-emerald-900">
							5. 자동승인(선착순) 전용 사용 · 날짜 제한
						</span>
						<span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
							자동승인 대상자만 적용
						</span>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label for="max-monthly-count" class="block text-xs font-black text-slate-800">
								5-1. 월별 최대 사용 횟수 (0=무제한)
							</label>
							<input
								id="max-monthly-count"
								type="number"
								min="0"
								max="31"
								disabled={isLocked}
								bind:value={draft.max_monthly_count}
								class="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
							/>
						</div>
						<div>
							<label for="max-days-per-req" class="block text-xs font-black text-slate-800">
								5-2. 1회 신청 최대 일수 (0=무제한)
							</label>
							<input
								id="max-days-per-req"
								type="number"
								min="0"
								max="365"
								disabled={isLocked}
								bind:value={draft.max_days_per_request}
								class="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
							/>
						</div>
						<div>
							<label for="min-advance-days" class="block text-xs font-black text-slate-800">
								5-3. 신청 가능 최소일 (D+X일 부터)
							</label>
							<input
								id="min-advance-days"
								type="number"
								min="0"
								max="365"
								disabled={isLocked}
								bind:value={draft.min_advance_days}
								class="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
							/>
						</div>
						<div>
							<label for="max-advance-days" class="block text-xs font-black text-slate-800">
								5-4. 신청 가능 최대일 (D+Y일 까지, 0=무제한)
							</label>
							<input
								id="max-advance-days"
								type="number"
								min="0"
								max="730"
								disabled={isLocked}
								bind:value={draft.max_advance_days}
								class="mt-1.5 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
							/>
						</div>
					</div>
					<div class="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-[11px] font-bold text-violet-800">
						{#if Number(draft.max_advance_days) > 0 && Number(draft.max_advance_days) < Number(draft.min_advance_days)}
							<span class="text-rose-600">
								⚠️ 최대 신청 가능일(D+{draft.max_advance_days})이 최소 신청 가능일(D+{draft.min_advance_days})보다 작습니다.
							</span>
						{:else}
							📅 오늘({todayStr}) 자동승인 신청 기준 허용 범위:
							<span class="font-mono font-black">
								{shiftDateStr(todayStr, Number(draft.min_advance_days || 0))} (D+{Number(draft.min_advance_days || 0)})
								~
								{Number(draft.max_advance_days || 0) > 0
									? `${shiftDateStr(todayStr, Number(draft.max_advance_days))} (D+${Number(draft.max_advance_days)})`
									: '제한 없음'}
							</span>
						{/if}
					</div>
				</div>

				<!-- 허가제(승인제) 운영 안내 -->
				<div class="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900">
					<Icon icon="solar:shield-check-bold-duotone" class="mt-0.5 shrink-0 text-xl text-blue-600" />
					<div>
						<div class="font-black">허가제(승인제) 대상자 운영 방식</div>
						<p class="mt-0.5 text-[11px] font-medium text-blue-800/90">
							자동승인(선착순) 대상에 해당하지 않는 직원은 <b>허가제</b>로 동작하며, 위 4·5번의
							<b>정원 · 날짜(D+X~D+Y) · 횟수 · 일수 제한 없이</b> 자유롭게 신청한 뒤 관리자 승인/반려를 거칩니다.
						</p>
					</div>
				</div>

				<!-- 6. 확장 JSONB -->
				<div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<div class="flex items-center justify-between">
						<label for="policy-etc-json" class="text-xs font-black text-slate-800">
							6. 확장 설정 (etc · JSONB)
						</label>
						<span class="font-mono text-[10px] font-bold text-slate-400">JSON Object</span>
					</div>
					<textarea
						id="policy-etc-json"
						rows="2"
						disabled={isLocked}
						bind:value={etcJsonText}
						placeholder={'{"note": "추가 확장 옵션"}'}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
					></textarea>
				</div>
			</div>

			<!-- 푸터: 예약(또는 예약 취소) / 저장 / 취소 3버튼 -->
			<div class="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
				<div>
					{#if viewingReserved && hasReserved}
						<button
							type="button"
							onclick={handleCancelReserved}
							disabled={saving}
							class="btn rounded-xl border-none bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400"
						>
							예약 취소
						</button>
					{:else}
						<button
							type="button"
							onclick={handleViewReserved}
							disabled={!hasReserved || saving}
							class="btn rounded-xl border-none bg-amber-500 px-5 text-xs font-black text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400"
						>
							예약
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handleSave}
						disabled={!canSave || saving}
						class="btn rounded-xl border-none bg-slate-900 px-6 text-xs font-black text-white hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400"
					>
						{#if saving}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						저장
					</button>
					<button
						type="button"
						onclick={() => (open = false)}
						class="btn rounded-xl border border-slate-300 bg-white px-6 text-xs font-black text-slate-700 hover:bg-slate-100"
					>
						취소
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
