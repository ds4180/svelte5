<script>
	/**
	 * @file DayoffDateQuotaCard.svelte
	 * @description 선택한 특정 날짜의 운전직 일일 선착순 정원(Quota) 즉시 수정/복원 카드 컴포넌트
	 */
	let {
		selectedDate = null,
		quotaInfo = null,
		onApplyOverride = async (/** @type {string[]} */ _dates, /** @type {number | null} */ _quota) => {}
	} = $props();

	let quotaInput = $state(3);

	$effect(() => {
		if (quotaInfo) {
			quotaInput = quotaInfo.quota;
		}
	});
</script>

{#if selectedDate && quotaInfo}
	<div class="overflow-hidden rounded-xl border-2 border-emerald-200 bg-white shadow-md md:rounded-[1.75rem]">
		<div class="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/60 px-5 py-4">
			<div>
				<span class="text-[10px] font-black tracking-widest text-emerald-700 uppercase">
					🚌 운전직 일일 선착순 정원 제어
				</span>
				<h4 class="text-base font-black text-slate-900">
					{selectedDate}
				</h4>
			</div>
			{#if quotaInfo.isOverride}
				<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800 border border-amber-300">
					⚡ 특정일 예외 정원
				</span>
			{:else}
				<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
					기본 정원 적용 중
				</span>
			{/if}
		</div>

		<div class="p-5 space-y-4">
			<div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
				<span class="text-xs font-bold text-slate-600">현재 운전직 확정 / 정원</span>
				<span class="text-lg font-black {quotaInfo.isFull ? 'text-rose-600' : 'text-emerald-600'}">
					{quotaInfo.approvedCount} / {quotaInfo.quota}명
					<span class="ml-1 text-xs font-bold">
						({quotaInfo.isFull ? '마감' : `잔여 ${quotaInfo.remaining}명`})
					</span>
				</span>
			</div>

			<div class="flex items-center gap-2">
				<label for="date-quota-input" class="text-xs font-black text-slate-700 shrink-0">
					정원 수정(명):
				</label>
				<input
					id="date-quota-input"
					type="number"
					min="0"
					max="100"
					bind:value={quotaInput}
					class="w-20 rounded-xl border-2 border-slate-200 px-3 py-1.5 text-center text-sm font-black text-slate-900 focus:border-emerald-500 focus:outline-none"
				/>
				<button
					type="button"
					onclick={() => onApplyOverride([selectedDate], Number(quotaInput))}
					class="btn btn-sm flex-1 rounded-xl border-none bg-emerald-600 font-black text-white hover:bg-emerald-700"
				>
					이 날짜 정원 저장
				</button>
			</div>

			{#if quotaInfo.isOverride}
				<button
					type="button"
					onclick={() => onApplyOverride([selectedDate], null)}
					class="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
				>
					기본 정원({quotaInfo.baseQuota}명)으로 복원
				</button>
			{/if}
		</div>
	</div>
{/if}
