<script>
	/**
	 * Pagination.svelte
	 * @description 공용 페이지네이션 컴포넌트 (SPA 콜백 모드 + URL 링크 모드 겸용)
	 * @prop {number} total - 전체 데이터 수
	 * @prop {number} currentPage - 현재 페이지 번호 (0-indexed)
	 * @prop {number} [size=10] - 페이지당 항목 수
	 * @prop {string} [keyword=''] - URL 링크 모드용 검색어
	 * @prop {(page: number) => void} [onPageChange] - SPA 콜백 (지정 시 <button>으로 동작)
	 */
	import Icon from '@iconify/svelte';

	let {
		total = 0,
		currentPage = 0,
		size = 10,
		keyword = '',
		onPageChange = undefined
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / Math.max(1, size))));

	const getUrl = (page) => {
		const params = new URLSearchParams({ page: String(page) });
		if (keyword) params.set('keyword', keyword);
		return `?${params.toString()}`;
	};

	function handleSelect(page) {
		if (page < 0 || page >= totalPages || page === currentPage) return;
		onPageChange?.(page);
	}
</script>

{#if totalPages > 1}
	<nav class="mt-6 flex items-center justify-center gap-1.5" aria-label="페이지 이동">
		{#if onPageChange}
			<button
				type="button"
				onclick={() => handleSelect(currentPage - 1)}
				disabled={currentPage <= 0}
				aria-label="이전 페이지"
				class="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Icon icon="ph:caret-left-bold" class="h-4 w-4" />
			</button>

			{#each Array(totalPages) as _, i}
				{#if i >= currentPage - 3 && i <= currentPage + 3}
					<button
						type="button"
						onclick={() => handleSelect(i)}
						class="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border-2 px-3 text-xs font-black transition {i === currentPage
							? 'border-blue-600 bg-blue-600 text-white shadow-xs'
							: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}"
					>
						{i + 1}
					</button>
				{/if}
			{/each}

			<button
				type="button"
				onclick={() => handleSelect(currentPage + 1)}
				disabled={currentPage + 1 >= totalPages}
				aria-label="다음 페이지"
				class="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Icon icon="ph:caret-right-bold" class="h-4 w-4" />
			</button>
		{:else}
			<a
				href={getUrl(Math.max(0, currentPage - 1))}
				aria-label="이전 페이지"
				class="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 {currentPage <= 0 ? 'pointer-events-none opacity-40' : ''}"
			>
				<Icon icon="ph:caret-left-bold" class="h-4 w-4" />
			</a>

			{#each Array(totalPages) as _, i}
				{#if i >= currentPage - 3 && i <= currentPage + 3}
					<a
						href={getUrl(i)}
						class="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border-2 px-3 text-xs font-black transition {i === currentPage
							? 'border-blue-600 bg-blue-600 text-white shadow-xs'
							: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}"
					>
						{i + 1}
					</a>
				{/if}
			{/each}

			<a
				href={getUrl(Math.min(totalPages - 1, currentPage + 1))}
				aria-label="다음 페이지"
				class="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 {currentPage + 1 >= totalPages ? 'pointer-events-none opacity-40' : ''}"
			>
				<Icon icon="ph:caret-right-bold" class="h-4 w-4" />
			</a>
		{/if}
	</nav>
{/if}
