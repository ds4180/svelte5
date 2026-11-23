<script lang="ts">
	/**
	 * ============================================================================
	 * [현장 조사·설문 참여 허브 (/v1/custom/survey/+page.svelte)]
	 * ============================================================================
	 */
	import { onMount } from 'svelte';
	import * as surveyApi from '$lib/api/survey';
	import type { SurveyCampaign } from '$lib/api/survey';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let loading = $state(true);
	let campaigns = $state<SurveyCampaign[]>([]);
	let activeTab = $state<'OPEN' | 'CLOSED' | 'ALL'>('OPEN');

	async function loadSurveys() {
		loading = true;
		try {
			const res = await surveyApi.getMySurveys(true);
			campaigns = res.campaigns || [];
		} catch (e) {
			toast.error('조사 목록을 불러오지 못했습니다: ' + formatApiError(e, '오류'));
		} finally {
			loading = false;
		}
	}

	const filtered = $derived(
		campaigns.filter((c) => {
			if (activeTab === 'ALL') return true;
			return c.status === activeTab;
		})
	);

	const openCount = $derived(campaigns.filter((c) => c.status === 'OPEN').length);
	const unsubmittedOpenCount = $derived(
		campaigns.filter((c) => c.status === 'OPEN' && !(c.my_responses && c.my_responses.length > 0))
			.length
	);

	function stripHtml(html?: string | null): string {
		if (!html) return '';
		return html
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	onMount(loadSurveys);
</script>

<svelte:head>
	<title>{getSiteTitle('현장 조사·설문')}</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 px-4 py-8 pb-24 sm:px-6 lg:px-8">
	<!-- 헤더 -->
	<div
		class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-black tracking-wider text-white uppercase"
				>
					<Icon icon="solar:clipboard-check-bold" class="text-xs" />
					Field Survey
				</span>
				<span class="text-xs font-bold text-slate-400">/v1/custom/survey</span>
			</div>
			<h1 class="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
				현장 <span class="text-indigo-600">조사·설문</span> 참여
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				사무실에서 요청한 차량·안전·업무 현황 양식을 작성하고 과거 참여 이력을 확인합니다.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={loadSurveys}
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
			>
				<Icon icon="solar:refresh-bold" class="text-sm" />
				<span>새로고침</span>
			</button>
			<a
				href="/v1"
				class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-slate-700"
			>
				<Icon icon="solar:home-2-bold" class="text-sm" />
				<span>홈으로</span>
			</a>
		</div>
	</div>

	<!-- 요약 배너 -->
	{#if unsubmittedOpenCount > 0}
		<div
			class="flex items-center justify-between rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-3.5"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white">
					<Icon icon="solar:bell-bing-bold" class="text-lg" />
				</div>
				<div>
					<div class="text-sm font-black text-amber-900">
						미제출 현장 조사가 {unsubmittedOpenCount}건 있습니다.
					</div>
					<div class="text-xs font-medium text-amber-700">
						카드를 눌러 양식을 작성하고 제출해 주세요.
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- 탭 필터 -->
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={() => (activeTab = 'OPEN')}
			class="rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'OPEN'
				? 'bg-indigo-600 text-white shadow-sm'
				: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
		>
			진행중 ({openCount})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'CLOSED')}
			class="rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'CLOSED'
				? 'bg-indigo-600 text-white shadow-sm'
				: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
		>
			마감·과거이력 ({campaigns.filter((c) => c.status === 'CLOSED').length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'ALL')}
			class="rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'ALL'
				? 'bg-indigo-600 text-white shadow-sm'
				: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
		>
			전체 ({campaigns.length})
		</button>
	</div>

	{#if loading}
		<div class="py-16 text-center text-sm font-bold text-slate-400">조사 목록을 불러오는 중...</div>
	{:else if filtered.length === 0}
		<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
			<Icon icon="solar:clipboard-list-bold-duotone" class="mx-auto text-4xl text-slate-300" />
			<p class="mt-3 text-sm font-bold text-slate-500">해당 상태의 현장 조사가 없습니다.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each filtered as c}
				{@const respList = c.my_responses || []}
				{@const hasSubmitted = respList.length > 0}
				{@const hasIssue = respList.some((r) => r.has_issue)}
				<a
					href="/v1/custom/survey/{c.id}"
					class="group flex flex-col justify-between rounded-3xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md {hasSubmitted
						? 'border-slate-200'
						: 'border-indigo-200 bg-indigo-50/15'}"
				>
					<div>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-1.5">
								<span
									class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-700"
								>
									{c.submit_scope === 'VEHICLE' ? '차량별' : '사원별'}
								</span>
								<span
									class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700"
								>
									{c.category}
								</span>
							</div>
							{#if hasSubmitted}
								<span
									class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black {hasIssue
										? 'bg-rose-100 text-rose-700'
										: 'bg-emerald-100 text-emerald-700'}"
								>
									<Icon icon="solar:check-circle-bold" class="text-xs" />
									{c.submit_scope === 'VEHICLE' ? `${respList.length}대 제출됨` : '제출 완료'}
								</span>
							{:else if c.status === 'OPEN'}
								<span
									class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800"
									>미제출</span
								>
							{:else}
								<span
									class="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-black text-slate-600"
									>마감</span
								>
							{/if}
						</div>

						<h2 class="mt-3 text-lg font-black text-slate-900 group-hover:text-indigo-700">
							{c.title}
						</h2>
						{#if stripHtml(c.description)}
							<p class="mt-1 line-clamp-2 text-xs font-medium text-slate-500">
								{stripHtml(c.description)}
							</p>
						{/if}
					</div>

					<div
						class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-slate-500"
					>
						<span>
							{#if c.due_at}
								마감: {c.due_at.replace('T', ' ').slice(0, 16)}
							{:else}
								상시 접수
							{/if}
							{#if c.target_count !== undefined}
								· 전체 진행 {c.response_count ?? 0}/{c.target_count}{c.submit_scope === 'VEHICLE'
									? '대'
									: '명'}
							{/if}
						</span>
						<span class="inline-flex items-center gap-1 font-black text-indigo-600">
							{hasSubmitted ? (c.status === 'OPEN' ? '확인 / 수정' : '내역 보기') : '작성하기'}
							<Icon icon="solar:alt-arrow-right-bold" class="text-sm" />
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
