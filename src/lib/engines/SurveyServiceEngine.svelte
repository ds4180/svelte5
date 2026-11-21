<script lang="ts">
	/**
	 * ============================================================================
	 * [조사·설문 서비스 앱 어댑터 엔진 (SurveyServiceEngine.svelte)]
	 * ============================================================================
	 * - 게시판(BoardEngine) 또는 페이지(PageEngine)에 ServiceBinding으로 장착되어
	 *   특정 조사 캠페인(config.campaign_code / config.campaign_id / post.extra_data)
	 *   또는 현재 진행 중인 조사 목록을 인라인 렌더링합니다.
	 */
	import * as surveyApi from '$lib/api/survey';
	import type { SurveyCampaign, SurveyVehicleContext } from '$lib/api/survey';
	import SurveyFormEngine from '$lib/components/survey/SurveyFormEngine.svelte';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let {
		post = null,
		config = {} as {
			campaign_code?: string;
			campaign_id?: number | string | null;
			compact?: boolean;
		},
		appId = 'board',
		instanceId = null
	} = $props();

	let loading = $state(true);
	let errorMsg = $state('');
	let campaign = $state<SurveyCampaign | null>(null);
	let openCampaigns = $state<SurveyCampaign[]>([]);
	let vehicleContext = $state<SurveyVehicleContext | null>(null);

	const resolvedCode = $derived(
		post?.extra_data?.survey_code || post?.extra_data?.campaign_code || config?.campaign_code || ''
	);
	const resolvedId = $derived(
		post?.extra_data?.survey_id || post?.extra_data?.campaign_id || config?.campaign_id || null
	);

	async function loadAttachedSurvey() {
		loading = true;
		errorMsg = '';
		try {
			if (resolvedCode) {
				const res = await surveyApi.getSurveyByCode(String(resolvedCode));
				campaign = res.campaign;
				vehicleContext = res.vehicle_context;
				openCampaigns = [];
			} else if (resolvedId) {
				const res = await surveyApi.getSurveyDetail(resolvedId);
				campaign = res.campaign;
				vehicleContext = res.vehicle_context;
				openCampaigns = [];
			} else {
				const res = await surveyApi.getMySurveys(false);
				openCampaigns = (res.campaigns || []).filter((c) => c.status === 'OPEN');
				vehicleContext = res.vehicle_context;
				campaign = openCampaigns[0] || null;
			}
		} catch (e) {
			errorMsg = formatApiError(e, '조사 양식을 불러올 수 없습니다.');
		} finally {
			loading = false;
		}
	}

	async function selectOpenCampaign(c: SurveyCampaign) {
		try {
			const res = await surveyApi.getSurveyDetail(c.id);
			campaign = res.campaign;
			vehicleContext = res.vehicle_context;
		} catch (e) {
			errorMsg = formatApiError(e, '조사 양식을 불러올 수 없습니다.');
		}
	}

	$effect(() => {
		// resolvedCode / resolvedId / post.id 변경 시 자동 재조회
		void post?.id;
		void resolvedCode;
		void resolvedId;
		loadAttachedSurvey();
	});
</script>

<div class="my-4 space-y-3">
	{#if loading}
		<div class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">
			연동된 현장 조사 양식을 불러오는 중...
		</div>
	{:else if errorMsg}
		<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
			{errorMsg}
		</div>
	{:else if campaign}
		{#if openCampaigns.length > 1}
			<div class="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-2.5">
				<span class="inline-flex items-center gap-1 text-xs font-black text-indigo-800">
					<Icon icon="solar:clipboard-list-bold" class="text-sm" />
					진행 중 조사 선택:
				</span>
				{#each openCampaigns as item}
					<button
						type="button"
						onclick={() => selectOpenCampaign(item)}
						class="rounded-xl px-3 py-1 text-xs font-black transition {campaign.id === item.id
							? 'bg-indigo-600 text-white shadow-sm'
							: 'bg-white text-slate-700 hover:bg-indigo-100'}"
					>
						{item.title}
					</button>
				{/each}
			</div>
		{/if}
		<SurveyFormEngine
			{campaign}
			{vehicleContext}
			sourceAppId={appId}
			sourceRefId={post?.id ? String(post.id) : instanceId ? String(instanceId) : null}
			compact={config?.compact !== false}
			onSubmitted={() => loadAttachedSurvey()}
		/>
	{:else}
		<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
			현재 진행 중인 현장 조사가 없습니다.
		</div>
	{/if}
</div>
