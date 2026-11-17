<script>
	/**
	 * @file DayoffDateOverrideModal.svelte
	 * @description 특정 날짜(기간) 선착순 예외 정원 관리 모달 (정책 이력과 완전 분리)
	 */
	import { timestampToDateString } from '$lib/utils';
	import Icon from '@iconify/svelte';

	let {
		open = $bindable(false),
		todayStr = '',
		defaultQuota = 3,
		dateOverrides = /** @type {Record<string, number>} */ ({}),
		onApply = async (/** @type {string[]} */ _dates, /** @type {number | null} */ _quota) => {}
	} = $props();

	let startDate = $state('');
	let endDate = $state('');
	let quotaInput = $state(3);
	let saving = $state(false);

	$effect(() => {
		if (open) {
			startDate = todayStr;
			endDate = todayStr;
			quotaInput = Number(defaultQuota ?? 3);
		}
	});

	let sortedOverrides = $derived(
		Object.entries(dateOverrides || {}).sort(([a], [b]) => a.localeCompare(b))
	);

	/** @param {string} s @param {string} e */
	function getDatesInRange(s, e) {
		if (!s) return [];
		const end = e && e >= s ? e : s;
		const [sy, sm, sd] = s.split('-').map(Number);
		const [ey, em, ed] = end.split('-').map(Number);
		const cur = new Date(sy, sm - 1, sd);
		const last = new Date(ey, em - 1, ed);
		/** @type {string[]} */
		const list = [];
		while (cur <= last && list.length < 180) {
			list.push(timestampToDateString(cur.getTime()));
			cur.setDate(cur.getDate() + 1);
		}
		return list;
	}

	/** @param {string[]} dates @param {number | null} quota */
	async function handleApply(dates, quota) {
		if (!dates.length) return;
		saving = true;
		try {
			await onApply(dates, quota);
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
		aria-labelledby="dayoff-override-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') open = false;
		}}
	>
		<div
			class="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border-2 border-slate-900 bg-white shadow-2xl"
		>
			<!-- 헤더 -->
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-5 text-white">
				<div>
					<span class="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-amber-300 uppercase">
						Date Quota Override
					</span>
					<h3 id="dayoff-override-modal-title" class="mt-1 text-lg font-black text-white">
						특정일 예외 정원 관리
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
				<div class="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<p class="text-[11px] font-medium text-slate-600">
						기본 정원({defaultQuota}명)보다 우선 적용할 특정 날짜(또는 기간)의 정원을 지정합니다. (0명 입력 시 신청 차단)
					</p>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="ov-start" class="mb-1 block text-[11px] font-black text-slate-600">시작일</label>
							<input
								id="ov-start"
								type="date"
								bind:value={startDate}
								onchange={() => {
									if (endDate < startDate) endDate = startDate;
								}}
								class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
							/>
						</div>
						<div>
							<label for="ov-end" class="mb-1 block text-[11px] font-black text-slate-600">종료일</label>
							<input
								id="ov-end"
								type="date"
								bind:value={endDate}
								min={startDate}
								class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
							/>
						</div>
					</div>

					<div class="flex items-center justify-between gap-3">
						<label for="ov-quota" class="text-xs font-black text-slate-700">지정 정원 (명 / 일):</label>
						<input
							id="ov-quota"
							type="number"
							min="0"
							max="100"
							bind:value={quotaInput}
							class="w-24 rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-center text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none"
						/>
					</div>

					<button
						type="button"
						disabled={saving}
						onclick={() => handleApply(getDatesInRange(startDate, endDate), Number(quotaInput))}
						class="btn w-full rounded-xl border-none bg-blue-600 font-black text-white hover:bg-blue-700"
					>
						선택한 날짜 정원 적용
					</button>
				</div>

				<!-- 등록된 목록 -->
				<div class="space-y-2.5">
					<span class="block text-xs font-black text-slate-700">
						지정된 날짜별 예외 정원 ({sortedOverrides.length}건)
					</span>

					{#if sortedOverrides.length === 0}
						<div class="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-bold text-slate-400">
							별도로 지정된 예외 정원 날짜가 없습니다.<br />(전 일자 기본 {defaultQuota}명 적용)
						</div>
					{:else}
						<div class="max-h-60 space-y-2 overflow-y-auto pr-1">
							{#each sortedOverrides as [dStr, qVal] (dStr)}
								<div class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5">
									<div class="flex items-center gap-2.5">
										<span class="font-mono text-xs font-black text-slate-800">{dStr}</span>
										<span
											class="rounded-full px-2.5 py-0.5 text-[11px] font-black {qVal === 0
												? 'bg-rose-100 text-rose-700'
												: 'bg-amber-100 text-amber-800'}"
										>
											{qVal === 0 ? '신청불가 (0명)' : `정원 ${qVal}명`}
										</span>
									</div>
									<button
										type="button"
										disabled={saving}
										onclick={() => handleApply([dStr], null)}
										class="text-xs font-black text-rose-500 hover:underline"
									>
										기본값 복원
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- 푸터 -->
			<div class="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
				<button
					type="button"
					onclick={() => (open = false)}
					class="btn rounded-xl border border-slate-300 bg-white px-6 text-xs font-black text-slate-700 hover:bg-slate-100"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}
