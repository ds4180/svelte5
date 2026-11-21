<script lang="ts">
	/**
	 * ============================================================================
	 * [공용 서비스 번들 레이아웃 렌더러 (src/lib/components/ServiceBundleRenderer.svelte)]
	 * ============================================================================
	 * 💡 역할:
	 * - 백엔드에서 전달받은 `bindings` 배열을 `layout.row` 기준으로 자동 그룹화하여
	 *   단독 블록(block), 가로 인라인(inline), 2단 분할(grid-2) 및 단일 카드 div 통합(wrap)을
	 *   동적으로 렌더링합니다.
	 * - 기존 레거시 바인딩(layout 없음)은 자동으로 단독 block 카드로 렌더링되어 100% 하위 호환됩니다.
	 */
	import { fly } from 'svelte/transition';
	import * as engines from '$lib/index';

	interface BindingLayout {
		row?: number;
		display?: 'block' | 'inline' | 'grid-2';
		wrap?: boolean;
		align?: 'start' | 'between' | 'end';
	}

	interface ServiceBindingItem {
		app_id?: number;
		service_id: string;
		engine_id: string;
		service_component: string;
		config?: Record<string, any>;
		layout?: BindingLayout | null;
	}

	interface Props {
		bindings?: ServiceBindingItem[];
		post?: any;
		appId?: string;
		instanceId?: any;
		accessLevel?: string;
		boardSlug?: string;
	}

	let {
		bindings = [],
		post = null,
		appId = 'board',
		instanceId = null,
		accessLevel = 'PROTECTED',
		boardSlug = ''
	}: Props = $props();

	const engineMap = engines as Record<string, any>;

	interface RenderedRow {
		rowKey: string;
		display: 'block' | 'inline' | 'grid-2';
		wrap: boolean;
		align: 'start' | 'between' | 'end';
		items: ServiceBindingItem[];
	}

	/**
	 * bindings를 layout.row 순서대로 그룹화합니다.
	 * (같은 row 번호를 가진 모듈들은 하나의 div 컨테이너로 묶임)
	 */
	let groupedRows = $derived.by<RenderedRow[]>(() => {
		const validBindings = (bindings || []).filter(
			(b) => b && b.service_component && engineMap[b.service_component]
		);
		const rows: RenderedRow[] = [];
		const rowIndexMap = new Map<number, number>();

		validBindings.forEach((b, idx) => {
			const layout = b.layout || {};
			const rowNum = typeof layout.row === 'number' ? layout.row : idx;
			const display =
				layout.display === 'inline' || layout.display === 'grid-2' ? layout.display : 'block';
			const wrap = layout.wrap !== false;
			const align =
				layout.align === 'between' || layout.align === 'end' ? layout.align : 'start';

			// 같은 rowNum을 가진 모듈들은 display 방식과 무관하게 항상 하나의 행(div)으로 그룹화
			if (rowIndexMap.has(rowNum)) {
				const existingIdx = rowIndexMap.get(rowNum)!;
				rows[existingIdx].items.push(b);
			} else {
				const newIdx = rows.length;
				rowIndexMap.set(rowNum, newIdx);
				rows.push({
					rowKey: `row-${rowNum}-${idx}`,
					display,
					wrap,
					align,
					items: [b]
				});
			}
		});

		return rows;
	});

	function getInlineAlignClass(align: 'start' | 'between' | 'end'): string {
		if (align === 'between') return 'justify-between';
		if (align === 'end') return 'justify-end';
		return 'justify-start';
	}
</script>

{#if groupedRows.length > 0}
	<div class="mt-8 space-y-6 pb-16">
		{#each groupedRows as row (row.rowKey)}
			{#if row.display === 'inline'}
				<!-- 🟢 인라인(가로 나란히) div 컨테이너 (데스크톱에서 한 줄 나란히 배치, 모바일은 자연스럽게 줄바꿈) -->
				{#if row.wrap}
					<div
						class="board-fullbleed-card flex flex-wrap md:flex-nowrap items-start gap-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 {getInlineAlignClass(row.align)}"
						in:fly={{ y: 16, duration: 300 }}
					>
						{#each row.items as binding, idx (`${binding.engine_id}-${binding.app_id ?? idx}`)}
							{@const DynComp = engineMap[binding.service_component]}
							<div class="min-w-0 {row.items.length > 1 ? 'w-full md:w-auto md:flex-1' : 'w-full'}">
								<DynComp
									{post}
									{appId}
									{instanceId}
									config={binding.config}
									{accessLevel}
									{boardSlug}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="flex flex-wrap md:flex-nowrap items-stretch gap-4 {getInlineAlignClass(row.align)}"
						in:fly={{ y: 16, duration: 300 }}
					>
						{#each row.items as binding, idx (`${binding.engine_id}-${binding.app_id ?? idx}`)}
							{@const DynComp = engineMap[binding.service_component]}
							<div class="min-w-0 {row.items.length > 1 ? 'w-full md:w-auto md:flex-1' : 'w-full'} rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm">
								<DynComp
									{post}
									{appId}
									{instanceId}
									config={binding.config}
									{accessLevel}
									{boardSlug}
								/>
							</div>
						{/each}
					</div>
				{/if}
			{:else if row.display === 'grid-2'}
				<!-- 🟣 2단 분할(Grid) div 컨테이너 -->
				{#if row.wrap}
					<div
						class="board-fullbleed-card grid grid-cols-1 gap-6 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 sm:p-6"
						in:fly={{ y: 16, duration: 300 }}
					>
						{#each row.items as binding, idx (`${binding.engine_id}-${binding.app_id ?? idx}`)}
							{@const DynComp = engineMap[binding.service_component]}
							<div class="min-w-0">
								<DynComp
									{post}
									{appId}
									{instanceId}
									config={binding.config}
									{accessLevel}
									{boardSlug}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="grid grid-cols-1 gap-5 md:grid-cols-2"
						in:fly={{ y: 16, duration: 300 }}
					>
						{#each row.items as binding, idx (`${binding.engine_id}-${binding.app_id ?? idx}`)}
							{@const DynComp = engineMap[binding.service_component]}
							<div class="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6">
								<DynComp
									{post}
									{appId}
									{instanceId}
									config={binding.config}
									{accessLevel}
									{boardSlug}
								/>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- 🔵 블록(Block) div 컨테이너 (같은 행에 여러 모듈이 있으면 하나의 카드 div 안에 구분선으로 통합) -->
				{#if row.wrap}
					<div
						class="board-fullbleed-card divide-y divide-slate-100 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm"
						in:fly={{ y: 16, duration: 300 }}
					>
						{#each row.items as binding, idx (`${binding.engine_id}-${binding.app_id ?? idx}`)}
							{@const DynComp = engineMap[binding.service_component]}
							<div class="min-w-0 {idx > 0 ? 'pt-5 mt-5' : ''}">
								<DynComp
									{post}
									{appId}
									{instanceId}
									config={binding.config}
									{accessLevel}
									{boardSlug}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div class="space-y-4" in:fly={{ y: 16, duration: 300 }}>
						{#each row.items as binding, idx (`${binding.engine_id}-${binding.app_id ?? idx}`)}
							{@const DynComp = engineMap[binding.service_component]}
							<div class="min-w-0">
								<DynComp
									{post}
									{appId}
									{instanceId}
									config={binding.config}
									{accessLevel}
									{boardSlug}
								/>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{/each}
	</div>
{/if}
