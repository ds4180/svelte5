<script lang="ts">
	/**
	 * ============================================================================
	 * [관리자 현장 조사·설문 관제 & 양식 빌더 (/v1/admin/survey/+page.svelte)]
	 * ============================================================================
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import * as surveyApi from '$lib/api/survey';
	import type {
		SurveyCampaign,
		SurveyFieldSchema,
		SurveySettings,
		SurveyTemplate,
		VehicleTargetMode
	} from '$lib/api/survey';
	import SurveyStatsReport from '$lib/components/survey/SurveyStatsReport.svelte';
	import SurveyFormEngine from '$lib/components/survey/SurveyFormEngine.svelte';
	import TiptapEditor from '$lib/components/TiptapEditor.svelte';
	import {
		DEFAULT_SURVEY_SETTINGS,
		SURVEY_FIELD_TYPE_OPTIONS,
		TARGET_CONFLICT_MODE_OPTIONS,
		stripHtml,
		filterTargetVehicles,
		createEmptySurveyForm,
		createFormFromTemplate,
		createFormFromCampaign,
		addSurveyField,
		removeSurveyField,
		moveSurveyField,
		changeSurveyFieldType,
		buildPreviewCampaignFromForm,
		saveSurveyCampaignWithMedia,
		saveSurveyTemplateWithMedia
	} from '$lib/services/surveyAdminService';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let loading = $state(true);
	let activeTab = $state<'campaigns' | 'templates' | 'settings'>('campaigns');
	let campaigns = $state<SurveyCampaign[]>([]);
	let templates = $state<SurveyTemplate[]>([]);
	let groups = $state<any[]>([]);
	let users = $state<any[]>([]);
	let vehiclePool = $state<Array<{ vehicle_no: string; route: string }>>([]);
	let vehicleRoutes = $state<string[]>([]);
	let vehicleSearchQuery = $state('');
	let surveySettings = $state<SurveySettings>({ ...DEFAULT_SURVEY_SETTINGS });
	let savingSettings = $state(false);

	// 📊 상단 4대 관제 지표 요약
	const countTotal = $derived(campaigns.length);
	const countOpen = $derived(campaigns.filter((c) => c.status === 'OPEN').length);
	const countDraft = $derived(campaigns.filter((c) => c.status === 'DRAFT').length);
	const countClosed = $derived(
		campaigns.filter((c) => c.status === 'CLOSED' || c.status === 'ARCHIVED').length
	);

	// 필터 상태 (과거 이력 검색 지원)
	let filterStatus = $state('');
	let filterCategory = $state('');
	let filterYear = $state('');
	let filterKeyword = $state('');

	// 보고서 및 미리보기 모달 상태
	let activeReportCampaign = $state<SurveyCampaign | null>(null);
	let previewCampaign = $state<SurveyCampaign | null>(null);

	function openPreviewFromForm() {
		previewCampaign = buildPreviewCampaignFromForm(form, editingId);
	}

	// 양식 빌더 & 템플릿 보관함 상태
	let showEditor = $state(false);
	let showTemplateModal = $state(false);
	let templateNameInput = $state('');
	let showSaveTemplateBox = $state(false);
	let savingTemplate = $state(false);
	let editingId = $state<number | null>(null);
	let editorRenderKey = $state(0);
	let saving = $state(false);

	let form = $state(createEmptySurveyForm());

	const FIELD_TYPE_OPTIONS = SURVEY_FIELD_TYPE_OPTIONS;

	async function loadAll() {
		loading = true;
		try {
			const [campRes, tplRes, grpRes, usrRes, setRes, vehRes] = await Promise.all([
				surveyApi.adminListSurveyCampaigns({
					status: filterStatus || undefined,
					category: filterCategory || undefined,
					year: filterYear || undefined,
					keyword: filterKeyword.trim() || undefined
				}),
				surveyApi.adminListSurveyTemplates().catch(() => ({ templates: [] })),
				api.adminGetGroups({ silent: true }).catch(() => []),
				api.adminGetTargetGroupUsers({ silent: true }).catch(() => []),
				surveyApi.adminGetSurveySettings().catch(() => null),
				surveyApi
					.getSurveyVehicles()
					.catch(() => ({ vehicles: [], routes: [], my_default_vehicle: null }))
			]);
			campaigns = campRes.campaigns || [];
			templates = tplRes.templates || [];
			groups = Array.isArray(grpRes) ? grpRes : grpRes?.groups || [];
			users = Array.isArray(usrRes) ? usrRes : usrRes?.users || [];
			vehiclePool = vehRes?.vehicles || [];
			vehicleRoutes = vehRes?.routes || [];
			if (setRes?.settings) {
				surveySettings = { ...DEFAULT_SURVEY_SETTINGS, ...setRes.settings };
			}
		} catch (e) {
			toast.error('조사 목록 로드 실패: ' + formatApiError(e, '오류'));
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		if (savingSettings) return;
		savingSettings = true;
		try {
			const res = await surveyApi.adminUpdateSurveySettings(surveySettings);
			if (res?.settings) {
				surveySettings = { ...DEFAULT_SURVEY_SETTINGS, ...res.settings };
			}
			toast.success(res?.message || '설문 설정이 저장되었습니다.');
		} catch (e) {
			toast.error('설정 저장 실패: ' + formatApiError(e, '오류'));
		} finally {
			savingSettings = false;
		}
	}

	async function reloadTemplates() {
		try {
			const res = await surveyApi.adminListSurveyTemplates();
			templates = res.templates || [];
		} catch {
			// 무시
		}
	}

	function applyTemplateToNewForm(tpl: SurveyTemplate) {
		editingId = null;
		form = createFormFromTemplate(tpl, surveySettings);
		showTemplateModal = false;
		showSaveTemplateBox = false;
		showEditor = true;
		toast.success(`'${tpl.name}' 템플릿을 불러왔습니다.`);
	}

	function applyTemplateIntoCurrentForm(tpl: SurveyTemplate) {
		form.category = tpl.category || form.category;
		form.submit_scope = tpl.submit_scope || form.submit_scope;
		if (!form.title.trim()) form.title = tpl.name;
		if (!stripHtml(form.description) && tpl.description) {
			form.description = tpl.description;
			editorRenderKey++;
		}
		form.fields = JSON.parse(JSON.stringify(tpl.form_schema || []));
		toast.success(`현재 양식에 '${tpl.name}' 문항 구성을 불러왔습니다.`);
	}

	async function saveCurrentFormAsTemplate() {
		const name = templateNameInput.trim() || form.title.trim();
		if (!name) {
			toast.warning('저장할 템플릿 이름을 입력해 주세요.');
			return;
		}
		if (form.fields.length === 0) {
			toast.warning('최소 1개 이상의 문항이 있어야 템플릿으로 저장할 수 있습니다.');
			return;
		}
		savingTemplate = true;
		try {
			const res = await saveSurveyTemplateWithMedia({
				name,
				form,
				editingId
			});
			form.description = res.description;
			toast.success(res.message);
			showSaveTemplateBox = false;
			templateNameInput = '';
			await reloadTemplates();
		} catch (e) {
			toast.error('템플릿 저장 실패: ' + formatApiError(e, '오류'));
		} finally {
			savingTemplate = false;
		}
	}

	async function saveCampaignAsTemplate(c: SurveyCampaign) {
		const name = prompt('저장할 템플릿 이름을 입력하세요:', c.title);
		if (!name || !name.trim()) return;
		try {
			const res = await surveyApi.adminSaveSurveyTemplate({
				name: name.trim(),
				category: c.category || 'GENERAL',
				description: c.description || '',
				submit_scope: c.submit_scope || 'USER',
				form_schema: JSON.parse(JSON.stringify(c.form_schema || []))
			});
			toast.success(res.message);
			await reloadTemplates();
		} catch (e) {
			toast.error('템플릿 저장 실패: ' + formatApiError(e, '오류'));
		}
	}

	async function handleDeleteTemplate(tpl: SurveyTemplate) {
		if (!confirm(`'${tpl.name}' 템플릿을 삭제할까요?`)) return;
		try {
			const res = await surveyApi.adminDeleteSurveyTemplate(tpl.id);
			toast.success(res.message);
			await reloadTemplates();
		} catch (e) {
			toast.error('템플릿 삭제 실패: ' + formatApiError(e, '오류'));
		}
	}

	function openCreateModal() {
		editingId = null;
		form = createEmptySurveyForm(surveySettings);
		showEditor = true;
	}

	function openEditModal(c: SurveyCampaign, asClone = false) {
		editingId = asClone ? null : c.id;
		form = createFormFromCampaign(c, asClone);
		showEditor = true;
	}

	function addField() {
		form.fields = addSurveyField(form.fields);
	}

	function removeField(idx: number) {
		form.fields = removeSurveyField(form.fields, idx);
	}

	function moveField(idx: number, dir: -1 | 1) {
		form.fields = moveSurveyField(form.fields, idx, dir);
	}

	function onFieldTypeChange(idx: number, nextType: SurveyFieldSchema['type']) {
		form.fields = changeSurveyFieldType(form.fields, idx, nextType, surveySettings);
	}

	function toggleGroup(groupName: string) {
		if (form.target_groups.includes(groupName)) {
			form.target_groups = form.target_groups.filter((g) => g !== groupName);
		} else {
			form.target_groups = [...form.target_groups, groupName];
		}
	}

	function toggleUser(uid: number) {
		if (form.target_user_ids.includes(uid)) {
			form.target_user_ids = form.target_user_ids.filter((id) => id !== uid);
		} else {
			form.target_user_ids = [...form.target_user_ids, uid];
		}
	}

	function toggleTargetRoute(route: string) {
		const curr = form.vehicle_target.routes || [];
		form.vehicle_target.routes = curr.includes(route)
			? curr.filter((r) => r !== route)
			: [...curr, route];
	}

	function toggleTargetVehicle(vno: string) {
		const curr = form.vehicle_target.vehicle_nos || [];
		form.vehicle_target.vehicle_nos = curr.includes(vno)
			? curr.filter((v) => v !== vno)
			: [...curr, vno];
	}

	const resolvedTargetVehicles = $derived(filterTargetVehicles(vehiclePool, form.vehicle_target));
	const filteredVehiclePoolForPick = $derived(
		vehiclePool.filter((v) => {
			const q = vehicleSearchQuery.trim().toLowerCase();
			if (!q) return true;
			return v.vehicle_no.toLowerCase().includes(q) || v.route.toLowerCase().includes(q);
		})
	);

	async function saveCampaign(publishNow = false) {
		if (saving) return;
		if (!form.title.trim()) {
			toast.warning('조사 제목을 입력해 주세요.');
			return;
		}
		if (form.fields.length === 0) {
			toast.warning('최소 1개 이상의 질문 문항을 추가해 주세요.');
			return;
		}

		saving = true;
		try {
			const res = await saveSurveyCampaignWithMedia({
				form,
				editingId,
				publishNow
			});
			form.description = res.description;
			toast.success(res.message);
			showEditor = false;
			await loadAll();
		} catch (e) {
			toast.error('저장 실패: ' + formatApiError(e, '오류'));
		} finally {
			saving = false;
		}
	}

	async function handlePublish(c: SurveyCampaign) {
		if (!confirm(`'${c.title}' 조사를 지금 배포(OPEN)하고 대상자에게 알림을 발송할까요?`)) return;
		try {
			const res = await surveyApi.adminPublishSurveyCampaign(c.id);
			toast.success(res.message);
			await loadAll();
		} catch (e) {
			toast.error('배포 실패: ' + formatApiError(e, '오류'));
		}
	}

	async function handleClose(c: SurveyCampaign) {
		if (!confirm(`'${c.title}' 조사를 마감(CLOSED) 처리할까요?`)) return;
		try {
			const res = await surveyApi.adminCloseSurveyCampaign(c.id);
			toast.success(res.message);
			await loadAll();
		} catch (e) {
			toast.error('마감 실패: ' + formatApiError(e, '오류'));
		}
	}

	async function handleDelete(c: SurveyCampaign) {
		if (!confirm(`'${c.title}' 조사를 삭제(숨김) 처리할까요?`)) return;
		try {
			await surveyApi.adminDeleteSurveyCampaign(c.id);
			toast.success('삭제되었습니다.');
			if (activeReportCampaign?.id === c.id) activeReportCampaign = null;
			await loadAll();
		} catch (e) {
			toast.error('삭제 실패: ' + formatApiError(e, '오류'));
		}
	}

	onMount(loadAll);
</script>

<svelte:head>
	<title>{getSiteTitle('현장 조사·설문 관리')}</title>
</svelte:head>

<div
	class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8"
>
	<!-- ===================================================================== -->
	<!-- 1단계: 페이지 헤더 & 액션 바 (도메인 액션 -> 새로고침 -> 관리자 홈) -->
	<!-- ===================================================================== -->
	<div
		class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8"
	>
		<div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase"
				>
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					System Governance
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/survey</span>
			</div>
			<h1
				class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl"
			>
				현장 <span class="text-blue-600 not-italic">조사·설문 관제</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				JSONB 동적 조사 양식 생성·배포, 미제출자 독촉 푸시, 실시간 통계 보고 및 템플릿을 관리합니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={() => openCreateModal()}
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-700 active:scale-95"
			>
				<Icon icon="solar:add-circle-bold" class="text-base" />
				<span>새 조사 만들기</span>
			</button>
			<button
				type="button"
				onclick={loadAll}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>
			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2단계: 상단 4대 관제 지표 요약 카드 -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Total</span>
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
				>
					<Icon icon="solar:clipboard-list-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{countTotal.toLocaleString()} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-indigo-600">전체 조사 캠페인</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Open</span>
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
				>
					<Icon icon="solar:play-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-emerald-600">
					{countOpen.toLocaleString()} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">진행중 (응답 수집)</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Draft</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:pen-new-square-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-amber-600">
					{countDraft.toLocaleString()} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">작성중 (배포 대기)</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Closed</span>
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
				>
					<Icon icon="solar:archive-check-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-700">
					{countClosed.toLocaleString()} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">마감 / 과거 이력</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3단계: 전사 공통 탭 바 -->
	<!-- ===================================================================== -->
	<div class="flex items-center gap-2 overflow-x-auto border-b-2 border-slate-200">
		<button
			type="button"
			onclick={() => (activeTab = 'campaigns')}
			class="flex items-center gap-2 rounded-t-2xl px-6 py-3 text-xs font-black whitespace-nowrap transition {activeTab ===
			'campaigns'
				? 'border-b-4 border-blue-600 bg-blue-50/50 text-blue-600'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			<Icon icon="solar:clipboard-list-bold-duotone" class="text-base" />
			<span>조사 캠페인 목록 ({campaigns.length})</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'templates')}
			class="flex items-center gap-2 rounded-t-2xl px-6 py-3 text-xs font-black whitespace-nowrap transition {activeTab ===
			'templates'
				? 'border-b-4 border-blue-600 bg-blue-50/50 text-blue-600'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			<Icon icon="solar:folder-with-files-bold-duotone" class="text-base" />
			<span>템플릿 보관함 ({templates.length})</span>
		</button>
		<!-- ⚙️ 설정 탭 (항상 마지막 위치) -->
		<button
			type="button"
			onclick={() => (activeTab = 'settings')}
			class="flex items-center gap-2 rounded-t-2xl px-6 py-3 text-xs font-black whitespace-nowrap transition {activeTab ===
			'settings'
				? 'border-b-4 border-blue-600 bg-blue-50/50 text-blue-600'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			<Icon icon="solar:settings-bold-duotone" class="text-base" />
			<span>설정</span>
		</button>
	</div>

	<!-- ===================================================================== -->
	<!-- 4단계: 본문 반응형 카드 영역 -->
	<!-- ===================================================================== -->
	{#if activeTab === 'campaigns'}
		{#if activeReportCampaign}
			<div class="rounded-3xl border-2 border-indigo-200 bg-white p-6 shadow-md">
				<SurveyStatsReport
					campaign={activeReportCampaign}
					onClose={() => (activeReportCampaign = null)}
				/>
			</div>
		{/if}

		<!-- 과거 이력 & 상태 검색 바 -->
		<div
			class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
		>
			<select
				bind:value={filterStatus}
				onchange={loadAll}
				class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
			>
				<option value="">전체 상태</option>
				<option value="OPEN">진행중 (OPEN)</option>
				<option value="DRAFT">작성중 (DRAFT)</option>
				<option value="CLOSED">마감/과거이력 (CLOSED)</option>
			</select>
			<select
				bind:value={filterCategory}
				onchange={loadAll}
				class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
			>
				<option value="">전체 분류</option>
				<option value="VEHICLE">차량 (VEHICLE)</option>
				<option value="SAFETY">안전 (SAFETY)</option>
				<option value="HR">인사/총무 (HR)</option>
				<option value="GENERAL">일반 (GENERAL)</option>
			</select>
			<input
				type="number"
				bind:value={filterYear}
				placeholder="연도 (예: 2026)"
				class="w-32 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
			/>
			<input
				type="text"
				bind:value={filterKeyword}
				onkeydown={(e) => e.key === 'Enter' && loadAll()}
				placeholder="제목 또는 캠페인 코드 검색..."
				class="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
			/>
			<button
				type="button"
				onclick={loadAll}
				class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700"
			>
				조회
			</button>
		</div>

		<!-- 캠페인 반응형 카드 그리드 (모바일 1열 / 태블릿 2열 / 데스크탑 3열) -->
		{#if loading}
			<div
				class="rounded-3xl border-2 border-slate-200 bg-white py-16 text-center text-xs font-bold text-slate-400"
			>
				조사 캠페인 불러오는 중...
			</div>
		{:else if campaigns.length === 0}
			<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
				<Icon icon="solar:clipboard-list-broken" class="mx-auto mb-3 text-4xl text-slate-300" />
				<p class="text-sm font-bold text-slate-500">등록된 조사 캠페인이 없습니다.</p>
				<button
					type="button"
					onclick={() => openCreateModal()}
					class="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
				>
					첫 조사 만들기
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each campaigns as c (c.id)}
					<div
						class="flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400"
					>
						<div>
							<div class="mb-3 flex items-center justify-between gap-2">
								<span
									class="rounded-full px-2.5 py-1 text-[10px] font-black {c.status === 'OPEN'
										? 'bg-emerald-100 text-emerald-700'
										: c.status === 'DRAFT'
											? 'bg-amber-100 text-amber-700'
											: 'bg-slate-200 text-slate-600'}"
								>
									{c.status}
								</span>
								<span
									class="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500"
								>
									{c.category} · {c.submit_scope === 'VEHICLE' ? '차량별' : '사원별'}
								</span>
							</div>

							<h3 class="text-base font-black tracking-tight text-slate-900">{c.title}</h3>
							<p class="mt-1 font-mono text-[11px] font-bold text-slate-400">
								코드: {c.code} · 문항 {c.form_schema?.length || 0}개 · 대상 {c.target_type}
							</p>

							<div class="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
								<div>
									<div class="text-[10px] font-bold text-slate-400">제출 현황</div>
									<div class="font-black text-indigo-700">
										{c.response_count ?? 0}{c.submit_scope === 'VEHICLE' ? '대' : '건'}
										<span class="font-bold text-slate-400">
											/ {c.target_count ?? 0}{c.submit_scope === 'VEHICLE' ? '대' : '명'}
										</span>
									</div>
								</div>
								<div>
									<div class="text-[10px] font-bold text-slate-400">이상/교체</div>
									{#if (c.issue_count ?? 0) > 0}
										<span
											class="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-700"
										>
											{c.issue_count}건
										</span>
									{:else}
										<span class="font-bold text-slate-500">0건</span>
									{/if}
								</div>
							</div>

							<div
								class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"
							>
								<span>마감: {c.due_at ? c.due_at.replace('T', ' ').slice(0, 16) : '상시'}</span>
								<span>생성: {c.created_at}</span>
							</div>
						</div>

						<div class="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
							<button
								type="button"
								onclick={() => (previewCampaign = c)}
								class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100"
							>
								미리보기
							</button>
							<button
								type="button"
								onclick={() => (activeReportCampaign = c)}
								class="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-indigo-700"
							>
								통계·응답
							</button>
							{#if c.status === 'DRAFT'}
								<button
									type="button"
									onclick={() => handlePublish(c)}
									class="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700"
								>
									배포
								</button>
							{:else if c.status === 'OPEN'}
								<button
									type="button"
									onclick={() => handleClose(c)}
									class="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-800 hover:bg-amber-100"
								>
									마감
								</button>
							{/if}
							<button
								type="button"
								onclick={() => openEditModal(c, false)}
								class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
							>
								수정
							</button>
							<button
								type="button"
								onclick={() => openEditModal(c, true)}
								class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
							>
								복제
							</button>
							<button
								type="button"
								onclick={() => saveCampaignAsTemplate(c)}
								class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
							>
								템플릿 저장
							</button>
							<button
								type="button"
								onclick={() => handleDelete(c)}
								class="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
							>
								삭제
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'templates'}
		<!-- 탭 2: 템플릿 보관함 반응형 카드 그리드 -->
		{#if templates.length === 0}
			<div
				class="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center text-xs font-bold text-slate-400"
			>
				저장된 조사 템플릿이 없습니다.
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each templates as tpl (tpl.id)}
					<div
						class="flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400"
					>
						<div>
							<div class="mb-2 flex items-center justify-between gap-2">
								<span
									class="rounded-full px-2.5 py-0.5 text-[10px] font-black {tpl.is_builtin
										? 'bg-indigo-100 text-indigo-700'
										: 'bg-slate-100 text-slate-600'}"
								>
									{tpl.is_builtin ? '기본 제공' : '사용자 저장'}
								</span>
								<span class="text-[11px] font-bold text-slate-400">
									문항 {tpl.form_schema?.length || 0}개 · {tpl.submit_scope === 'VEHICLE'
										? '차량별'
										: '사원별'}
								</span>
							</div>
							<h3 class="text-base font-black text-slate-900">{tpl.name}</h3>
							{#if tpl.description}
								<p class="mt-1.5 line-clamp-2 text-xs text-slate-500">
									{stripHtml(tpl.description)}
								</p>
							{/if}
						</div>
						<div class="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
							<button
								type="button"
								onclick={() => applyTemplateToNewForm(tpl)}
								class="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white hover:bg-blue-700"
							>
								이 템플릿으로 조사 만들기
							</button>
							{#if !tpl.is_builtin}
								<button
									type="button"
									onclick={() => handleDeleteTemplate(tpl)}
									class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
								>
									삭제
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- 탭 3: 설정 (항상 마지막 위치 — 비즈니스 로직 제어) -->
		<div
			class="max-w-4xl space-y-6 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8"
		>
			<div class="border-b border-slate-200 pb-4">
				<h2 class="text-lg font-black text-slate-900">현장 조사·설문 비즈니스 로직 설정</h2>
				<p class="mt-1 text-xs font-medium text-slate-500">
					코드 수정 없이 새 조사 생성 기본값과 응답 제출·권한 정책을 중앙에서 제어합니다.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<div>
					<label
						for="setting-default-category"
						class="mb-1.5 block text-xs font-black text-slate-700"
					>
						기본 조사 분류
					</label>
					<select
						id="setting-default-category"
						bind:value={surveySettings.default_category}
						class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800"
					>
						<option value="GENERAL">일반 (GENERAL)</option>
						<option value="VEHICLE">차량 (VEHICLE)</option>
						<option value="SAFETY">안전 (SAFETY)</option>
						<option value="HR">인사/총무 (HR)</option>
					</select>
				</div>

				<div>
					<label for="setting-default-scope" class="mb-1.5 block text-xs font-black text-slate-700">
						기본 제출 단위
					</label>
					<select
						id="setting-default-scope"
						bind:value={surveySettings.default_submit_scope}
						class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800"
					>
						<option value="USER">사원별 1건 (USER)</option>
						<option value="VEHICLE">차량별 1건 (VEHICLE)</option>
					</select>
				</div>

				<div>
					<label for="setting-max-photos" class="mb-1.5 block text-xs font-black text-slate-700">
						사진 첨부 문항 기본 최대 장수 (1~10)
					</label>
					<input
						id="setting-max-photos"
						type="number"
						min="1"
						max="10"
						bind:value={surveySettings.default_max_photos}
						class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-800"
					/>
				</div>

				<div>
					<label for="setting-conflict-mode" class="mb-1.5 block text-xs font-black text-slate-700">
						비사원 대상(차량 등) 중복 작성 정책
					</label>
					<select
						id="setting-conflict-mode"
						bind:value={surveySettings.target_conflict_mode}
						class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800"
					>
						{#each TARGET_CONFLICT_MODE_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
					<p class="mt-1 text-[11px] font-medium text-slate-500">
						{TARGET_CONFLICT_MODE_OPTIONS.find(
							(o) => o.value === surveySettings.target_conflict_mode
						)?.description || ''}
					</p>
				</div>
			</div>

			<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
				<label class="flex cursor-pointer items-start gap-3">
					<input
						type="checkbox"
						bind:checked={surveySettings.default_allow_edit}
						class="checkbox mt-0.5 checkbox-sm checkbox-primary"
					/>
					<div>
						<span class="block text-xs font-black text-slate-800">마감 전 응답 수정 기본 허용</span>
						<span class="block text-[11px] text-slate-500">
							새 조사 작성 시 제출한 응답을 마감 전까지 수정할 수 있도록 기본 체크합니다.
						</span>
					</div>
				</label>

				<label class="flex cursor-pointer items-start gap-3">
					<input
						type="checkbox"
						bind:checked={surveySettings.default_push_on_open}
						class="checkbox mt-0.5 checkbox-sm checkbox-primary"
					/>
					<div>
						<span class="block text-xs font-black text-slate-800"
							>조사 배포 시 웹 푸시 알림 기본 발송</span
						>
						<span class="block text-[11px] text-slate-500">
							새 조사 생성/배포 시 대상자에게 푸시 알림을 보내도록 기본 체크합니다.
						</span>
					</div>
				</label>

				<label class="flex cursor-pointer items-start gap-3">
					<input
						type="checkbox"
						bind:checked={surveySettings.allow_untargeted_admin_submit}
						class="checkbox mt-0.5 checkbox-sm checkbox-primary"
					/>
					<div>
						<span class="block text-xs font-black text-slate-800"
							>관리자(Rank 4+) 비대상 조사 테스트·대리 제출 허용</span
						>
						<span class="block text-[11px] text-slate-500">
							해제 시 관리자라도 지정된 대상자 목록에 포함되지 않으면 응답을 제출할 수 없습니다.
						</span>
					</div>
				</label>
			</div>

			<div class="flex justify-end border-t border-slate-100 pt-4">
				<button
					type="button"
					disabled={savingSettings}
					onclick={saveSettings}
					class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
				>
					<Icon icon="solar:diskette-bold" class="text-base" />
					<span>{savingSettings ? '저장 중...' : '설정 저장'}</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- 양식 빌더 모달 -->
{#if showEditor}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
	>
		<div
			class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
		>
			<div class="flex items-center justify-between border-b border-slate-200 pb-4">
				<div>
					<h2 class="text-xl font-black text-slate-900">
						{editingId ? '조사 양식 수정' : '새 조사 양식 만들기'}
					</h2>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						JSONB 동적 스키마를 시각적으로 조립합니다. 서비스앱 연결 시 식별 코드(code)를
						사용합니다.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showEditor = false)}
					class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				>
					<Icon icon="ph:x-bold" class="text-lg" />
				</button>
			</div>

			<div class="mt-6 space-y-5">
				<!-- 템플릿 빠른 불러오기 & 템플릿으로 저장 바 -->
				<div class="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3.5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-xs font-black text-indigo-800">템플릿 불러오기:</span>
							<select
								onchange={(e) => {
									const id = e.currentTarget.value;
									const picked = templates.find((t) => t.id === id);
									if (picked) {
										applyTemplateIntoCurrentForm(picked);
										e.currentTarget.value = '';
									}
								}}
								class="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
							>
								<option value="">-- 저장된 템플릿 선택 시 문항 덮어쓰기 --</option>
								{#each templates as tpl}
									<option value={tpl.id}>
										{tpl.is_builtin ? '[기본]' : '[사용자]'}
										{tpl.name} ({tpl.form_schema?.length || 0}문항)
									</option>
								{/each}
							</select>
						</div>
						<button
							type="button"
							onclick={() => {
								templateNameInput = form.title.trim();
								showSaveTemplateBox = !showSaveTemplateBox;
							}}
							class="inline-flex items-center gap-1 rounded-xl border border-indigo-300 bg-white px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100"
						>
							<Icon icon="solar:bookmark-bold" class="text-xs" />
							<span>현재 양식 템플릿으로 저장</span>
						</button>
					</div>

					{#if showSaveTemplateBox}
						<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-indigo-200/80 pt-3">
							<input
								type="text"
								bind:value={templateNameInput}
								placeholder="저장할 템플릿 이름 (예: 소화기 점검 표준 양식)"
								class="min-w-[220px] flex-1 rounded-xl border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold"
							/>
							<button
								type="button"
								disabled={savingTemplate}
								onclick={saveCurrentFormAsTemplate}
								class="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
							>
								{savingTemplate ? '저장 중...' : '템플릿 저장 확인'}
							</button>
							<button
								type="button"
								onclick={() => (showSaveTemplateBox = false)}
								class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
							>
								취소
							</button>
						</div>
					{/if}
				</div>

				<!-- 기본 정보 -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="sm:col-span-2">
						<label class="mb-1 block text-xs font-black text-slate-700">조사 제목 *</label>
						<input
							type="text"
							bind:value={form.title}
							placeholder="예: 2026년 11월 차량 소화기 현황 조사"
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-black text-slate-700"
							>식별 코드 (선택, 미입력 시 자동생성)</label
						>
						<input
							type="text"
							bind:value={form.code}
							placeholder="예: 202611-extinguisher"
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-black text-slate-700">분류</label>
						<select
							bind:value={form.category}
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800"
						>
							<option value="VEHICLE">차량 (VEHICLE)</option>
							<option value="SAFETY">안전 (SAFETY)</option>
							<option value="HR">인사/총무 (HR)</option>
							<option value="GENERAL">일반 (GENERAL)</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-xs font-black text-slate-700">제출 단위</label>
						<select
							bind:value={form.submit_scope}
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800"
						>
							<option value="USER">사원별 1건 (USER)</option>
							<option value="VEHICLE">차량별 조사 (VEHICLE)</option>
						</select>
					</div>
					{#if form.submit_scope === 'VEHICLE'}
						<div>
							<label class="mb-1 block text-xs font-black text-slate-700"
								>차량 중복 작성 정책 (예외 설정)</label
							>
							<select
								bind:value={form.target_conflict_mode}
								class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800"
							>
								<option value="INHERIT"
									>전역 설정 따름 ({TARGET_CONFLICT_MODE_OPTIONS.find(
										(o) => o.value === surveySettings.target_conflict_mode
									)?.label || '기본'})</option
								>
								{#each TARGET_CONFLICT_MODE_OPTIONS as opt (opt.value)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
					{/if}
					<div>
						<label class="mb-1 block text-xs font-black text-slate-700">마감 일시 (선택)</label>
						<input
							type="datetime-local"
							bind:value={form.due_at}
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800"
						/>
					</div>
					<div class="sm:col-span-2">
						<div class="mb-1 flex items-center justify-between">
							<span class="block text-xs font-black text-slate-700"
								>안내 문구 (사진·이미지 첨부 가능)</span
							>
							<span class="text-[11px] font-bold text-indigo-600">예시 사진·안내문 리치 에디터</span
							>
						</div>
						<div class="overflow-hidden rounded-2xl border border-slate-300 bg-white">
							{#key editorRenderKey}
								<TiptapEditor bind:content={form.description} slug="survey" />
							{/key}
						</div>
					</div>
				</div>

				<!-- 차량별 조사인 경우: 조사 대상 차량 지정 -->
				{#if form.submit_scope === 'VEHICLE'}
					<div class="space-y-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<span class="text-xs font-black text-indigo-950">조사 대상 차량 지정</span>
								<p class="text-[11px] font-medium text-indigo-700">
									응답률과 대상 리스트는 여기서 지정한 차량({resolvedTargetVehicles.length}대)
									기준으로 정확히 집계됩니다.
								</p>
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each [{ id: 'ALL', label: '차량 전체' }, { id: 'ROUTE', label: '노선별' }, { id: 'VEHICLE', label: '차량 번호별' }, { id: 'RANGE', label: '차량번호 구간별' }] as vtOpt (vtOpt.id)}
									<button
										type="button"
										onclick={() => (form.vehicle_target.mode = vtOpt.id as VehicleTargetMode)}
										class="rounded-lg px-3 py-1 text-xs font-black transition {form.vehicle_target
											.mode === vtOpt.id
											? 'bg-indigo-600 text-white shadow-sm'
											: 'border border-indigo-200 bg-white text-slate-700 hover:bg-indigo-50'}"
									>
										{vtOpt.label}
									</button>
								{/each}
							</div>
						</div>

						{#if form.vehicle_target.mode === 'ROUTE'}
							<div class="flex flex-wrap gap-1.5 rounded-xl border border-indigo-100 bg-white p-3">
								{#each vehicleRoutes as route}
									<button
										type="button"
										onclick={() => toggleTargetRoute(route)}
										class="rounded-lg border px-2.5 py-1 text-xs font-bold {form.vehicle_target.routes.includes(
											route
										)
											? 'border-indigo-600 bg-indigo-100 text-indigo-800'
											: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}"
									>
										{route}
									</button>
								{:else}
									<span class="text-xs text-slate-400">등록된 노선 정보가 없습니다.</span>
								{/each}
							</div>
						{:else if form.vehicle_target.mode === 'VEHICLE'}
							<div class="space-y-2 rounded-xl border border-indigo-100 bg-white p-3">
								<div class="flex flex-wrap items-center gap-2">
									<input
										type="text"
										bind:value={vehicleSearchQuery}
										placeholder="차량번호 또는 노선 검색..."
										class="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"
									/>
									<button
										type="button"
										onclick={() => (form.vehicle_target.vehicle_nos = [])}
										class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
									>
										선택 초기화
									</button>
								</div>
								<div class="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pt-1">
									{#each filteredVehiclePoolForPick as v}
										<button
											type="button"
											onclick={() => toggleTargetVehicle(v.vehicle_no)}
											class="rounded-lg border px-2.5 py-1 text-xs font-bold {form.vehicle_target.vehicle_nos.includes(
												v.vehicle_no
											)
												? 'border-indigo-600 bg-indigo-100 text-indigo-800'
												: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}"
										>
											{v.vehicle_no}호 <span class="text-[10px] text-slate-400">({v.route})</span>
										</button>
									{/each}
								</div>
							</div>
						{:else if form.vehicle_target.mode === 'RANGE'}
							<div
								class="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-white p-3"
							>
								<span class="text-xs font-black text-slate-700">차량번호 구간:</span>
								<input
									type="text"
									bind:value={form.vehicle_target.range_start}
									placeholder="시작 번호 (예: 200)"
									class="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"
								/>
								<span class="text-xs font-black text-slate-400">~</span>
								<input
									type="text"
									bind:value={form.vehicle_target.range_end}
									placeholder="끝 번호 (예: 299)"
									class="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"
								/>
								<span class="text-[11px] font-medium text-slate-500">
									차량번호 숫자 기준 구간 필터링
								</span>
							</div>
						{/if}

						<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
							<span class="font-black text-indigo-900">
								매칭 대상: {resolvedTargetVehicles.length}대
							</span>
							{#each resolvedTargetVehicles.slice(0, 15) as mv}
								<span class="rounded bg-white px-2 py-0.5 font-bold text-slate-700 shadow-xs">
									{mv.vehicle_no}호
								</span>
							{/each}
							{#if resolvedTargetVehicles.length > 15}
								<span class="font-bold text-indigo-600">
									외 {resolvedTargetVehicles.length - 15}대
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- 대상자 지정 -->
				<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<span class="text-xs font-black text-slate-800">
							{form.submit_scope === 'VEHICLE' ? '작성 가능 사원 범위 (조사원)' : '대상자 범위'}
						</span>
						<div class="flex gap-2">
							{#each ['ALL', 'GROUP', 'USER'] as t}
								<button
									type="button"
									onclick={() => (form.target_type = t as 'ALL' | 'GROUP' | 'USER')}
									class="rounded-lg px-3 py-1 text-xs font-black {form.target_type === t
										? 'bg-indigo-600 text-white'
										: 'border border-slate-300 bg-white text-slate-600'}"
								>
									{t === 'ALL' ? '전 직원' : t === 'GROUP' ? '특정 그룹' : '특정 사원'}
								</button>
							{/each}
						</div>
					</div>
					{#if form.target_type === 'GROUP'}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each groups as g}
								{@const gname = g.name || g.code || g}
								<button
									type="button"
									onclick={() => toggleGroup(gname)}
									class="rounded-lg border px-2.5 py-1 text-xs font-bold {form.target_groups.includes(
										gname
									)
										? 'border-indigo-600 bg-indigo-100 text-indigo-800'
										: 'border-slate-300 bg-white text-slate-600'}"
								>
									{gname}
								</button>
							{/each}
						</div>
					{:else if form.target_type === 'USER'}
						<div class="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
							{#each users as u}
								<button
									type="button"
									onclick={() => toggleUser(u.id)}
									class="rounded-lg border px-2.5 py-1 text-xs font-bold {form.target_user_ids.includes(
										u.id
									)
										? 'border-indigo-600 bg-indigo-100 text-indigo-800'
										: 'border-slate-300 bg-white text-slate-600'}"
								>
									{u.real_name || u.username}
								</button>
							{/each}
						</div>
					{/if}
					<div class="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-700">
						<label class="inline-flex items-center gap-1.5">
							<input
								type="checkbox"
								bind:checked={form.allow_edit}
								class="rounded text-indigo-600"
							/>
							<span>마감 전 제출자 수정 허용</span>
						</label>
						<label class="inline-flex items-center gap-1.5">
							<input
								type="checkbox"
								bind:checked={form.push_on_open}
								class="rounded text-indigo-600"
							/>
							<span>배포 시 대상자 Web Push 자동 발송</span>
						</label>
					</div>
				</div>

				<!-- 질문 빌더 -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-black text-slate-900"
							>질문 문항 구성 ({form.fields.length}개)</span
						>
						<button
							type="button"
							onclick={addField}
							class="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-700"
						>
							<Icon icon="ph:plus-bold" class="text-xs" />
							<span>질문 추가</span>
						</button>
					</div>

					{#each form.fields as field, idx}
						<div class="space-y-3 rounded-2xl border border-slate-300 bg-slate-50/70 p-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-xs font-black text-indigo-700">문항 #{idx + 1}</span>
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => moveField(idx, -1)}
										class="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200"
										>▲</button
									>
									<button
										type="button"
										onclick={() => moveField(idx, 1)}
										class="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200"
										>▼</button
									>
									<button
										type="button"
										onclick={() => removeField(idx)}
										class="rounded px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100"
										>삭제</button
									>
								</div>
							</div>

							<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<div>
									<label class="mb-1 block text-[11px] font-black text-slate-600">질문 제목 *</label
									>
									<input
										type="text"
										bind:value={field.label}
										class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
									/>
								</div>
								<div>
									<label class="mb-1 block text-[11px] font-black text-slate-600"
										>질문 Key (영문)</label
									>
									<input
										type="text"
										bind:value={field.key}
										class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
									/>
								</div>
								<div>
									<label class="mb-1 block text-[11px] font-black text-slate-600">입력 타입</label>
									<select
										value={field.type}
										onchange={(e) =>
											onFieldTypeChange(idx, e.currentTarget.value as SurveyFieldSchema['type'])}
										class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
									>
										{#each FIELD_TYPE_OPTIONS as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>
							</div>

							<div class="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
								<label class="inline-flex items-center gap-1.5">
									<input
										type="checkbox"
										bind:checked={field.required}
										class="rounded text-indigo-600"
									/>
									<span>필수 입력</span>
								</label>
								{#if field.type === 'text' || field.type === 'textarea'}
									<input
										type="text"
										bind:value={field.placeholder}
										placeholder="입력 힌트(placeholder)"
										class="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
									/>
								{:else if field.type === 'number'}
									<input
										type="text"
										bind:value={field.unit}
										placeholder="단위 (예: 개)"
										class="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
									/>
								{/if}
							</div>

							{#if ['radio', 'checkbox', 'select'].includes(field.type)}
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label class="mb-1 block text-[11px] font-black text-slate-600"
											>선택지 (쉼표 구분)</label
										>
										<input
											type="text"
											value={(field.options || []).join(', ')}
											oninput={(e) => {
												field.options = e.currentTarget.value
													.split(',')
													.map((s) => s.trim())
													.filter(Boolean);
											}}
											class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
										/>
									</div>
									<div>
										<label class="mb-1 block text-[11px] font-black text-rose-600"
											>이상/교체 판정 값 (쉼표 구분)</label
										>
										<input
											type="text"
											value={(field.issue_values || []).join(', ')}
											oninput={(e) => {
												field.issue_values = e.currentTarget.value
													.split(',')
													.map((s) => s.trim())
													.filter(Boolean);
											}}
											placeholder="예: 교체 필요, 불량"
											class="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs"
										/>
									</div>
								</div>
							{:else if field.type === 'number_group'}
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-[11px] font-black text-slate-600">하위 수량 항목</span>
										<button
											type="button"
											onclick={() => {
												const subIdx = (field.fields?.length || 0) + 1;
												field.fields = [
													...(field.fields || []),
													{
														key: `s${subIdx}`,
														label: `항목${subIdx}`,
														unit: '개',
														min: 0,
														default: 0
													}
												];
											}}
											class="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-600"
										>
											+ 하위 항목 추가
										</button>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each field.fields || [] as sub, sIdx}
											<div
												class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
											>
												<input
													type="text"
													bind:value={sub.label}
													placeholder="라벨"
													class="w-16 border-b border-slate-200 font-bold"
												/>
												<input
													type="text"
													bind:value={sub.key}
													placeholder="key"
													class="w-16 border-b border-slate-200 font-mono text-[11px]"
												/>
												<input
													type="text"
													bind:value={sub.unit}
													placeholder="단위"
													class="w-10 border-b border-slate-200 text-center"
												/>
												<button
													type="button"
													onclick={() =>
														(field.fields = (field.fields || []).filter((_, j) => j !== sIdx))}
													class="font-bold text-rose-500">×</button
												>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div
				class="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4"
			>
				<button
					type="button"
					onclick={() => {
						templateNameInput = form.title.trim();
						showSaveTemplateBox = true;
					}}
					class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100"
				>
					<Icon icon="solar:bookmark-bold" class="text-sm text-indigo-600" />
					<span>템플릿으로 저장</span>
				</button>
				<button
					type="button"
					onclick={openPreviewFromForm}
					class="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 hover:bg-blue-100"
				>
					<Icon icon="solar:eye-bold" class="text-sm" />
					<span>미리보기</span>
				</button>
				<button
					type="button"
					onclick={() => (showEditor = false)}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
				>
					취소
				</button>
				<button
					type="button"
					disabled={saving}
					onclick={() => saveCampaign(false)}
					class="rounded-xl border border-indigo-300 bg-indigo-50 px-5 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
				>
					저장만 하기 ({form.status})
				</button>
				<button
					type="button"
					disabled={saving}
					onclick={() => saveCampaign(true)}
					class="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
				>
					저장 및 즉시 배포(알림 발송)
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 템플릿 보관함 / 불러오기 모달 -->
{#if showTemplateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
	>
		<div
			class="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
		>
			<div class="flex items-center justify-between border-b border-slate-200 pb-4">
				<div>
					<h2 class="text-xl font-black text-slate-900">조사 양식 템플릿 보관함</h2>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						저장된 양식 템플릿을 불러와 바로 새 조사를 만들거나, 더 이상 쓰지 않는 사용자 템플릿을
						삭제합니다.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showTemplateModal = false)}
					class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				>
					<Icon icon="ph:x-bold" class="text-lg" />
				</button>
			</div>

			<div class="mt-5 grid grid-cols-1 gap-3">
				{#each templates as tpl}
					<div
						class="flex flex-col justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center"
					>
						<div class="space-y-1">
							<div class="flex flex-wrap items-center gap-1.5">
								<span
									class="rounded-full px-2 py-0.5 text-[10px] font-black {tpl.is_builtin
										? 'bg-slate-900 text-white'
										: 'bg-indigo-100 text-indigo-700'}"
								>
									{tpl.is_builtin ? '기본 제공' : '저장됨'}
								</span>
								<span
									class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black text-slate-600"
								>
									{tpl.category} · {tpl.submit_scope === 'VEHICLE' ? '차량별' : '사원별'}
								</span>
								<span class="text-[11px] font-bold text-slate-500"
									>{tpl.form_schema?.length || 0}문항</span
								>
							</div>
							<h3 class="text-sm font-black text-slate-900">{tpl.name}</h3>
							{#if stripHtml(tpl.description)}
								<p class="line-clamp-2 text-xs font-medium text-slate-500">
									{stripHtml(tpl.description)}
								</p>
							{/if}
							<div class="flex flex-wrap gap-1 pt-1">
								{#each tpl.form_schema || [] as f}
									<span
										class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600"
									>
										{f.label}
									</span>
								{/each}
							</div>
						</div>

						<div class="flex shrink-0 items-center gap-2">
							<button
								type="button"
								onclick={() => applyTemplateToNewForm(tpl)}
								class="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
							>
								이 템플릿으로 생성
							</button>
							{#if !tpl.is_builtin}
								<button
									type="button"
									onclick={() => handleDeleteTemplate(tpl)}
									class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
								>
									삭제
								</button>
							{/if}
						</div>
					</div>
				{:else}
					<div class="py-12 text-center text-xs font-bold text-slate-400">
						등록된 템플릿이 없습니다.
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- 설문 양식 미리보기 모달 -->
{#if previewCampaign}
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
	>
		<div
			class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
		>
			<div class="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
				<div class="flex items-center gap-2">
					<span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
						미리보기
					</span>
					<h2 class="text-lg font-black text-slate-900">사용자 설문 화면 미리보기</h2>
				</div>
				<button
					type="button"
					onclick={() => (previewCampaign = null)}
					class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="미리보기 닫기"
				>
					<Icon icon="ph:x-bold" class="text-lg" />
				</button>
			</div>

			<SurveyFormEngine campaign={previewCampaign} previewMode={true} />
		</div>
	</div>
{/if}
