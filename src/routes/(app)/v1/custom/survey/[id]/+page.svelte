<script lang="ts">
	/**
	 * ============================================================================
	 * [현장 조사·설문 작성/수정 상세 (/v1/custom/survey/[id]/+page.svelte)]
	 * ============================================================================
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import * as surveyApi from '$lib/api/survey';
	import type { SurveyCampaign, SurveyVehicleContext } from '$lib/api/survey';
	import SurveyFormEngine from '$lib/components/survey/SurveyFormEngine.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	const campaignId = $derived(page.params.id);

	let loading = $state(true);
	let errorMsg = $state('');
	let campaign = $state<SurveyCampaign | null>(null);
	let vehicleContext = $state<SurveyVehicleContext | null>(null);

	async function loadDetail() {
		if (!campaignId) return;
		loading = true;
		errorMsg = '';
		try {
			const res = await surveyApi.getSurveyDetail(campaignId);
			campaign = res.campaign;
			vehicleContext = res.vehicle_context;
		} catch (e) {
			errorMsg = formatApiError(e, '조사 양식을 불러올 수 없습니다.');
		} finally {
			loading = false;
		}
	}

	onMount(loadDetail);
</script>

<svelte:head>
	<title>{getSiteTitle(campaign?.title || '현장 조사 작성')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-24 sm:px-6">
	<div class="flex items-center justify-between">
		<a
			href="/v1/custom/survey"
			class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
		>
			<Icon icon="solar:alt-arrow-left-bold" class="text-sm" />
			<span>조사 목록으로</span>
		</a>
		<span class="text-xs font-bold text-slate-400">/v1/custom/survey/{campaignId}</span>
	</div>

	{#if loading}
		<div class="rounded-3xl border-2 border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-400">
			조사 양식을 불러오는 중...
		</div>
	{:else if errorMsg}
		<div class="rounded-3xl border-2 border-rose-200 bg-rose-50 p-8 text-center">
			<p class="text-sm font-black text-rose-700">{errorMsg}</p>
			<a href="/v1/custom/survey" class="mt-4 inline-block rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white">
				목록으로 돌아가기
			</a>
		</div>
	{:else if campaign}
		<SurveyFormEngine
			{campaign}
			{vehicleContext}
			sourceAppId="survey"
			onSubmitted={() => goto('/v1/custom/survey')}
		/>

		<!-- 차량별 조사 등 복수 응답 시 내 제출 내역 요약 -->
		{#if campaign.my_responses && campaign.my_responses.length > 0}
			<div class="rounded-2xl border border-slate-200 bg-white p-5">
				<h4 class="text-xs font-black text-slate-800">내 제출 이력 ({campaign.my_responses.length}건)</h4>
				<div class="mt-3 space-y-2">
					{#each campaign.my_responses as r}
						<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
							<div class="flex items-center gap-2">
								{#if r.vehicle_no}
									<span class="rounded-md bg-indigo-100 px-2 py-0.5 font-black text-indigo-700">{r.vehicle_no}호</span>
								{/if}
								<span class="font-bold text-slate-700">{r.updated_at || r.submitted_at}</span>
							</div>
							<span class="rounded-full px-2 py-0.5 text-[11px] font-black {r.has_issue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
								{r.has_issue ? '이상/교체 보고' : '정상'}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
