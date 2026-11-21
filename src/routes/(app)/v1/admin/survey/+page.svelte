<script lang="ts">
	/**
	 * ============================================================================
	 * [관리자 현장 조사·설문 관제 & 양식 빌더 (/v1/admin/survey/+page.svelte)]
	 * ============================================================================
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import * as surveyApi from '$lib/api/survey';
	import type { SurveyCampaign, SurveyFieldSchema, SurveyTemplate } from '$lib/api/survey';
	import SurveyStatsReport from '$lib/components/survey/SurveyStatsReport.svelte';
	import TiptapEditor from '$lib/components/TiptapEditor.svelte';
	import { publishEditorContentAssets } from '$lib/services/mediaService';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let loading = $state(true);
	let campaigns = $state<SurveyCampaign[]>([]);
	let templates = $state<SurveyTemplate[]>([]);
	let groups = $state<any[]>([]);
	let users = $state<any[]>([]);

	// 필터 상태 (과거 이력 검색 지원)
	let filterStatus = $state('');
	let filterCategory = $state('');
	let filterYear = $state('');
	let filterKeyword = $state('');

	// 보고서 모달/패널 상태
	let activeReportCampaign = $state<SurveyCampaign | null>(null);

	// 양식 빌더 & 템플릿 보관함 상태
	let showEditor = $state(false);
	let showTemplateModal = $state(false);
	let templateNameInput = $state('');
	let showSaveTemplateBox = $state(false);
	let savingTemplate = $state(false);
	let editingId = $state<number | null>(null);
	let editorRenderKey = $state(0);
	let saving = $state(false);

	function stripHtml(html?: string | null): string {
		if (!html) return '';
		return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	}

	let form = $state({
		code: '',
		title: '',
		category: 'VEHICLE',
		description: '',
		submit_scope: 'VEHICLE' as 'USER' | 'VEHICLE',
		target_type: 'ALL' as 'ALL' | 'GROUP' | 'USER',
		target_groups: [] as string[],
		target_user_ids: [] as number[],
		status: 'DRAFT' as 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED',
		due_at: '',
		allow_edit: true,
		push_on_open: true,
		fields: [] as SurveyFieldSchema[]
	});

	const FIELD_TYPE_OPTIONS = [
		{ value: 'text', label: '단답 텍스트' },
		{ value: 'textarea', label: '장문 서술' },
		{ value: 'number', label: '숫자 + 단위' },
		{ value: 'number_group', label: '복합 수량 (대/소 등)' },
		{ value: 'radio', label: '단일 선택(버튼)' },
		{ value: 'checkbox', label: '다중 체크박스' },
		{ value: 'select', label: '드롭다운 선택' },
		{ value: 'vehicle', label: '차량번호 선택' },
		{ value: 'photo', label: '사진 첨부' },
		{ value: 'date', label: '날짜 선택' }
	];

	const PRESET_EXTINGUISHER = {
		title: '차량 소화기 현황 및 스티커 상태 점검',
		category: 'VEHICLE',
		submit_scope: 'VEHICLE' as const,
		description: '배정 차량의 대형/소형 소화기 보유 수량과 스티커 훼손·교체 여부를 확인하여 제출해 주세요.',
		fields: [
			{
				key: 'extinguisher_qty',
				label: '차량 소화기 현황 (보유 수량)',
				type: 'number_group',
				required: true,
				fields: [
					{ key: 'large', label: '대형', unit: '개', min: 0, default: 1 },
					{ key: 'small', label: '소형', unit: '개', min: 0, default: 1 }
				]
			},
			{
				key: 'sticker_status',
				label: '소화기 스티커 상태',
				type: 'radio',
				required: true,
				options: ['모두 정상', '일부 교체 필요', '전량 교체 필요'],
				issue_values: ['일부 교체 필요', '전량 교체 필요']
			},
			{
				key: 'sticker_detail',
				label: '상세 내역 (정상/교체 수량 등)',
				type: 'text',
				required: false,
				placeholder: '예: 2개 정상, 1개 교체요'
			},
			{
				key: 'evidence_photo',
				label: '현장 사진 (교체 필요 시 첨부)',
				type: 'photo',
				required: false,
				max_files: 3
			}
		] as SurveyFieldSchema[]
	};

	async function loadAll() {
		loading = true;
		try {
			const [campRes, tplRes, grpRes, usrRes] = await Promise.all([
				surveyApi.adminListSurveyCampaigns({
					status: filterStatus || undefined,
					category: filterCategory || undefined,
					year: filterYear || undefined,
					keyword: filterKeyword.trim() || undefined
				}),
				surveyApi.adminListSurveyTemplates().catch(() => ({ templates: [] })),
				api.adminGetGroups().catch(() => []),
				api.adminGetUsers().catch(() => [])
			]);
			campaigns = campRes.campaigns || [];
			templates = tplRes.templates || [];
			groups = Array.isArray(grpRes) ? grpRes : grpRes?.groups || [];
			users = Array.isArray(usrRes) ? usrRes : usrRes?.users || [];
		} catch (e) {
			toast.error('조사 목록 로드 실패: ' + formatApiError(e, '오류'));
		} finally {
			loading = false;
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
		form = {
			code: '',
			title: tpl.name,
			category: tpl.category || 'GENERAL',
			description: tpl.description || '',
			submit_scope: tpl.submit_scope || 'USER',
			target_type: 'ALL',
			target_groups: [],
			target_user_ids: [],
			status: 'DRAFT',
			due_at: '',
			allow_edit: true,
			push_on_open: true,
			fields: JSON.parse(JSON.stringify(tpl.form_schema || []))
		};
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
			let publishedDesc = form.description;
			if (publishedDesc.trim()) {
				const pub = await publishEditorContentAssets({
					content: publishedDesc,
					content_json: null,
					app_id: 'survey',
					target_id: editingId ? String(editingId) : null,
					access_level: 'PROTECTED'
				});
				publishedDesc = pub.content;
				form.description = publishedDesc;
			}
			const res = await surveyApi.adminSaveSurveyTemplate({
				name,
				category: form.category,
				description: publishedDesc,
				submit_scope: form.submit_scope,
				form_schema: JSON.parse(JSON.stringify(form.fields))
			});
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

	function openCreateModal(useExtinguisherPreset = false) {
		editingId = null;
		const preset = useExtinguisherPreset ? PRESET_EXTINGUISHER : null;
		form = {
			code: '',
			title: preset?.title || '',
			category: preset?.category || 'GENERAL',
			description: preset?.description || '',
			submit_scope: preset?.submit_scope || 'USER',
			target_type: 'ALL',
			target_groups: [],
			target_user_ids: [],
			status: 'DRAFT',
			due_at: '',
			allow_edit: true,
			push_on_open: true,
			fields: preset
				? JSON.parse(JSON.stringify(preset.fields))
				: [{ key: 'q1', label: '질문 1', type: 'text', required: true, placeholder: '' }]
		};
		showEditor = true;
	}

	function openEditModal(c: SurveyCampaign, asClone = false) {
		editingId = asClone ? null : c.id;
		form = {
			code: asClone ? '' : c.code,
			title: asClone ? `${c.title} (사본)` : c.title,
			category: c.category || 'GENERAL',
			description: c.description || '',
			submit_scope: c.submit_scope || 'USER',
			target_type: c.target_type || 'ALL',
			target_groups: [...(c.target_groups || [])],
			target_user_ids: [...(c.target_user_ids || [])],
			status: asClone ? 'DRAFT' : c.status,
			due_at: c.due_at ? c.due_at.slice(0, 16) : '',
			allow_edit: c.options?.allow_edit !== false,
			push_on_open: c.options?.push_on_open !== false,
			fields: JSON.parse(JSON.stringify(c.form_schema || []))
		};
		showEditor = true;
	}

	function addField() {
		const idx = form.fields.length + 1;
		form.fields = [
			...form.fields,
			{
				key: `q${idx}_${Date.now().toString().slice(-3)}`,
				label: `질문 ${idx}`,
				type: 'text',
				required: true,
				placeholder: ''
			}
		];
	}

	function removeField(idx: number) {
		form.fields = form.fields.filter((_, i) => i !== idx);
	}

	function moveField(idx: number, dir: -1 | 1) {
		const nextIdx = idx + dir;
		if (nextIdx < 0 || nextIdx >= form.fields.length) return;
		const copy = [...form.fields];
		const [item] = copy.splice(idx, 1);
		copy.splice(nextIdx, 0, item);
		form.fields = copy;
	}

	function onFieldTypeChange(idx: number, nextType: SurveyFieldSchema['type']) {
		const f = { ...form.fields[idx], type: nextType };
		if (['radio', 'checkbox', 'select'].includes(nextType) && !f.options?.length) {
			f.options = ['정상', '교체 필요'];
			f.issue_values = ['교체 필요'];
		}
		if (nextType === 'number_group' && !f.fields?.length) {
			f.fields = [
				{ key: 'item1', label: '항목1', unit: '개', min: 0, default: 0 },
				{ key: 'item2', label: '항목2', unit: '개', min: 0, default: 0 }
			];
		}
		form.fields = form.fields.map((it, i) => (i === idx ? f : it));
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
			let finalDescription: string | null = form.description.trim() || null;
			if (finalDescription) {
				const publishedMedia = await publishEditorContentAssets({
					content: finalDescription,
					content_json: null,
					app_id: 'survey',
					target_id: editingId ? String(editingId) : null,
					access_level: 'PROTECTED'
				});
				finalDescription = publishedMedia.content;
				form.description = finalDescription;
			}

			const payload = {
				code: form.code.trim() || undefined,
				title: form.title.trim(),
				category: form.category,
				description: finalDescription,
				submit_scope: form.submit_scope,
				target_type: form.target_type,
				target_groups: form.target_groups,
				target_user_ids: form.target_user_ids,
				form_schema: form.fields,
				options: {
					allow_edit: form.allow_edit,
					push_on_open: form.push_on_open
				},
				status: publishNow ? 'OPEN' : form.status,
				due_at: form.due_at ? `${form.due_at}:00` : null
			};

			if (editingId) {
				await surveyApi.adminUpdateSurveyCampaign(editingId, payload);
				if (publishNow) {
					await surveyApi.adminPublishSurveyCampaign(editingId);
				}
				toast.success(publishNow ? '수정 및 배포가 완료되었습니다.' : '조사 양식이 수정되었습니다.');
			} else {
				await surveyApi.adminCreateSurveyCampaign(payload);
				toast.success(publishNow ? '새 조사가 생성·배포되었습니다.' : '새 조사 양식이 저장되었습니다.');
			}
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

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 md:px-6 lg:px-8">
	<!-- 헤더 -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-indigo-400 uppercase">
					<Icon icon="solar:clipboard-list-bold" class="text-xs" />
					Survey & Inspection
				</span>
				<span class="text-xs font-bold text-slate-400">/v1/admin/survey</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900">
				현장 <span class="text-indigo-600">조사·설문</span> 관제센터
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				JSONB 동적 조사 양식 생성·배포, 미제출자 독촉 푸시, 실시간 통계 보고 및 과거 이력 조회
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => (showTemplateModal = true)}
				class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100"
			>
				<Icon icon="solar:folder-with-files-bold-duotone" class="text-sm" />
				<span>템플릿 불러오기 / 관리 ({templates.length})</span>
			</button>
			<button
				type="button"
				onclick={() => openCreateModal(false)}
				class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
			>
				<Icon icon="solar:add-circle-bold" class="text-base" />
				<span>새 조사 만들기</span>
			</button>
			<button
				type="button"
				onclick={loadAll}
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
			>
				<Icon icon="solar:refresh-bold" class="text-sm" />
				<span>새로고침</span>
			</button>
			<a
				href="/v1/admin"
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	{#if activeReportCampaign}
		<div class="rounded-3xl border-2 border-indigo-200 bg-white p-6 shadow-md">
			<SurveyStatsReport campaign={activeReportCampaign} onClose={() => (activeReportCampaign = null)} />
		</div>
	{/if}

	<!-- 과거 이력 & 상태 검색 바 -->
	<div class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4">
		<select bind:value={filterStatus} onchange={loadAll} class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">
			<option value="">전체 상태</option>
			<option value="OPEN">진행중 (OPEN)</option>
			<option value="DRAFT">작성중 (DRAFT)</option>
			<option value="CLOSED">마감/과거이력 (CLOSED)</option>
		</select>
		<select bind:value={filterCategory} onchange={loadAll} class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">
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

	<!-- 캠페인 목록 테이블 -->
	<div class="overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-sm">
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-slate-200 text-xs">
				<thead class="bg-slate-50 text-left font-black text-slate-600">
					<tr>
						<th class="px-4 py-3">상태</th>
						<th class="px-4 py-3">조사명 / 코드</th>
						<th class="px-4 py-3">분류 / 단위</th>
						<th class="px-4 py-3">제출 현황</th>
						<th class="px-4 py-3">이상/교체</th>
						<th class="px-4 py-3">마감 / 생성일</th>
						<th class="px-4 py-3 text-right">관리 액션</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if loading}
						<tr>
							<td colspan="7" class="py-12 text-center font-bold text-slate-400">불러오는 중...</td>
						</tr>
					{:else if campaigns.length === 0}
						<tr>
							<td colspan="7" class="py-12 text-center font-bold text-slate-400">등록된 조사 캠페인이 없습니다.</td>
						</tr>
					{:else}
						{#each campaigns as c}
							<tr class="hover:bg-slate-50/70">
								<td class="px-4 py-3">
									<span
										class="rounded-full px-2.5 py-1 text-[10px] font-black {c.status === 'OPEN'
											? 'bg-emerald-100 text-emerald-700'
											: c.status === 'DRAFT'
												? 'bg-amber-100 text-amber-700'
												: 'bg-slate-200 text-slate-600'}"
									>
										{c.status}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="font-black text-slate-900">{c.title}</div>
									<div class="mt-0.5 text-[11px] font-medium text-slate-400">코드: {c.code} · 문항 {c.form_schema?.length || 0}개</div>
								</td>
								<td class="px-4 py-3 font-bold text-slate-700">
									<div>{c.category}</div>
									<div class="text-[11px] text-slate-400">{c.submit_scope === 'VEHICLE' ? '차량별' : '사원별'} · {c.target_type}</div>
								</td>
								<td class="px-4 py-3 font-black text-indigo-700">
									{c.response_count ?? 0}건 <span class="font-bold text-slate-400">/ 대상 {c.target_count ?? 0}명</span>
								</td>
								<td class="px-4 py-3">
									{#if (c.issue_count ?? 0) > 0}
										<span class="rounded-full bg-rose-100 px-2.5 py-0.5 font-black text-rose-700">{c.issue_count}건</span>
									{:else}
										<span class="font-bold text-slate-400">0건</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-slate-500">
									<div>마감: {c.due_at ? c.due_at.replace('T', ' ').slice(0, 16) : '상시'}</div>
									<div class="text-[11px] text-slate-400">생성: {c.created_at}</div>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex flex-wrap justify-end gap-1.5">
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
											title="과거 양식을 복제해 새 조사 생성"
										>
											복제
										</button>
										<button
											type="button"
											onclick={() => saveCampaignAsTemplate(c)}
											class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
											title="이 양식을 템플릿 보관함에 저장"
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
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- 양식 빌더 모달 -->
{#if showEditor}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
		<div class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
			<div class="flex items-center justify-between border-b border-slate-200 pb-4">
				<div>
					<h2 class="text-xl font-black text-slate-900">
						{editingId ? '조사 양식 수정' : '새 조사 양식 만들기'}
					</h2>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						JSONB 동적 스키마를 시각적으로 조립합니다. 서비스앱 연결 시 식별 코드(code)를 사용합니다.
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
										{tpl.is_builtin ? '[기본]' : '[사용자]'} {tpl.name} ({tpl.form_schema?.length || 0}문항)
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
						<label class="mb-1 block text-xs font-black text-slate-700">식별 코드 (선택, 미입력 시 자동생성)</label>
						<input
							type="text"
							bind:value={form.code}
							placeholder="예: 202611-extinguisher"
							class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-black text-slate-700">분류</label>
						<select bind:value={form.category} class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800">
							<option value="VEHICLE">차량 (VEHICLE)</option>
							<option value="SAFETY">안전 (SAFETY)</option>
							<option value="HR">인사/총무 (HR)</option>
							<option value="GENERAL">일반 (GENERAL)</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-xs font-black text-slate-700">제출 단위</label>
						<select bind:value={form.submit_scope} class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-800">
							<option value="USER">사원별 1건 (USER)</option>
							<option value="VEHICLE">차량별 1건 (VEHICLE)</option>
						</select>
					</div>
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
							<span class="block text-xs font-black text-slate-700">안내 문구 (사진·이미지 첨부 가능)</span>
							<span class="text-[11px] font-bold text-indigo-600">예시 사진·안내문 리치 에디터</span>
						</div>
						<div class="overflow-hidden rounded-2xl border border-slate-300 bg-white">
							{#key editorRenderKey}
								<TiptapEditor bind:content={form.description} slug="survey" />
							{/key}
						</div>
					</div>
				</div>

				<!-- 대상자 지정 -->
				<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<span class="text-xs font-black text-slate-800">대상자 범위</span>
						<div class="flex gap-2">
							{#each ['ALL', 'GROUP', 'USER'] as t}
								<button
									type="button"
									onclick={() => (form.target_type = t as 'ALL' | 'GROUP' | 'USER')}
									class="rounded-lg px-3 py-1 text-xs font-black {form.target_type === t
										? 'bg-indigo-600 text-white'
										: 'bg-white text-slate-600 border border-slate-300'}"
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
									class="rounded-lg border px-2.5 py-1 text-xs font-bold {form.target_groups.includes(gname)
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
									class="rounded-lg border px-2.5 py-1 text-xs font-bold {form.target_user_ids.includes(u.id)
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
							<input type="checkbox" bind:checked={form.allow_edit} class="rounded text-indigo-600" />
							<span>마감 전 제출자 수정 허용</span>
						</label>
						<label class="inline-flex items-center gap-1.5">
							<input type="checkbox" bind:checked={form.push_on_open} class="rounded text-indigo-600" />
							<span>배포 시 대상자 Web Push 자동 발송</span>
						</label>
					</div>
				</div>

				<!-- 질문 빌더 -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-black text-slate-900">질문 문항 구성 ({form.fields.length}개)</span>
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
						<div class="rounded-2xl border border-slate-300 bg-slate-50/70 p-4 space-y-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-xs font-black text-indigo-700">문항 #{idx + 1}</span>
								<div class="flex items-center gap-1">
									<button type="button" onclick={() => moveField(idx, -1)} class="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200">▲</button>
									<button type="button" onclick={() => moveField(idx, 1)} class="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200">▼</button>
									<button type="button" onclick={() => removeField(idx)} class="rounded px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100">삭제</button>
								</div>
							</div>

							<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<div>
									<label class="mb-1 block text-[11px] font-black text-slate-600">질문 제목 *</label>
									<input type="text" bind:value={field.label} class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold" />
								</div>
								<div>
									<label class="mb-1 block text-[11px] font-black text-slate-600">질문 Key (영문)</label>
									<input type="text" bind:value={field.key} class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono" />
								</div>
								<div>
									<label class="mb-1 block text-[11px] font-black text-slate-600">입력 타입</label>
									<select
										value={field.type}
										onchange={(e) => onFieldTypeChange(idx, e.currentTarget.value as SurveyFieldSchema['type'])}
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
									<input type="checkbox" bind:checked={field.required} class="rounded text-indigo-600" />
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
										<label class="mb-1 block text-[11px] font-black text-slate-600">선택지 (쉼표 구분)</label>
										<input
											type="text"
											value={(field.options || []).join(', ')}
											oninput={(e) => {
												field.options = e.currentTarget.value.split(',').map((s) => s.trim()).filter(Boolean);
											}}
											class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
										/>
									</div>
									<div>
										<label class="mb-1 block text-[11px] font-black text-rose-600">이상/교체 판정 값 (쉼표 구분)</label>
										<input
											type="text"
											value={(field.issue_values || []).join(', ')}
											oninput={(e) => {
												field.issue_values = e.currentTarget.value.split(',').map((s) => s.trim()).filter(Boolean);
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
												field.fields = [...(field.fields || []), { key: `s${subIdx}`, label: `항목${subIdx}`, unit: '개', min: 0, default: 0 }];
											}}
											class="rounded bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-600 border border-indigo-200"
										>
											+ 하위 항목 추가
										</button>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each field.fields || [] as sub, sIdx}
											<div class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
												<input type="text" bind:value={sub.label} placeholder="라벨" class="w-16 font-bold border-b border-slate-200" />
												<input type="text" bind:value={sub.key} placeholder="key" class="w-16 font-mono text-[11px] border-b border-slate-200" />
												<input type="text" bind:value={sub.unit} placeholder="단위" class="w-10 text-center border-b border-slate-200" />
												<button
													type="button"
													onclick={() => (field.fields = (field.fields || []).filter((_, j) => j !== sIdx))}
													class="text-rose-500 font-bold"
												>×</button>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
				<button
					type="button"
					onclick={() => {
						templateNameInput = form.title.trim();
						showSaveTemplateBox = true;
					}}
					class="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100"
				>
					<Icon icon="solar:bookmark-bold" class="text-sm text-indigo-600" />
					<span>템플릿으로 저장</span>
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
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
		<div class="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
			<div class="flex items-center justify-between border-b border-slate-200 pb-4">
				<div>
					<h2 class="text-xl font-black text-slate-900">조사 양식 템플릿 보관함</h2>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						저장된 양식 템플릿을 불러와 바로 새 조사를 만들거나, 더 이상 쓰지 않는 사용자 템플릿을 삭제합니다.
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
					<div class="flex flex-col justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center">
						<div class="space-y-1">
							<div class="flex flex-wrap items-center gap-1.5">
								<span
									class="rounded-full px-2 py-0.5 text-[10px] font-black {tpl.is_builtin
										? 'bg-slate-900 text-white'
										: 'bg-indigo-100 text-indigo-700'}"
								>
									{tpl.is_builtin ? '기본 제공' : '저장됨'}
								</span>
								<span class="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-600 border border-slate-200">
									{tpl.category} · {tpl.submit_scope === 'VEHICLE' ? '차량별' : '사원별'}
								</span>
								<span class="text-[11px] font-bold text-slate-500">{tpl.form_schema?.length || 0}문항</span>
							</div>
							<h3 class="text-sm font-black text-slate-900">{tpl.name}</h3>
							{#if stripHtml(tpl.description)}
								<p class="line-clamp-2 text-xs font-medium text-slate-500">{stripHtml(tpl.description)}</p>
							{/if}
							<div class="flex flex-wrap gap-1 pt-1">
								{#each tpl.form_schema || [] as f}
									<span class="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
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
					<div class="py-12 text-center text-xs font-bold text-slate-400">등록된 템플릿이 없습니다.</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
