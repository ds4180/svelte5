<script>
	/**
	 * SearchFilterBar.svelte
	 * @description 게시판·목록 공용 검색, 정렬, 페이지당 건수 필터 바
	 */
	import Icon from '@iconify/svelte';

	let {
		keyword = $bindable(''),
		sort = $bindable('latest'),
		pageSize = $bindable(10),
		total = 0,
		placeholder = '제목, 내용, 작성자 검색...',
		sortOptions = [
			{ value: 'latest', label: '최신순' },
			{ value: 'views', label: '조회순' },
			{ value: 'oldest', label: '오래된순' }
		],
		pageSizeOptions = [10, 20, 50],
		onSearch = undefined,
		onReset = undefined
	} = $props();

	function handleSubmit(e) {
		e.preventDefault();
		onSearch?.();
	}

	function handleReset() {
		keyword = '';
		sort = sortOptions[0]?.value || 'latest';
		pageSize = pageSizeOptions[0] || 10;
		if (onReset) {
			onReset();
		} else {
			onSearch?.();
		}
	}
</script>

<form
	onsubmit={handleSubmit}
	class="search-filter-bar flex flex-col gap-2.5 rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
>
	<!-- 좌측: 검색 입력 -->
	<div class="flex flex-1 items-center gap-2">
		<div class="relative flex-1">
			<Icon
				icon="ph:magnifying-glass-bold"
				class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
			/>
			<input
				type="text"
				bind:value={keyword}
				{placeholder}
				class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-9 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:bg-white focus:outline-none sm:text-sm"
			/>
			{#if keyword}
				<button
					type="button"
					onclick={() => {
						keyword = '';
						onSearch?.();
					}}
					class="absolute top-1/2 right-2.5 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
					aria-label="검색어 지우기"
				>
					<Icon icon="ph:x-bold" class="h-3 w-3" />
				</button>
			{/if}
		</div>
		<button
			type="submit"
			class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-blue-600"
		>
			<span>검색</span>
		</button>
	</div>

	<!-- 우측: 총 건수, 정렬, 건수 선택 -->
	<div class="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
		<span class="px-1 text-xs font-bold text-slate-400">
			총 <strong class="text-slate-700">{total}</strong>건
		</span>

		<div class="flex items-center gap-2">
			{#if sortOptions.length > 0}
				<select
					bind:value={sort}
					onchange={() => onSearch?.()}
					aria-label="정렬 기준"
					class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-600"
				>
					{#each sortOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			{/if}

			{#if pageSizeOptions.length > 0}
				<select
					bind:value={pageSize}
					onchange={() => onSearch?.()}
					aria-label="페이지당 표시 건수"
					class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-600"
				>
					{#each pageSizeOptions as count}
						<option value={count}>{count}개씩</option>
					{/each}
				</select>
			{/if}

			{#if keyword || sort !== (sortOptions[0]?.value || 'latest')}
				<button
					type="button"
					onclick={handleReset}
					class="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
					title="필터 초기화"
				>
					초기화
				</button>
			{/if}
		</div>
	</div>
</form>
