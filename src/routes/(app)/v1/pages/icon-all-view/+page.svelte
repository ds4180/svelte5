<script lang="ts">
	/**
	 * @file /v1/pages/icon-all-view/+page.svelte
	 * @description 프로젝트 내 오프라인 내장 아이콘(collections.json) 전체 목록 및 복사 도구
	 */
	import Icon from '@iconify/svelte';
	import collections from '$lib/icons/collections.json';
	import { toast } from '$lib/runes/toast.svelte';

	type LocalIconEntry = {
		prefix: string;
		name: string;
		id: string;
	};

	const allIcons: LocalIconEntry[] = (collections as any[]).flatMap((col) => {
		const prefix = String(col.prefix || '');
		const names = Object.keys(col.icons || {});
		return names.map((name) => ({
			prefix,
			name,
			id: `${prefix}:${name}`
		}));
	});

	const prefixes = ['all', ...(collections as any[]).map((c) => String(c.prefix || ''))];

	let selectedPrefix = $state('all');
	let search = $state('');

	let filteredIcons = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return allIcons.filter((item) => {
			if (selectedPrefix !== 'all' && item.prefix !== selectedPrefix) return false;
			if (q && !item.id.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	async function copyText(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`복사됨: ${label}`);
		} catch {
			toast.error('클립보드 복사에 실패했습니다.');
		}
	}
</script>

<div class="mx-auto max-w-6xl space-y-5">
	<header class="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="flex items-center gap-2 text-lg font-black text-slate-900 sm:text-xl">
					<Icon icon="ph:squares-four-bold" class="text-blue-600" />
					<span>오프라인 내장 아이콘 목록</span>
					<span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-black text-blue-700">
						{filteredIcons.length} / {allIcons.length}
					</span>
				</h1>
				<p class="mt-1 text-xs text-slate-500">
					외부 웹 접속 없이 오프라인 번들(<code class="font-mono">collections.json</code>)로 즉시 렌더링되는 아이콘입니다.
				</p>
			</div>

			<div class="w-full sm:w-64">
				<input
					type="search"
					bind:value={search}
					placeholder="아이콘 검색 (예: bus, user, pin)"
					class="input input-bordered input-sm w-full rounded-xl font-bold"
				/>
			</div>
		</div>

		<div class="mt-4 flex flex-wrap gap-1.5">
			{#each prefixes as p}
				{@const count = p === 'all' ? allIcons.length : allIcons.filter((i) => i.prefix === p).length}
				<button
					type="button"
					onclick={() => (selectedPrefix = p)}
					class="rounded-xl px-3 py-1 text-xs font-black transition {selectedPrefix === p
						? 'bg-slate-900 text-white'
						: 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
				>
					{p === 'all' ? '전체' : p} ({count})
				</button>
			{/each}
		</div>
	</header>

	<div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
		<table class="table table-sm w-full">
			<thead>
				<tr class="bg-slate-50 text-xs text-slate-600">
					<th class="w-16 text-center">아이콘</th>
					<th class="w-24">팩</th>
					<th>아이콘 값 (클릭 복사)</th>
					<th>Svelte 코드 (클릭 복사)</th>
				</tr>
			</thead>
			<tbody>
				{#if filteredIcons.length === 0}
					<tr>
						<td colspan="4" class="py-10 text-center text-xs font-bold text-slate-400">
							검색 조건에 맞는 아이콘이 없습니다.
						</td>
					</tr>
				{:else}
					{#each filteredIcons as item (item.id)}
						<tr class="hover:bg-slate-50/80">
							<td class="text-center">
								<div class="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
									<Icon icon={item.id} class="text-xl" />
								</div>
							</td>
							<td>
								<span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
									{item.prefix}
								</span>
							</td>
							<td>
								<button
									type="button"
									onclick={() => copyText(item.id, item.id)}
									class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-bold text-slate-800 hover:border-blue-400 hover:text-blue-700"
									title="아이콘 값 복사"
								>
									<span>{item.id}</span>
									<Icon icon="ph:copy-bold" class="text-slate-400" />
								</button>
							</td>
							<td>
								<button
									type="button"
									onclick={() => copyText(`<Icon icon="${item.id}" />`, 'Svelte 태그')}
									class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600 hover:border-blue-400 hover:bg-white hover:text-blue-700"
									title="Svelte 태그 복사"
								>
									<span>&lt;Icon icon="{item.id}" /&gt;</span>
									<Icon icon="ph:copy-bold" class="text-slate-400" />
								</button>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
