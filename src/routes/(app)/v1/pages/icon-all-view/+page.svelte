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

	const COLOR_PRESETS = [
		{ label: '기본', class: '', dot: 'bg-slate-800' },
		{ label: 'Blue', class: 'text-blue-600', dot: 'bg-blue-600' },
		{ label: 'Emerald', class: 'text-emerald-600', dot: 'bg-emerald-600' },
		{ label: 'Amber', class: 'text-amber-500', dot: 'bg-amber-500' },
		{ label: 'Rose', class: 'text-rose-600', dot: 'bg-rose-600' },
		{ label: 'Violet', class: 'text-violet-600', dot: 'bg-violet-600' },
		{ label: 'Slate', class: 'text-slate-400', dot: 'bg-slate-400' }
	] as const;

	const SIZE_PRESETS = [
		{ label: '16px', class: 'text-base' },
		{ label: '20px', class: 'text-xl' },
		{ label: '24px', class: 'text-2xl' },
		{ label: '30px', class: 'text-3xl' },
		{ label: '36px', class: 'text-4xl' }
	] as const;

	const ROTATE_OPTIONS = [
		{ label: '0°', value: 0 },
		{ label: '90°', value: 1 },
		{ label: '180°', value: 2 },
		{ label: '270°', value: 3 }
	] as const;

	const FLIP_OPTIONS = [
		{ label: '없음', value: '' },
		{ label: '좌우', value: 'horizontal' },
		{ label: '상하', value: 'vertical' }
	] as const;

	let selectedPrefix = $state('all');
	let search = $state('');
	let selectedColorClass = $state('');
	let useCustomColor = $state(false);
	let customColor = $state('#2563eb');
	let selectedSizeClass = $state('text-xl');
	let rotate = $state(0);
	let flip = $state('');

	let previewClass = $derived(
		[selectedSizeClass, !useCustomColor ? selectedColorClass : ''].filter(Boolean).join(' ')
	);

	function buildIconTag(id: string): string {
		const attrs = [`icon="${id}"`];
		const classParts = [
			selectedSizeClass !== 'text-xl' ? selectedSizeClass : '',
			!useCustomColor ? selectedColorClass : ''
		].filter(Boolean);
		if (classParts.length > 0) attrs.push(`class="${classParts.join(' ')}"`);
		if (useCustomColor && customColor) attrs.push(`color="${customColor}"`);
		if (rotate > 0) attrs.push(`rotate={${rotate}}`);
		if (flip) attrs.push(`flip="${flip}"`);
		return `<Icon ${attrs.join(' ')} />`;
	}

	function resetOptions() {
		selectedColorClass = '';
		useCustomColor = false;
		customColor = '#2563eb';
		selectedSizeClass = 'text-xl';
		rotate = 0;
		flip = '';
	}

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

		<div class="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 lg:grid-cols-12 lg:items-center">
			<div class="flex flex-wrap items-center gap-1.5 lg:col-span-5">
				<span class="mr-1 text-[11px] font-black text-slate-500">색상</span>
				{#each COLOR_PRESETS as c}
					<button
						type="button"
						onclick={() => {
							useCustomColor = false;
							selectedColorClass = c.class;
						}}
						class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition {!useCustomColor &&
						selectedColorClass === c.class
							? 'border-slate-900 bg-slate-900 text-white'
							: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
					>
						<span class="h-2.5 w-2.5 rounded-full {c.dot}"></span>
						<span>{c.label}</span>
					</button>
				{/each}
				<label
					class="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition {useCustomColor
						? 'border-blue-600 bg-blue-50 text-blue-700'
						: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
				>
					<input
						type="color"
						bind:value={customColor}
						oninput={() => (useCustomColor = true)}
						class="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
					/>
					<span class="font-mono">{customColor}</span>
				</label>
			</div>

			<div class="flex flex-wrap items-center gap-1 lg:col-span-3">
				<span class="mr-1 text-[11px] font-black text-slate-500">크기</span>
				{#each SIZE_PRESETS as s}
					<button
						type="button"
						onclick={() => (selectedSizeClass = s.class)}
						class="rounded-lg border px-2 py-1 text-[11px] font-bold transition {selectedSizeClass === s.class
							? 'border-slate-900 bg-slate-900 text-white'
							: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
					>
						{s.label}
					</button>
				{/each}
			</div>

			<div class="flex flex-wrap items-center gap-2 lg:col-span-4 lg:justify-end">
				<div class="flex items-center gap-1">
					<span class="text-[11px] font-black text-slate-500">회전</span>
					{#each ROTATE_OPTIONS as r}
						<button
							type="button"
							onclick={() => (rotate = r.value)}
							class="rounded-lg border px-2 py-1 text-[11px] font-bold transition {rotate === r.value
								? 'border-slate-900 bg-slate-900 text-white'
								: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
						>
							{r.label}
						</button>
					{/each}
				</div>

				<div class="flex items-center gap-1">
					<span class="text-[11px] font-black text-slate-500">반전</span>
					{#each FLIP_OPTIONS as f}
						<button
							type="button"
							onclick={() => (flip = f.value)}
							class="rounded-lg border px-2 py-1 text-[11px] font-bold transition {flip === f.value
								? 'border-slate-900 bg-slate-900 text-white'
								: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
						>
							{f.label}
						</button>
					{/each}
				</div>

				<button
					type="button"
					onclick={resetOptions}
					class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
				>
					초기화
				</button>
			</div>
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
						{@const iconTag = buildIconTag(item.id)}
						<tr class="hover:bg-slate-50/80">
							<td class="text-center">
								<div class="mx-auto flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 p-1.5 text-slate-800">
									<Icon
										icon={item.id}
										class={previewClass}
										color={useCustomColor ? customColor : undefined}
										rotate={rotate || undefined}
										flip={flip || undefined}
									/>
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
									onclick={() => copyText(iconTag, 'Svelte 태그')}
									class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600 hover:border-blue-400 hover:bg-white hover:text-blue-700"
									title="Svelte 태그 복사"
								>
									<span>{iconTag}</span>
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
