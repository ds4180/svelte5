<script lang="ts">
	/**
	 * ============================================================================
	 * [공용 동적 조사·설문 폼 엔진 (SurveyFormEngine.svelte)]
	 * ============================================================================
	 * - Standalone CUSTOM 앱(/v1/custom/survey/[id])과 SERVICE 앱(게시판/페이지 부착)
	 *   모두에서 동일한 JSONB 스키마를 렌더링하고 제출합니다.
	 */
	import { env } from '$env/dynamic/public';
	import * as surveyApi from '$lib/api/survey';
	import type {
		SurveyCampaign,
		SurveyFieldSchema,
		SurveyResponseItem,
		SurveyVehicleContext
	} from '$lib/api/survey';
	import { publishAssets, uploadFiles } from '$lib/services/mediaService';
	import { filterTargetVehicles } from '$lib/services/surveyAdminService';
	import { getSecureMediaUrl } from '$lib/config/media';
	import PersonalMediaPickerModal from '$lib/components/PersonalMediaPickerModal.svelte';
	import SafeHtml from '$lib/components/SafeHtml.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	interface Props {
		campaign: SurveyCampaign;
		vehicleContext?: SurveyVehicleContext | null;
		selectedVehicle?: string;
		sourceAppId?: string;
		sourceRefId?: string | null;
		compact?: boolean;
		previewMode?: boolean;
		onSubmitted?: (resp: SurveyResponseItem) => void;
	}

	let {
		campaign,
		vehicleContext = null,
		selectedVehicle = $bindable(''),
		sourceAppId = 'survey',
		sourceRefId = null,
		compact = false,
		previewMode = false,
		onSubmitted
	}: Props = $props();

	let answers = $state<Record<string, any>>({});
	let saving = $state(false);
	let uploadingKey = $state<string | null>(null);
	let pickerField = $state<SurveyFieldSchema | null>(null);
	let showPersonalPicker = $state(false);
	let lastSubmitted = $state<SurveyResponseItem | null>(null);

	const availableVehicles = $derived(
		filterTargetVehicles(vehicleContext?.vehicles || [], campaign?.options?.vehicle_target)
	);

	const myResponses = $derived(
		campaign.my_responses || (campaign.my_response ? [campaign.my_response] : [])
	);
	const isEditable = $derived(previewMode || campaign.status === 'OPEN');

	/** 초기값 및 기존 제출 데이터 바인딩 */
	function hydrateAnswers(existingResp: SurveyResponseItem | null) {
		const next: Record<string, any> = {};
		const existing = existingResp?.answers || {};

		for (const field of campaign.form_schema || []) {
			if (!field.key) continue;
			if (field.type === 'number_group') {
				const subObj: Record<string, any> = {};
				const prevSub =
					existing[field.key] && typeof existing[field.key] === 'object' ? existing[field.key] : {};
				for (const sub of field.fields || []) {
					subObj[sub.key] = prevSub[sub.key] ?? sub.default ?? 0;
				}
				next[field.key] = subObj;
			} else if (field.type === 'checkbox' || field.type === 'photo') {
				const prev = existing[field.key];
				next[field.key] = Array.isArray(prev) ? [...prev] : [];
			} else if (field.type === 'vehicle') {
				next[field.key] =
					existing[field.key] ?? selectedVehicle ?? vehicleContext?.my_default_vehicle ?? '';
			} else {
				next[field.key] = existing[field.key] ?? field.default ?? '';
			}
		}

		answers = next;
		lastSubmitted = existingResp;
	}

	$effect(() => {
		if (!campaign) return;
		if (campaign.submit_scope === 'VEHICLE') {
			const firstResp = myResponses[0] || null;
			const allowedSet = new Set(availableVehicles.map((v) => v.vehicle_no));
			const defaultVeh =
				vehicleContext?.my_default_vehicle && allowedSet.has(vehicleContext.my_default_vehicle)
					? vehicleContext.my_default_vehicle
					: '';
			const initVehicle =
				(selectedVehicle && (allowedSet.size === 0 || allowedSet.has(selectedVehicle))
					? selectedVehicle
					: '') ||
				(firstResp?.vehicle_no && (allowedSet.size === 0 || allowedSet.has(firstResp.vehicle_no))
					? firstResp.vehicle_no
					: '') ||
				defaultVeh ||
				availableVehicles[0]?.vehicle_no ||
				'';
			selectedVehicle = initVehicle;
			const matched = myResponses.find((r) => r.vehicle_no === initVehicle) || null;
			hydrateAnswers(matched);
		} else {
			hydrateAnswers(myResponses[0] || null);
		}
	});

	function handleVehicleChange(nextVno: string) {
		selectedVehicle = nextVno;
		const matched = myResponses.find((r) => r.vehicle_no === nextVno) || null;
		hydrateAnswers(matched);
	}

	function toggleCheckbox(key: string, opt: string) {
		const curr = Array.isArray(answers[key]) ? answers[key] : [];
		if (curr.includes(opt)) {
			answers[key] = curr.filter((x: string) => x !== opt);
		} else {
			answers[key] = [...curr, opt];
		}
	}

	async function handlePhotoUpload(field: SurveyFieldSchema, e: Event) {
		const input = e.target as HTMLInputElement;
		const selected = input.files ? Array.from(input.files) : [];
		if (selected.length === 0) return;

		const maxFiles = field.max_files || 5;
		const currentList = Array.isArray(answers[field.key]) ? answers[field.key] : [];
		if (currentList.length + selected.length > maxFiles) {
			toast.warning(`최대 ${maxFiles}장까지 첨부할 수 있습니다.`);
			input.value = '';
			return;
		}

		uploadingKey = field.key;
		try {
			const uploaded = await uploadFiles(selected, {
				app_id: 'survey',
				access_level: 'PROTECTED',
				sub_path: `campaign_${campaign.id}`
			});
			const urls = (Array.isArray(uploaded) ? uploaded : [uploaded])
				.map((a: any) => a?.url || (a?.id ? `/api/media/view/${a.id}` : ''))
				.filter(Boolean);
			answers[field.key] = [...currentList, ...urls];
			toast.success(`${urls.length}장의 사진이 업로드되었습니다.`);
		} catch (err) {
			toast.error('사진 업로드 실패: ' + formatApiError(err, '오류'));
		} finally {
			uploadingKey = null;
			input.value = '';
		}
	}

	function removePhoto(key: string, idx: number) {
		const curr = Array.isArray(answers[key]) ? answers[key] : [];
		answers[key] = curr.filter((_: any, i: number) => i !== idx);
	}

	async function handlePersonalPhotosPicked(pickedAssets: any[]) {
		if (!pickerField || !Array.isArray(pickedAssets) || pickedAssets.length === 0) return;
		const field = pickerField;
		const maxFiles = field.max_files || 5;
		const currentList = Array.isArray(answers[field.key]) ? answers[field.key] : [];
		if (currentList.length + pickedAssets.length > maxFiles) {
			toast.warning(`최대 ${maxFiles}장까지 첨부할 수 있습니다.`);
			return;
		}
		uploadingKey = field.key;
		try {
			const assetIds = pickedAssets
				.map((a) => Number(a.id))
				.filter((id) => Number.isFinite(id) && id > 0);
			const published = await publishAssets<any[]>({
				asset_ids: assetIds,
				app_id: 'survey',
				access_level: 'PROTECTED',
				sub_path: `campaign_${campaign.id}`
			});
			const urls = (Array.isArray(published) ? published : [published])
				.map((a: any) => a?.url || (a?.id ? `/api/media/serve/${a.id}` : ''))
				.filter(Boolean);
			answers[field.key] = [...currentList, ...urls];
			toast.success(`${urls.length}장의 사진이 내 파일함에서 첨부되었습니다.`);
		} catch (err) {
			toast.error('개인 파일함 첨부 실패: ' + formatApiError(err, '오류'));
		} finally {
			uploadingKey = null;
			pickerField = null;
		}
	}

	async function handleSubmit() {
		if (previewMode) {
			toast.info('미리보기 모드입니다. 실제 응답은 저장되지 않습니다.');
			return;
		}
		if (saving || !isEditable) return;
		if (campaign.submit_scope === 'VEHICLE' && !selectedVehicle.trim()) {
			toast.warning('조사 대상 차량번호를 선택하거나 입력해 주세요.');
			return;
		}

		saving = true;
		try {
			const res = await surveyApi.submitSurveyResponse(campaign.id, {
				vehicle_no: campaign.submit_scope === 'VEHICLE' ? selectedVehicle.trim() : null,
				answers: $state.snapshot(answers),
				status: 'SUBMITTED',
				source_app_id: sourceAppId,
				source_ref_id: sourceRefId
			});
			lastSubmitted = res.response;
			toast.success(res.message || '응답이 저장되었습니다.');
			if (onSubmitted) {
				onSubmitted(res.response);
			}
		} catch (err) {
			toast.error('제출 실패: ' + formatApiError(err, '입력 내용을 확인해 주세요.'));
		} finally {
			saving = false;
		}
	}
</script>

<div
	class="space-y-5 {compact
		? 'rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5'
		: 'rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8'}"
>
	<!-- 상단 헤더 -->
	<div class="border-b border-slate-200 pb-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700"
					>
						{campaign.submit_scope === 'VEHICLE' ? '차량별 조사' : '사원별 조사'}
					</span>
					<span
						class="rounded-full px-2.5 py-0.5 text-[11px] font-black {campaign.status === 'OPEN'
							? 'bg-emerald-50 text-emerald-700'
							: 'bg-slate-200 text-slate-600'}"
					>
						{campaign.status === 'OPEN'
							? '진행중'
							: campaign.status === 'CLOSED'
								? '마감'
								: campaign.status}
					</span>
					{#if lastSubmitted}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-blue-700"
						>
							<Icon icon="solar:check-circle-bold" class="text-xs" />
							제출됨 ({lastSubmitted.updated_at})
						</span>
					{/if}
				</div>
				<h3 class="mt-2 text-lg font-black text-slate-900 sm:text-xl">{campaign.title}</h3>
			</div>

			{#if campaign.due_at}
				<div class="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
					<div class="text-[10px] font-black tracking-wider text-amber-600 uppercase">
						마감 일시
					</div>
					<div class="text-xs font-black text-amber-900">
						{campaign.due_at.replace('T', ' ').slice(0, 16)}
					</div>
				</div>
			{/if}
		</div>

		{#if campaign.description}
			<div class="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
				<SafeHtml
					html={campaign.description}
					class="prose prose-sm max-w-none text-slate-700 prose-slate"
				/>
			</div>
		{/if}
	</div>

	<!-- 차량별 조사인 경우 차량 선택기 -->
	{#if campaign.submit_scope === 'VEHICLE'}
		<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
			<label for="survey-vehicle-select" class="mb-2 block text-xs font-black text-slate-800">
				대상 차량 선택 <span class="text-rose-500">*</span>
				{#if myResponses.length > 0}
					<span class="ml-2 text-[11px] font-bold text-indigo-600"
						>(내 제출 차량: {myResponses.map((r) => r.vehicle_no).join(', ')})</span
					>
				{/if}
			</label>
			<div class="flex flex-wrap items-center gap-2">
				{#if availableVehicles.length}
					<select
						id="survey-vehicle-select"
						value={selectedVehicle}
						onchange={(e) => handleVehicleChange((e.target as HTMLSelectElement).value)}
						class="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
					>
						<option value="">-- 차량을 선택하세요 --</option>
						{#each availableVehicles as v}
							<option value={v.vehicle_no}>
								{v.vehicle_no}호 ({v.route}) {myResponses.some((r) => r.vehicle_no === v.vehicle_no)
									? '✅'
									: ''}
							</option>
						{/each}
					</select>
				{:else}
					<input
						id="survey-vehicle-select"
						type="text"
						value={selectedVehicle}
						oninput={(e) => handleVehicleChange((e.target as HTMLInputElement).value)}
						placeholder="차량번호 입력 (예: 291)"
						class="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
					/>
				{/if}
			</div>
		</div>
	{/if}

	<!-- 동적 질문 렌더링 -->
	<div class="space-y-4">
		{#each campaign.form_schema || [] as field, idx}
			<div
				class="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
			>
				<div class="mb-2.5 flex items-center justify-between gap-2">
					<span class="text-sm font-black text-slate-900">
						{idx + 1}. {field.label}
						{#if field.required}
							<span class="ml-1 text-rose-500">*</span>
						{/if}
					</span>
					{#if field.issue_values?.length}
						<span class="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600"
							>이상 체크 항목 포함</span
						>
					{/if}
				</div>

				{#if field.type === 'text'}
					<input
						type="text"
						disabled={!isEditable}
						bind:value={answers[field.key]}
						placeholder={field.placeholder || '내용을 입력해 주세요'}
						class="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60"
					/>
				{:else if field.type === 'textarea'}
					<textarea
						rows="3"
						disabled={!isEditable}
						bind:value={answers[field.key]}
						placeholder={field.placeholder || '상세 내용을 입력해 주세요'}
						class="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60"
					></textarea>
				{:else if field.type === 'number'}
					<div class="flex items-center gap-2">
						<input
							type="number"
							disabled={!isEditable}
							bind:value={answers[field.key]}
							class="w-36 rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-center text-sm font-black text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60"
						/>
						{#if field.unit}
							<span class="text-xs font-bold text-slate-600">{field.unit}</span>
						{/if}
					</div>
				{:else if field.type === 'number_group'}
					<div class="flex flex-wrap gap-3">
						{#each field.fields || [] as sub}
							<div
								class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
							>
								<span class="text-xs font-black text-slate-700">{sub.label}</span>
								<input
									type="number"
									min={sub.min ?? 0}
									disabled={!isEditable}
									value={answers[field.key]?.[sub.key] ?? 0}
									oninput={(e) => {
										const v = Number((e.target as HTMLInputElement).value);
										answers[field.key] = { ...(answers[field.key] || {}), [sub.key]: v };
									}}
									class="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-sm font-black text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
								/>
								{#if sub.unit}
									<span class="text-xs font-bold text-slate-500">{sub.unit}</span>
								{/if}
							</div>
						{/each}
					</div>
				{:else if field.type === 'radio'}
					<div class="flex flex-wrap gap-2">
						{#each field.options || [] as opt}
							{@const selected = answers[field.key] === opt}
							{@const isIssueOpt = (field.issue_values || []).includes(opt)}
							<button
								type="button"
								disabled={!isEditable}
								onclick={() => (answers[field.key] = opt)}
								class="rounded-xl border-2 px-3.5 py-2 text-xs font-black transition active:scale-95 disabled:opacity-60 {selected
									? isIssueOpt
										? 'border-rose-500 bg-rose-50 text-rose-700'
										: 'border-indigo-600 bg-indigo-50 text-indigo-700'
									: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}"
							>
								{opt}
							</button>
						{/each}
					</div>
				{:else if field.type === 'checkbox'}
					<div class="flex flex-wrap gap-2">
						{#each field.options || [] as opt}
							{@const checked =
								Array.isArray(answers[field.key]) && answers[field.key].includes(opt)}
							<button
								type="button"
								disabled={!isEditable}
								onclick={() => toggleCheckbox(field.key, opt)}
								class="inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-xs font-black transition active:scale-95 disabled:opacity-60 {checked
									? 'border-indigo-600 bg-indigo-50 text-indigo-700'
									: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}"
							>
								<Icon
									icon={checked ? 'solar:check-square-bold' : 'solar:stop-outline'}
									class="text-sm"
								/>
								{opt}
							</button>
						{/each}
					</div>
				{:else if field.type === 'select'}
					<select
						disabled={!isEditable}
						bind:value={answers[field.key]}
						class="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60 sm:w-72"
					>
						<option value="">-- 선택해 주세요 --</option>
						{#each field.options || [] as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				{:else if field.type === 'vehicle'}
					{#if vehicleContext?.vehicles?.length}
						<select
							disabled={!isEditable}
							bind:value={answers[field.key]}
							class="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60 sm:w-72"
						>
							<option value="">-- 차량 선택 --</option>
							{#each vehicleContext.vehicles as v}
								<option value={v.vehicle_no}>{v.vehicle_no}호 ({v.route})</option>
							{/each}
						</select>
					{:else}
						<input
							type="text"
							disabled={!isEditable}
							bind:value={answers[field.key]}
							placeholder="차량번호 입력"
							class="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none sm:w-64"
						/>
					{/if}
				{:else if field.type === 'date'}
					<input
						type="date"
						disabled={!isEditable}
						bind:value={answers[field.key]}
						class="rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60"
					/>
				{:else if field.type === 'photo'}
					<div class="space-y-3">
						{#if isEditable}
							<div class="flex flex-wrap items-center gap-2">
								<label
									class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 px-4 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
								>
									<Icon icon="solar:camera-add-bold-duotone" class="text-base" />
									<span
										>{uploadingKey === field.key ? '업로드 중...' : '사진 선택 / 촬영 첨부'}</span
									>
									<input
										type="file"
										accept="image/*"
										multiple
										class="hidden"
										disabled={uploadingKey === field.key}
										onchange={(e) => handlePhotoUpload(field, e)}
									/>
								</label>
								<button
									type="button"
									disabled={uploadingKey === field.key}
									onclick={() => {
										pickerField = field;
										showPersonalPicker = true;
									}}
									class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
								>
									<Icon icon="solar:folder-open-bold-duotone" class="text-base text-indigo-600" />
									<span>내 파일함(/USERS)</span>
								</button>
							</div>
						{/if}
						{#if Array.isArray(answers[field.key]) && answers[field.key].length > 0}
							<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
								{#each answers[field.key] as imgUrl, imgIdx}
									<div
										class="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
									>
										<img
											src={getSecureMediaUrl(PUBLIC_SERVER_URL, imgUrl)}
											alt="첨부사진 {imgIdx + 1}"
											class="h-28 w-full object-cover"
										/>
										{#if isEditable}
											<button
												type="button"
												onclick={() => removePhoto(field.key, imgIdx)}
												class="absolute top-1.5 right-1.5 rounded-full bg-slate-900/75 p-1 text-white opacity-90 hover:bg-rose-600"
												title="사진 제거"
											>
												<Icon icon="ph:x-bold" class="text-xs" />
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- 하단 제출 버튼 -->
	<div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
		{#if previewMode}
			<span class="mr-auto text-xs font-bold text-indigo-600">
				미리보기 모드입니다. 실제 사용자 화면과 동일하게 동작을 테스트할 수 있습니다.
			</span>
			<button
				type="button"
				onclick={handleSubmit}
				class="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-5 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
			>
				<Icon icon="solar:eye-bold" class="text-base" />
				<span>제출 테스트 (저장 안 됨)</span>
			</button>
		{:else if !isEditable}
			<span class="text-xs font-bold text-slate-500">마감된 조사는 열람만 가능합니다.</span>
		{:else}
			<button
				type="button"
				onclick={handleSubmit}
				disabled={saving}
				class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
			>
				{#if saving}
					<Icon icon="solar:refresh-circle-bold-duotone" class="animate-spin text-base" />
					<span>저장 중...</span>
				{:else}
					<Icon icon="solar:check-read-bold" class="text-base" />
					<span>{lastSubmitted ? '수정 내용 저장' : '작성 완료 및 제출'}</span>
				{/if}
			</button>
		{/if}
	</div>
</div>

<PersonalMediaPickerModal
	bind:open={showPersonalPicker}
	multiple={true}
	onlyImages={true}
	title="내 파일함 (/USERS) 사진 선택"
	onSelect={handlePersonalPhotosPicked}
/>
