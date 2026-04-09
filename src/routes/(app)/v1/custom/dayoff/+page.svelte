<script>
	/**
	 * @file (app)/v1/app/dayoff/+page.svelte
	 * @description [v2.0] 근무자 전용 휴무 신청 및 관리 시스템 (Svelte 5 Runes & Premium Design)
	 */
	import { enhance } from '$app/forms';
	import Calendar from '$lib/components/Calendar.svelte';
	import { timestampToDateString } from '$lib/utils.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	let { data, form } = $props();

	// 📌 입력 상태 관리 ($state)
	/** @type {number[]} */
	let selectedDates = $state([]);
	/** @type {number|null} */
	let startDate = $state(null); // 범위 선택 시작일 (timestamp)
	let selectedType = $state('ANNUAL');
	let memo = $state('');
	let isSubmitting = $state(false);

	// 서버 응답 처리용 Guard 변수 (불필요한 리렌더링 트리거 방지용)
	let lastProcessedForm = $state(null);
	// 💡 참고: 알림 로직은 이제 use:enhance 내부에서 직접 처리합니다. (무한 루프 원천 차단)

	/**
	 * @function handleDayClick
	 * @description 범위 선택 지원 (시작일 클릭 -> 종료일 클릭 시 사이 기간 자동 선택)
	 */
	/**
	 * @param {any} event
	 */
	function handleDayClick(event) {
		const clicked = event.detail.timestamp;

		// 1. 이미 범위 선택이 완료된 상태거나, 아무것도 선택되지 않은 경우 -> 새로 시작
		if (selectedDates.length > 1 || !startDate) {
			startDate = clicked;
			selectedDates = [clicked];
			return;
		}

		// 2. 시작일만 있는 상태에서 클릭 -> 범위 완성
		if (startDate) {
			const endNode = clicked;
			const start = Math.min(startDate, endNode);
			const end = Math.max(startDate, endNode);

			const range = [];
			const oneDay = 24 * 60 * 60 * 1000;
			for (let t = start; t <= end; t += oneDay) {
				range.push(t);
			}

			selectedDates = range;
			// 선택 완료 후 다음 클릭을 위해 초기화 로직은 상황에 따라 다르지만
			// "다시 선택하면 기존 취소" 요구사항에 따라 selectedDates.length > 1 조건으로 체크
		}
	}

	/** @param {string} s */
	const getBadgeClass = (s) => {
		if (s === 'REQUESTED') return 'bg-amber-100 text-amber-700 border-amber-200';
		if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
		if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
		return 'bg-slate-100 text-slate-500 border-slate-200';
	};

	/** @param {string} t */
	const getTypeLabel = (t) => {
		/** @type {Record<string, string>} */
		const map = { ANNUAL: '연차', SICK: '병가', SPECIAL: '경조사', OFFICIAL: '공가' };
		return map[t] || t;
	};
</script>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-12 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- 📄 Page Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase"
				>Employee Self-Service / Attendance</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				휴무 <span class="NOT-ITALIC text-blue-600"
					>신청 <Icon
						icon="mdi:calendar-check"
						class="ml-1 inline-block align-text-bottom text-blue-600"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				개인별 휴무 일정을 계획하고 승인 상태를 실시간으로 확인합니다.
			</p>
		</div>
		<div class="flex items-center gap-6">
			<div class="text-right">
				<span class="mb-1 block text-[8px] font-black tracking-widest text-slate-300 uppercase"
					>Lifetime Record</span
				>
				<div class="text-3xl leading-none font-black tracking-tighter text-slate-900">
					{data.total} <span class="text-xs not-italic opacity-50">건</span>
				</div>
			</div>
		</div>
	</div>

	<!-- 📊 Main Layout -->
	<div class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
		<!-- Left: Calendar Area -->
		<div
			class="min-h-[600px] overflow-hidden rounded-[3rem] border-2 border-slate-900 bg-white p-6 shadow-2xl md:p-10 lg:col-span-8"
		>
			<div class="mb-8 flex items-center justify-between px-4">
				<h3 class="text-xl font-black tracking-tighter text-slate-900 uppercase italic">
					Schedule Selector
				</h3>
				<span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600"
					>날짜를 클릭하여 선택하세요 (다중 선택 가능)</span
				>
			</div>
			<Calendar {selectedDates} on:dayclick={handleDayClick} />
		</div>

		<!-- Right: Request Input -->
		<div class="space-y-6 lg:col-span-4">
			<div
				class="relative overflow-hidden rounded-[3rem] border-2 border-slate-900 bg-slate-900 p-8 text-white shadow-2xl md:p-10"
			>
				<!-- Decorative background icon -->
				<Icon
					icon="mdi:file-document-edit-outline"
					class="absolute -right-4 -bottom-4 h-40 w-40 opacity-5"
				/>

				<h3
					class="mb-10 border-b border-slate-700 pb-4 text-2xl font-black tracking-tighter uppercase italic"
				>
					Application Form
				</h3>

				<form
					method="post"
					action="?/create"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result, update }) => {
							await update();
							isSubmitting = false;

							// 🛡️ [무한 루프 방어] 동작(Action) 직후 한 번만 실행되는 명령형 알림
							if (result.type === 'success') {
								window.alert('휴무 신청이 성공적으로 완료되었습니다.');
								selectedDates = [];
								startDate = null;
								memo = '';
							} else if (result.type === 'failure') {
								// @ts-ignore
								window.alert(result.data?.error || '신청에 실패했습니다.');
							}
						};
					}}
					class="space-y-8"
				>
					<input
						type="hidden"
						name="dates"
						value={JSON.stringify(selectedDates.map((ts) => timestampToDateString(ts)))}
					/>

					<!-- Type Selection -->
					<div class="space-y-4">
						<span
							class="ml-1 block text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase"
							>Absence Category</span
						>
						<div class="grid grid-cols-2 gap-2">
							{#each ['ANNUAL', 'SICK', 'SPECIAL', 'OFFICIAL'] as type (type)}
								<label
									for="type-{type}"
									class="group relative flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-800 text-xs font-black transition-all
                                             {selectedType === type
										? 'border-blue-600 bg-blue-600 text-white shadow-lg'
										: 'bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
								>
									<input
										type="radio"
										id="type-{type}"
										name="type"
										value={type}
										bind:group={selectedType}
										class="hidden"
									/>
									{getTypeLabel(type)}
								</label>
							{/each}
						</div>
					</div>

					<!-- Memo textarea -->
					<div class="space-y-4">
						<label
							class="ml-1 block text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase"
							for="memo">Detail Reason / Memo</label
						>
						<textarea
							id="memo"
							class="w-full rounded-2xl border-2 border-slate-800 bg-slate-800/50 p-4 text-sm font-medium text-white transition-all placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
							name="memo"
							rows="3"
							placeholder="사유를 입력하세요 (선택 사항)"
							bind:value={memo}
						></textarea>
					</div>

					<!-- Selected List Summary -->
					<div class="rounded-2xl border border-slate-800 bg-slate-800/30 p-6">
						<div class="mb-4 flex items-center justify-between border-b border-slate-700 pb-2">
							<span class="text-[10px] font-black tracking-widest text-slate-400 uppercase"
								>Total selection</span
							>
							<span class="text-lg font-black text-emerald-400"
								>{selectedDates.length} <span class="text-xs font-bold">DAYS</span></span
							>
						</div>
						<div class="custom-scrollbar flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-2">
							{#each selectedDates as ts (ts)}
								<span
									class="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-[9px] font-bold text-white"
								>
									{timestampToDateString(ts)}
								</span>
							{/each}
							{#if selectedDates.length === 0}
								<p class="py-2 text-[10px] font-black text-slate-600 uppercase italic">
									Select dates from the left
								</p>
							{/if}
						</div>
					</div>

					<button
						type="submit"
						class="btn h-16 w-full rounded-2xl border-none bg-blue-600 font-black text-white uppercase shadow-xl transition-all btn-lg hover:bg-blue-700 disabled:opacity-30"
						disabled={selectedDates.length === 0 || isSubmitting}
					>
						{#if isSubmitting}
							<span class="loading loading-sm loading-spinner"></span>
						{:else}
							Send Request <Icon icon="mdi:send" class="ml-2 h-5 w-5" />
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- 📜 History Table -->
	<div class="space-y-8 pt-20">
		<div class="flex items-center justify-between">
			<h3
				class="flex items-end gap-3 border-l-8 border-slate-900 pl-6 text-2xl font-black tracking-tighter text-slate-900 uppercase italic md:text-4xl"
			>
				Request Ledger
				<span class="text-xs font-bold not-italic opacity-40">최근 신청 이력 현황</span>
			</h3>
		</div>

		{#if data.dayoff_list && data.dayoff_list.length > 0}
			<div class="overflow-hidden rounded-[3rem] border-2 border-slate-900 bg-white shadow-2xl">
				<div class="overflow-x-auto">
					<table class="table w-full">
						<thead
							class="bg-slate-900 text-[10px] font-black tracking-[0.2em] text-white uppercase"
						>
							<tr>
								<th class="px-10 py-6">Application Date</th>
								<th>Category</th>
								<th>Process Status</th>
								<th>Memo Description</th>
								<th class="px-10 text-right">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 font-medium text-slate-700 italic">
							{#each data.dayoff_list as d (d.id)}
								<tr class="group transition-colors hover:bg-slate-50">
									<td class="px-10 py-6">
										<div class="flex items-center gap-3">
											<Icon icon="mdi:calendar-month-outline" class="h-5 w-5 text-slate-300" />
											<span class="text-lg font-black tracking-tighter text-slate-900 not-italic"
												>{d.date}</span
											>
										</div>
									</td>
									<td>
										<span
											class="rounded-full border-2 border-slate-100 bg-white px-3 py-1 text-[10px] font-black not-italic"
										>
											{getTypeLabel(d.type)}
										</span>
									</td>
									<td>
										<span
											class="rounded-lg border-2 px-3 py-1 text-[10px] font-black tracking-tighter not-italic {getBadgeClass(
												d.status
											)}"
										>
											{d.status}
										</span>
									</td>
									<td class="max-w-[150px] truncate text-xs opacity-40">{d.memo || '-'}</td>
									<td class="px-10 text-right">
										{#if d.status === 'REQUESTED'}
											<form method="post" action="?/delete" use:enhance class="inline">
												<input type="hidden" name="dayoff_id" value={d.id} />
												<button
													type="submit"
													class="btn rounded-xl font-black text-rose-500 uppercase btn-ghost btn-sm hover:border-rose-100 hover:bg-rose-50"
													onclick={(/** @type {any} */ e) => {
														if (!confirm('신청을 취소하시겠습니까?')) e.preventDefault();
													}}
												>
													Cancel Request
												</button>
											</form>
										{:else}
											<span
												class="rounded-md border border-slate-100 px-3 py-1 text-[10px] font-black tracking-widest text-slate-200 uppercase"
												>Locked</span
											>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<div class="rounded-[4rem] border-4 border-dashed border-slate-100 py-32 text-center">
				<Icon icon="mdi:database-off-outline" class="mx-auto mb-6 h-20 w-20 text-slate-200" />
				<p class="text-2xl font-black text-slate-300 uppercase italic">Records Not Found</p>
				<p class="mt-2 text-xs font-bold text-slate-400">최근 신청한 결근계 내역이 없습니다.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #334155;
		border-radius: 10px;
	}
</style>
