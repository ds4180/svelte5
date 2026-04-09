<script>
	/**
	 * @file Calendar.svelte (오피스 고대비 고해상도 버전)
	 * @description 요일 대형화, 7행 확장(이전달 context 강화), 컴팩트 디자인 고도화
	 */
	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher();

	let { year = $bindable(null), month = $bindable(null), selectedDates = $bindable([]) } = $props();

	onMount(() => {
		if (year === null) year = new Date().getFullYear();
		if (month === null) month = new Date().getMonth();
	});

	const days = ['일', '월', '화', '수', '목', '금', '토'];

	/**
	 * @function calendarDays
	 * @description 7행(49일)을 생성하여 이전 달 한 줄이 항상 더 보이게 조정
	 */
	let calendarDays = $derived.by(() => {
		if (year === null || month === null) return [];

		const firstDay = new Date(year, month, 1).getDay();
		const lastDate = new Date(year, month + 1, 0).getDate();
		const prevLastDate = new Date(year, month, 0).getDate();

		const result = [];

		// 📌 이전 달 데이터 추가 (항상 "이전 한 줄"을 더 확보하기 위해 firstDay + 7 기반)
		const offset = firstDay === 0 ? 7 : firstDay + 7;

		for (let i = offset - 1; i >= 0; i--) {
			const date = new Date(year, month, 0 - i); // 이전 달 날짜 계산
			result.push({
				day: date.getDate(),
				current: false,
				timestamp: date.setHours(0, 0, 0, 0)
			});
		}

		// 현재 달
		for (let i = 1; i <= lastDate; i++) {
			const date = new Date(year, month, i);
			result.push({ day: i, current: true, timestamp: date.setHours(0, 0, 0, 0) });
		}

		// 📌 총 49일(7줄)을 채움
		const remain = 49 - result.length;
		for (let i = 1; i <= remain; i++) {
			const date = new Date(year, month + 1, i);
			result.push({
				day: i,
				current: false,
				timestamp: date.setHours(0, 0, 0, 0)
			});
		}
		return result;
	});

	function navigate(offset) {
		if (year === null || month === null) return;
		let newDate = new Date(year, month + offset, 1);
		year = newDate.getFullYear();
		month = newDate.getMonth();
		dispatch('navigate', { year, month });
	}

	function handleDayClick(day) {
		dispatch('dayclick', { timestamp: day.timestamp });
	}

	function isSelected(timestamp) {
		return selectedDates.includes(timestamp);
	}

	// 🛡️ [하이드레이션 방어] isToday도 브라우저에서만 실시간 체크하도록 유도하거나 null 가드
	function isToday(timestamp) {
		const today = new Date().setHours(0, 0, 0, 0);
		return today === timestamp;
	}
</script>

<div class="rounded-none border-2 border-black bg-white p-8 shadow-[20px_20px_0_rgba(0,0,0,0.05)]">
	<!-- Header: 고대비 오피스 디자인 -->
	<div class="mb-10 flex items-end justify-between border-b-2 border-black pb-8">
		<div class="flex flex-col gap-1">
			<span class="text-[10px] leading-none font-black tracking-[0.4em] uppercase italic opacity-30"
				>Management Ledger</span
			>
			<div class="flex items-baseline gap-4">
				<h2 class="text-6xl font-black tracking-tighter text-black">{year ?? '----'}</h2>
				<span class="text-4xl font-bold opacity-20">/</span>
				<h2 class="text-6xl font-black tracking-tighter text-blue-600">
					{month !== null ? String(month + 1).padStart(2, '0') : '--'}
				</h2>
			</div>
		</div>

		<div class="flex h-14 overflow-hidden border-2 border-black bg-black">
			<button
				class="border-r border-black px-8 text-xs font-black text-white uppercase transition-all hover:bg-white hover:text-black"
				onclick={() => navigate(-1)}
			>
				Prev
			</button>
			<button
				class="px-8 text-xs font-black text-white uppercase transition-all hover:bg-white hover:text-black"
				onclick={() => navigate(1)}
			>
				Next
			</button>
		</div>
	</div>

	<!-- Weeks Labels: 📌 요일 크기 강화 -->
	<div class="mb-px grid grid-cols-7 gap-px overflow-hidden border-2 border-black bg-black">
		{#each days as day}
			<div
				class="bg-white py-6 text-center text-xl font-black tracking-tighter text-black uppercase md:text-2xl
                        {day === '일' ? 'bg-red-50 text-red-500' : ''}
                        {day === '토' ? 'bg-blue-50 text-blue-500' : ''}"
			>
				{day}
			</div>
		{/each}
	</div>

	<!-- Days Grid: 📌 간격 75% 감소 & 7행 확장 모델 -->
	<div class="grid grid-cols-7 gap-px border-2 border-black bg-black p-px">
		{#each calendarDays as d}
			<button
				class="group relative flex h-16 flex-col items-center justify-center bg-white transition-all duration-150 md:h-18
                       {d.current ? 'hover:bg-slate-50' : 'bg-slate-100 opacity-[0.3] grayscale'} 
                       {isSelected(d.timestamp) ? 'z-10 !bg-black text-white' : ''}"
				onclick={() => handleDayClick(d)}
			>
				<!-- 📌 Today Indicator: 강렬한 시인성 -->
				{#if isToday(d.timestamp) && !isSelected(d.timestamp)}
					<div class="pointer-events-none absolute inset-0 z-[5] border-4 border-blue-600"></div>
					<div
						class="absolute top-0 right-0 z-10 bg-blue-600 px-1.5 py-0.5 text-[8px] font-black text-white uppercase"
					>
						Today
					</div>
				{/if}

				<span class="text-2xl font-black tracking-tight {d.current ? '' : 'text-slate-400'}"
					>{d.day}</span
				>

				{#if isSelected(d.timestamp)}
					<div class="absolute bottom-1.5 h-0.5 w-4 bg-white/40"></div>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	:global(body) {
		letter-spacing: -0.02em;
	}
</style>
