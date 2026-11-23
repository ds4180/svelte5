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
	let selectedVehicle = $state('');
	let targetFilter = $state<'ALL' | 'DONE' | 'MISSING'>('ALL');
	let targetSearch = $state('');

	const filteredTargetItems = $derived(
		(campaign?.target_status?.items || []).filter((item) => {
			if (targetFilter === 'DONE' && !item.is_submitted) return false;
			if (targetFilter === 'MISSING' && item.is_submitted) return false;
			const q = targetSearch.trim().toLowerCase();
			if (!q) return true;
			const inLabel = item.label.toLowerCase().includes(q);
			const inSub = (item.sub_label || '').toLowerCase().includes(q);
			const inSubmitter = (item.submitters || []).some((s) =>
				(s.name || '').toLowerCase().includes(q)
			);
			return inLabel || inSub || inSubmitter;
		})
	);

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
		<div
			class="rounded-3xl border-2 border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-400"
		>
			조사 양식을 불러오는 중...
		</div>
	{:else if errorMsg}
		<div class="rounded-3xl border-2 border-rose-200 bg-rose-50 p-8 text-center">
			<p class="text-sm font-black text-rose-700">{errorMsg}</p>
			<a
				href="/v1/custom/survey"
				class="mt-4 inline-block rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white"
			>
				목록으로 돌아가기
			</a>
		</div>
	{:else if campaign}
		<SurveyFormEngine
			{campaign}
			{vehicleContext}
			bind:selectedVehicle
			sourceAppId="survey"
			onSubmitted={async () => {
				if (campaign?.submit_scope === 'VEHICLE') {
					await loadDetail();
				} else {
					goto('/v1/custom/survey');
				}
			}}
		/>

		<!-- 차량별 조사 등 복수 응답 시 내 제출 내역 요약 -->
		{#if campaign.my_responses && campaign.my_responses.length > 0}
			<div class="rounded-2xl border border-slate-200 bg-white p-5">
				<h4 class="text-xs font-black text-slate-800">
					내 제출 이력 ({campaign.my_responses.length}건)
				</h4>
				<div class="mt-3 space-y-2">
					{#each campaign.my_responses as r}
						<div
							class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
						>
							<div class="flex items-center gap-2">
								{#if r.vehicle_no}
									<span class="rounded-md bg-indigo-100 px-2 py-0.5 font-black text-indigo-700"
										>{r.vehicle_no}호</span
									>
								{/if}
								<span class="font-bold text-slate-700">{r.updated_at || r.submitted_at}</span>
							</div>
							<span
								class="rounded-full px-2 py-0.5 text-[11px] font-black {r.has_issue
									? 'bg-rose-100 text-rose-700'
									: 'bg-emerald-100 text-emerald-700'}"
							>
								{r.has_issue ? '이상/교체 보고' : '정상'}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 전체 대상 리스트 · 작성 여부 및 작성자 정보 -->
		{#if campaign.target_status}
			{@const ts = campaign.target_status}
			<div class="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-5">
				<div
					class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"
				>
					<div>
						<h4 class="text-sm font-black text-slate-900">
							전체 대상 현황 ({ts.completed_count} / {ts.target_count}{ts.target_scope === 'VEHICLE'
								? '대'
								: '명'} · {ts.response_rate}%)
						</h4>
						<p class="mt-0.5 text-[11px] font-medium text-slate-500">
							{ts.target_scope === 'VEHICLE'
								? '대상 차량 전체 목록과 작성 여부·작성자 정보입니다. (차량을 클릭하면 위 양식에 선택됩니다)'
								: '조사 대상 사원 전체 목록과 작성 여부입니다.'}
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-1.5">
						{#each [{ id: 'ALL', label: `전체 (${ts.target_count})` }, { id: 'DONE', label: `작성완료 (${ts.completed_count})` }, { id: 'MISSING', label: `미작성 (${ts.missing_count})` }] as tab (tab.id)}
							<button
								type="button"
								onclick={() => (targetFilter = tab.id as 'ALL' | 'DONE' | 'MISSING')}
								class="rounded-lg px-2.5 py-1 text-[11px] font-black transition {targetFilter ===
								tab.id
									? 'bg-indigo-600 text-white'
									: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
							>
								{tab.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<input
						type="text"
						bind:value={targetSearch}
						placeholder={ts.target_scope === 'VEHICLE'
							? '차량번호, 노선, 작성자 검색...'
							: '사원명, 그룹 검색...'}
						class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none"
					/>
				</div>

				<div
					class="max-h-[420px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200"
				>
					{#each filteredTargetItems as item (item.target_key)}
						<div
							role={ts.target_scope === 'VEHICLE' && campaign.status === 'OPEN'
								? 'button'
								: undefined}
							tabindex={ts.target_scope === 'VEHICLE' && campaign.status === 'OPEN' ? 0 : undefined}
							onclick={() => {
								if (ts.target_scope === 'VEHICLE' && campaign?.status === 'OPEN') {
									selectedVehicle = item.target_key;
									window.scrollTo({ top: 0, behavior: 'smooth' });
								}
							}}
							onkeydown={(e) => {
								if (
									(e.key === 'Enter' || e.key === ' ') &&
									ts.target_scope === 'VEHICLE' &&
									campaign?.status === 'OPEN'
								) {
									e.preventDefault();
									selectedVehicle = item.target_key;
									window.scrollTo({ top: 0, behavior: 'smooth' });
								}
							}}
							class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs transition {ts.target_scope ===
								'VEHICLE' && campaign.status === 'OPEN'
								? 'cursor-pointer hover:bg-indigo-50/50'
								: ''} {selectedVehicle === item.target_key ? 'bg-indigo-50/70' : ''}"
						>
							<div class="flex items-center gap-2">
								<span class="font-black text-slate-900">{item.label}</span>
								{#if item.sub_label}
									<span
										class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
									>
										{item.sub_label}
									</span>
								{/if}
							</div>

							<div class="flex flex-wrap items-center gap-2">
								{#if item.submitters && item.submitters.length > 0}
									<div class="flex flex-wrap items-center gap-1.5">
										{#each item.submitters as sub (sub.response_id)}
											<span
												class="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
											>
												{sub.name}{sub.group ? ` (${sub.group})` : ''}
												{#if sub.submitted_at}
													<span class="ml-1 text-[10px] font-normal text-slate-400">
														{sub.submitted_at}
													</span>
												{/if}
											</span>
										{/each}
									</div>
								{:else}
									<span class="text-[11px] font-medium text-slate-400">작성자 없음</span>
								{/if}

								{#if item.is_submitted}
									<span
										class="rounded-full px-2.5 py-0.5 text-[10px] font-black {item.has_issue
											? 'bg-rose-100 text-rose-700'
											: 'bg-emerald-100 text-emerald-700'}"
									>
										{item.has_issue ? '이상/교체' : '작성완료'}
									</span>
								{:else}
									<span
										class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800"
									>
										미작성
									</span>
								{/if}
							</div>
						</div>
					{:else}
						<div class="py-8 text-center text-xs font-bold text-slate-400">
							조건에 해당하는 대상이 없습니다.
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
