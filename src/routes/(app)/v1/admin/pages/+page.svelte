<script>
	/**
	 * @file (app)/v1/admin/pages/+page.svelte
	 * @description 순수 파일 시스템 기반 정적 페이지 내비게이터
	 * @philosophy "파일의 존재가 곧 주소의 정의다." (No DB)
	 */
	let { data } = $props();

	let searchQuery = $state('');
	let filteredPages = $derived(
		data.pages.filter((p) => p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	function formatDate(date) {
		return new Date(date).toLocaleString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="animate-fade-in mx-auto max-w-7xl space-y-10 px-4 pb-40 font-['Outfit'] text-black">
	<!-- 📄 Hero Section -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
				>Pure File-System Navigator</span
			>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				Pages <span class="NOT-ITALIC text-blue-600">Master</span>
			</h1>
			<p class="mt-3 text-xs font-bold opacity-40">
				DB 없이 /v1/pages 하위의 물리적 파일들을 실시간으로 스캔하여 관리합니다.
			</p>
		</div>
		<div class="w-full md:w-80">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="SEARCH SLUG..."
				class="h-14 w-full border-2 border-black bg-slate-50 px-6 font-black tracking-widest uppercase transition-all placeholder:opacity-20 focus:bg-white focus:outline-none"
			/>
		</div>
	</div>

	<!-- 📦 Page List Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each filteredPages as page (page.slug)}
			<div
				class="group relative border-2 border-black bg-white p-6 transition-all hover:bg-slate-50"
			>
				<div class="mb-6 flex items-start justify-between">
					<div
						class="flex h-12 w-12 items-center justify-center bg-black text-xl font-black text-white"
					>
						📄
					</div>
					<a
						href={page.url}
						target="_blank"
						class="btn rounded-none border-black text-[9px] font-black uppercase btn-outline btn-xs hover:bg-black hover:text-white"
					>
						Open Live
					</a>
				</div>

				<h3 class="mb-1 truncate text-2xl font-black tracking-tighter uppercase italic">
					{page.slug}
				</h3>
				<p class="mb-6 font-mono text-[10px] font-bold text-blue-600 opacity-60">{page.url}</p>

				<div class="space-y-3 border-t border-black/5 pt-4">
					<div class="flex items-center justify-between text-[9px] font-bold">
						<span class="uppercase opacity-20">Last Sync</span>
						<span>{formatDate(page.last_modified)}</span>
					</div>
					<div class="flex items-center justify-between text-[9px] font-bold">
						<span class="uppercase opacity-20">Source Path</span>
						<span class="max-w-[180px] truncate font-mono">{page.path}</span>
					</div>
				</div>

				<!-- Hover Decor -->
				<div
					class="absolute right-0 bottom-0 h-1 w-0 bg-black transition-all group-hover:w-full"
				></div>
			</div>
		{:else}
			<div
				class="col-span-full h-80 border-2 border-black border-dashed flex flex-col items-center justify-center grayscale opacity-20"
			>
				<span class="text-4xl mb-4">🔍</span>
				<p class="font-black italic uppercase tracking-widest">No Pages Detected in /v1/pages/</p>
			</div>
		{/each}
	</div>

	<!-- 💡 안내 문구 -->
	<div class="border-2 border-black bg-slate-50 p-8">
		<h4 class="mb-2 text-sm font-black uppercase">How to add a new page?</h4>
		<p class="text-xs leading-relaxed font-bold opacity-50">
			별도의 등록 버튼이 없습니다. <code class="bg-black px-1 text-white"
				>src/routes/(app)/v1/pages/</code
			>
			폴더 안에 새로운 폴더를 만들고 <code class="bg-black px-1 text-white">+page.svelte</code> 파일을
			생성하면 이곳에 자동으로 나타납니다.
		</p>
	</div>
</div>
