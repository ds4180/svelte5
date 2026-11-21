<script lang="ts">
	/**
	 * ============================================================================
	 * [조사·설문 통계 보고 및 원장 탐색기 (SurveyStatsReport.svelte)]
	 * ============================================================================
	 */
	import * as surveyApi from '$lib/api/survey';
	import type { SurveyCampaign, SurveyResponseItem } from '$lib/api/survey';
	import Chart from '$lib/components/Chart.svelte';
	import PrintAssist from '$lib/components/PrintAssist.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	interface Props {
		campaign: SurveyCampaign;
		onClose?: () => void;
	}

	let { campaign, onClose }: Props = $props();

	let loading = $state(true);
	let stats = $state<any>(null);
	let responses = $state<SurveyResponseItem[]>([]);
	let onlyIssue = $state(false);
	let keyword = $state('');
	let reminding = $state(false);

	async function loadReport() {
		loading = true;
		try {
			const [statsRes, respRes] = await Promise.all([
				surveyApi.adminGetSurveyStats(campaign.id),
				surveyApi.adminGetSurveyResponses(campaign.id, {
					only_issue: onlyIssue,
					keyword: keyword.trim() || undefined
				})
			]);
			stats = statsRes.stats;
			responses = respRes.responses || [];
		} catch (e) {
			toast.error('통계/응답 로드 실패: ' + formatApiError(e, '오류'));
		} finally {
			loading = false;
		}
	}

	async function loadResponsesOnly() {
		try {
			const respRes = await surveyApi.adminGetSurveyResponses(campaign.id, {
				only_issue: onlyIssue,
				keyword: keyword.trim() || undefined
			});
			responses = respRes.responses || [];
		} catch (e) {
			toast.error('응답 필터 조회 실패: ' + formatApiError(e, '오류'));
		}
	}

	async function handleRemind() {
		if (reminding) return;
		reminding = true;
		try {
			const res = await surveyApi.adminRemindSurveyMissing(campaign.id);
			toast.success(res.message);
		} catch (e) {
			toast.error('독촉 발송 실패: ' + formatApiError(e, '오류'));
		} finally {
			reminding = false;
		}
	}

	function formatAnswerValue(val: any): string {
		if (val === null || val === undefined || val === '') return '-';
		if (Array.isArray(val)) return val.length ? val.join(', ') : '-';
		if (typeof val === 'object') {
			return Object.entries(val)
				.map(([k, v]) => `${k}:${v}`)
				.join(' / ');
		}
		return String(val);
	}

	$effect(() => {
		if (campaign?.id) {
			loadReport();
		}
	});
</script>

<div class="space-y-6">
	<!-- 상단 툴바 -->
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 print:hidden">
		<div>
			<div class="flex items-center gap-2">
				<span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">{campaign.code}</span>
				<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">{campaign.category}</span>
			</div>
			<h2 class="mt-1 text-xl font-black text-slate-900">{campaign.title} — 통계 & 보고</h2>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={handleRemind}
				disabled={reminding || !stats?.summary?.missing_count}
				class="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-40"
			>
				<Icon icon="solar:bell-bing-bold" class="text-sm" />
				<span>미제출자 독촉 푸시 ({stats?.summary?.missing_count ?? 0}명)</span>
			</button>
			<a
				href={surveyApi.getSurveyCsvDownloadUrl(campaign.id)}
				class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
			>
				<Icon icon="solar:file-download-bold" class="text-sm" />
				<span>CSV 다운로드</span>
			</a>
			<PrintAssist title="{campaign.title} 결과 보고서" />
			{#if onClose}
				<button
					type="button"
					onclick={onClose}
					class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
				>
					닫기
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="py-16 text-center text-sm font-bold text-slate-400">통계 데이터를 분석하고 있습니다...</div>
	{:else if stats}
		<!-- 1. KPI 카드 -->
		<div data-print-section="조사 요약 통계" class="grid grid-cols-2 gap-4 md:grid-cols-4">
			<div class="rounded-2xl border-2 border-slate-200 bg-white p-4">
				<div class="text-xs font-black text-slate-400">응답률</div>
				<div class="mt-2 text-3xl font-black text-indigo-600">{stats.summary.response_rate}%</div>
				<div class="mt-1 text-xs font-bold text-slate-500">
					대상 {stats.summary.target_count}명 중 {stats.summary.submitted_user_count}명 참여
				</div>
			</div>
			<div class="rounded-2xl border-2 border-slate-200 bg-white p-4">
				<div class="text-xs font-black text-slate-400">총 제출 건수</div>
				<div class="mt-2 text-3xl font-black text-slate-900">{stats.summary.submitted_count}건</div>
				<div class="mt-1 text-xs font-bold text-slate-500">{campaign.submit_scope === 'VEHICLE' ? '차량 단위 집계' : '사원 단위 집계'}</div>
			</div>
			<div class="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-4">
				<div class="text-xs font-black text-rose-500">이상 / 교체 필요</div>
				<div class="mt-2 text-3xl font-black text-rose-600">{stats.summary.issue_count}건</div>
				<div class="mt-1 text-xs font-bold text-rose-500">즉시 확인·조치 대상</div>
			</div>
			<div class="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4">
				<div class="text-xs font-black text-amber-600">미제출 인원</div>
				<div class="mt-2 text-3xl font-black text-amber-700">{stats.summary.missing_count}명</div>
				<div class="mt-1 text-xs font-bold text-amber-600">독촉 알림 발송 가능</div>
			</div>
		</div>

		<!-- 2. 문항별 통계 & 차트 -->
		<div data-print-section="문항별 상세 집계" class="grid grid-cols-1 gap-5 lg:grid-cols-2">
			{#each stats.fields || [] as f}
				<div class="rounded-2xl border-2 border-slate-200 bg-white p-5">
					<h3 class="text-sm font-black text-slate-900">{f.label}</h3>

					{#if f.distribution}
						<div class="mt-3 h-52">
							<Chart
								type="bar"
								containerClass="relative h-full w-full"
								data={{
									labels: f.distribution.map((d: any) => d.option),
									datasets: [
										{
											label: '응답 수',
											data: f.distribution.map((d: any) => d.count),
											backgroundColor: f.distribution.map((d: any) =>
												d.is_issue ? 'rgba(225, 29, 72, 0.78)' : 'rgba(79, 70, 229, 0.78)'
											),
											borderRadius: 8
										}
									]
								}}
								options={{
									plugins: { legend: { display: false } },
									scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
								}}
							/>
						</div>
						<div class="mt-3 flex flex-wrap gap-2">
							{#each f.distribution as d}
								<span
									class="rounded-lg px-2.5 py-1 text-xs font-bold {d.is_issue
										? 'bg-rose-50 text-rose-700'
										: 'bg-slate-100 text-slate-700'}"
								>
									{d.option}: <strong>{d.count}건</strong> ({d.ratio}%)
								</span>
							{/each}
						</div>
					{:else if f.type === 'number'}
						<div class="mt-4 grid grid-cols-3 gap-3 text-center">
							<div class="rounded-xl bg-slate-50 p-3">
								<div class="text-[11px] font-bold text-slate-500">총합</div>
								<div class="mt-1 text-xl font-black text-indigo-600">{f.aggregates?.sum ?? 0}{f.unit || ''}</div>
							</div>
							<div class="rounded-xl bg-slate-50 p-3">
								<div class="text-[11px] font-bold text-slate-500">평균</div>
								<div class="mt-1 text-xl font-black text-slate-900">{f.aggregates?.avg ?? 0}{f.unit || ''}</div>
							</div>
							<div class="rounded-xl bg-slate-50 p-3">
								<div class="text-[11px] font-bold text-slate-500">응답수</div>
								<div class="mt-1 text-xl font-black text-slate-900">{f.answered_count}건</div>
							</div>
						</div>
					{:else if f.type === 'number_group'}
						<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
							{#each Object.entries(f.aggregates || {}) as [_, sub]}
								{@const subAgg = sub as any}
								<div class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
									<span class="text-xs font-black text-slate-800">{subAgg.label}</span>
									<span class="text-sm font-black text-indigo-700">
										합계 {subAgg.sum}{subAgg.unit} <span class="text-xs font-bold text-slate-500">(평균 {subAgg.avg})</span>
									</span>
								</div>
							{/each}
						</div>
					{:else if f.type === 'photo'}
						<div class="mt-3 text-xs font-bold text-slate-600">
							사진 첨부 응답 {f.answered_count}건 (총 {f.total_photos}장)
						</div>
					{:else}
						<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
							{#each f.samples || [] as s}
								<div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
									<span class="font-bold text-slate-700">
										{s.submitter}{s.vehicle_no ? ` (${s.vehicle_no}호)` : ''}
									</span>
									<span class="max-w-[65%] truncate font-medium text-slate-600">{s.value}</span>
								</div>
							{:else}
								<div class="text-xs text-slate-400">작성된 응답이 없습니다.</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- 3. 미제출자 목록 -->
		{#if stats.summary.missing_users?.length > 0}
			<div class="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 print:hidden">
				<div class="mb-2 text-xs font-black text-amber-800">미제출자 명단 ({stats.summary.missing_users.length}명)</div>
				<div class="flex flex-wrap gap-1.5">
					{#each stats.summary.missing_users as u}
						<span class="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
							{u.real_name}{u.primary_group ? ` (${u.primary_group})` : ''}
						</span>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 4. 개별 응답 원장 테이블 -->
		<div data-print-section="개별 응답 원장" class="rounded-2xl border-2 border-slate-200 bg-white p-5">
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
				<h3 class="text-sm font-black text-slate-900">개별 응답 상세 ({responses.length}건)</h3>
				<div class="flex flex-wrap items-center gap-2">
					<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">
						<input
							type="checkbox"
							bind:checked={onlyIssue}
							onchange={loadResponsesOnly}
							class="rounded text-rose-600"
						/>
						<span>이상/교체 필요 건만 보기</span>
					</label>
					<input
						type="text"
						bind:value={keyword}
						onkeydown={(e) => e.key === 'Enter' && loadResponsesOnly()}
						placeholder="기사명, 차량번호, 답변 검색..."
						class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-500 focus:outline-none"
					/>
					<button
						type="button"
						onclick={loadResponsesOnly}
						class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-700"
					>
						검색
					</button>
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-slate-200 text-xs">
					<thead class="bg-slate-50 text-left font-black text-slate-600">
						<tr>
							<th class="px-3 py-2.5">제출자</th>
							{#if campaign.submit_scope === 'VEHICLE'}
								<th class="px-3 py-2.5">차량번호</th>
							{/if}
							<th class="px-3 py-2.5">상태</th>
							{#each campaign.form_schema || [] as field}
								<th class="px-3 py-2.5">{field.label}</th>
							{/each}
							<th class="px-3 py-2.5">제출일시</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each responses as r}
							<tr class="hover:bg-slate-50/70">
								<td class="px-3 py-2.5 font-bold text-slate-900">
									{r.submitter_name}
									{#if r.submitter_group}
										<span class="ml-1 text-[10px] font-medium text-slate-400">({r.submitter_group})</span>
									{/if}
								</td>
								{#if campaign.submit_scope === 'VEHICLE'}
									<td class="px-3 py-2.5 font-black text-indigo-700">{r.vehicle_no || '-'}</td>
								{/if}
								<td class="px-3 py-2.5">
									{#if r.has_issue}
										<span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">이상/교체</span>
									{:else}
										<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">정상</span>
									{/if}
								</td>
								{#each campaign.form_schema || [] as field}
									<td class="max-w-xs px-3 py-2.5 font-medium text-slate-700">
										{formatAnswerValue(r.answers?.[field.key])}
									</td>
								{/each}
								<td class="px-3 py-2.5 text-slate-500">{r.updated_at || r.submitted_at}</td>
							</tr>
						{:else}
							<tr>
								<td colspan={5 + (campaign.form_schema?.length || 0)} class="py-10 text-center font-bold text-slate-400">
									조건에 해당하는 응답 내역이 없습니다.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
