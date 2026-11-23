/**
 * ============================================================================
 * [현장 조사·설문 관리자 비즈니스 서비스 (src/lib/services/surveyAdminService.ts)]
 * ============================================================================
 * 💡 역할:
 * - `/v1/admin/survey` 페이지에서 폼 초기화, 문항 편집, 미디어 배포/저장,
 *   미리보기 캠페인 조립, 전역 설정 기본값 반영 비즈니스 로직을 분리합니다.
 */

import * as surveyApi from '$lib/api/survey';
import type {
	SurveyCampaign,
	SurveyFieldSchema,
	SurveySettings,
	SurveyTemplate,
	TargetConflictMode,
	VehicleTargetConfig
} from '$lib/api/survey';
import { publishEditorContentAssets } from '$lib/services/mediaService';

export interface SurveyEditorForm {
	code: string;
	title: string;
	category: string;
	description: string;
	submit_scope: 'USER' | 'VEHICLE';
	target_type: 'ALL' | 'GROUP' | 'USER';
	target_groups: string[];
	target_user_ids: number[];
	vehicle_target: VehicleTargetConfig;
	status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
	due_at: string;
	allow_edit: boolean;
	push_on_open: boolean;
	target_conflict_mode: 'INHERIT' | TargetConflictMode;
	fields: SurveyFieldSchema[];
}

export function createDefaultVehicleTarget(): VehicleTargetConfig {
	return {
		mode: 'ALL',
		routes: [],
		vehicle_nos: [],
		range_start: '',
		range_end: ''
	};
}

function extractVehicleInt(value?: string | null): number | null {
	if (!value) return null;
	const m = String(value).match(/\d+/);
	return m ? Number(m[0]) : null;
}

export function filterTargetVehicles(
	vehicles: Array<{ vehicle_no: string; route: string }>,
	vt?: VehicleTargetConfig | null
): Array<{ vehicle_no: string; route: string }> {
	if (!vt || vt.mode === 'ALL') return vehicles;
	if (vt.mode === 'ROUTE') {
		const routeSet = new Set((vt.routes || []).map((r) => r.trim()).filter(Boolean));
		if (routeSet.size === 0) return [];
		return vehicles.filter((v) => routeSet.has(v.route));
	}
	if (vt.mode === 'VEHICLE') {
		const vnoSet = new Set((vt.vehicle_nos || []).map((x) => x.trim()).filter(Boolean));
		if (vnoSet.size === 0) return [];
		return vehicles.filter((v) => vnoSet.has(v.vehicle_no));
	}
	if (vt.mode === 'RANGE') {
		const rawStart = (vt.range_start || '').trim();
		const rawEnd = (vt.range_end || '').trim();
		if (!rawStart && !rawEnd) return vehicles;
		const sNum = extractVehicleInt(rawStart);
		const eNum = extractVehicleInt(rawEnd);
		return vehicles.filter((v) => {
			const vno = (v.vehicle_no || '').trim();
			const vNum = extractVehicleInt(vno);
			if (vNum !== null && (sNum !== null || eNum !== null)) {
				if (sNum !== null && vNum < sNum) return false;
				if (eNum !== null && vNum > eNum) return false;
				return true;
			}
			if (rawStart && vno < rawStart) return false;
			if (rawEnd && vno > rawEnd) return false;
			return true;
		});
	}
	return vehicles;
}

export const TARGET_CONFLICT_MODE_OPTIONS: ReadonlyArray<{
	value: TargetConflictMode;
	label: string;
	description: string;
}> = [
	{
		value: 'FIRST_COME_OWNER',
		label: '선착순 1건 · 최초 작성자만 수정',
		description: '먼저 제출한 사원만 수정 가능하며, 타인은 같은 차량에 중복 작성할 수 없습니다.'
	},
	{
		value: 'FIRST_COME_SHARED',
		label: '선착순 1건 · 타인도 수정/보완 가능',
		description: '차량당 1건만 유지하되 다른 조사원도 이어서 수정·보완할 수 있습니다.'
	},
	{
		value: 'MULTI_ADMIN_PICK',
		label: '복수 작성 후 관리자 1건 채택',
		description: '여러 사원이 각자 제출한 뒤 관리자가 통계 화면에서 최종 1건을 채택합니다.'
	},
	{
		value: 'MULTI_UNION_RESOLVE',
		label: '복수 작성 후 합집합 + 이견 문항 선택',
		description: '동일 답변 문항은 자동 합의하고, 이견이 생긴 문항만 관리자가 선택해 확정합니다.'
	}
];

export const DEFAULT_SURVEY_SETTINGS: SurveySettings = {
	default_category: 'GENERAL',
	default_submit_scope: 'USER',
	default_allow_edit: true,
	default_push_on_open: true,
	default_max_photos: 3,
	allow_untargeted_admin_submit: true,
	target_conflict_mode: 'FIRST_COME_OWNER'
};

export const SURVEY_FIELD_TYPE_OPTIONS = [
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
] as const;

export function stripHtml(html?: string | null): string {
	if (!html) return '';
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function createEmptySurveyForm(
	settings: SurveySettings = DEFAULT_SURVEY_SETTINGS
): SurveyEditorForm {
	return {
		code: '',
		title: '',
		category: settings.default_category || 'GENERAL',
		description: '',
		submit_scope: settings.default_submit_scope || 'USER',
		target_type: 'ALL',
		target_groups: [],
		target_user_ids: [],
		vehicle_target: createDefaultVehicleTarget(),
		status: 'DRAFT',
		due_at: '',
		allow_edit: settings.default_allow_edit ?? true,
		push_on_open: settings.default_push_on_open ?? true,
		target_conflict_mode: 'INHERIT',
		fields: [{ key: 'q1', label: '질문 1', type: 'text', required: true, placeholder: '' }]
	};
}

export function createFormFromTemplate(
	tpl: SurveyTemplate,
	settings: SurveySettings = DEFAULT_SURVEY_SETTINGS
): SurveyEditorForm {
	return {
		code: '',
		title: tpl.name,
		category: tpl.category || settings.default_category || 'GENERAL',
		description: tpl.description || '',
		submit_scope: tpl.submit_scope || settings.default_submit_scope || 'USER',
		target_type: 'ALL',
		target_groups: [],
		target_user_ids: [],
		vehicle_target: createDefaultVehicleTarget(),
		status: 'DRAFT',
		due_at: '',
		allow_edit: settings.default_allow_edit ?? true,
		push_on_open: settings.default_push_on_open ?? true,
		target_conflict_mode: 'INHERIT',
		fields: JSON.parse(JSON.stringify(tpl.form_schema || []))
	};
}

export function createFormFromCampaign(c: SurveyCampaign, asClone = false): SurveyEditorForm {
	const rawVt = c.options?.vehicle_target;
	const vehicle_target: VehicleTargetConfig =
		rawVt && typeof rawVt === 'object'
			? {
					mode: rawVt.mode || 'ALL',
					routes: [...(rawVt.routes || [])],
					vehicle_nos: [...(rawVt.vehicle_nos || [])],
					range_start: rawVt.range_start || '',
					range_end: rawVt.range_end || ''
				}
			: createDefaultVehicleTarget();
	return {
		code: asClone ? '' : c.code,
		title: asClone ? `${c.title} (사본)` : c.title,
		category: c.category || 'GENERAL',
		description: c.description || '',
		submit_scope: c.submit_scope || 'USER',
		target_type: c.target_type || 'ALL',
		target_groups: [...(c.target_groups || [])],
		target_user_ids: [...(c.target_user_ids || [])],
		vehicle_target,
		status: asClone ? 'DRAFT' : c.status,
		due_at: c.due_at ? c.due_at.slice(0, 16) : '',
		allow_edit: c.options?.allow_edit !== false,
		push_on_open: c.options?.push_on_open !== false,
		target_conflict_mode: (c.options?.target_conflict_mode as TargetConflictMode) || 'INHERIT',
		fields: JSON.parse(JSON.stringify(c.form_schema || []))
	};
}

export function addSurveyField(fields: SurveyFieldSchema[]): SurveyFieldSchema[] {
	const idx = fields.length + 1;
	return [
		...fields,
		{
			key: `q${idx}_${Date.now().toString().slice(-3)}`,
			label: `질문 ${idx}`,
			type: 'text',
			required: true,
			placeholder: ''
		}
	];
}

export function removeSurveyField(fields: SurveyFieldSchema[], idx: number): SurveyFieldSchema[] {
	return fields.filter((_, i) => i !== idx);
}

export function moveSurveyField(
	fields: SurveyFieldSchema[],
	idx: number,
	dir: -1 | 1
): SurveyFieldSchema[] {
	const nextIdx = idx + dir;
	if (nextIdx < 0 || nextIdx >= fields.length) return fields;
	const copy = [...fields];
	const [item] = copy.splice(idx, 1);
	copy.splice(nextIdx, 0, item);
	return copy;
}

export function changeSurveyFieldType(
	fields: SurveyFieldSchema[],
	idx: number,
	nextType: SurveyFieldSchema['type'],
	settings: SurveySettings = DEFAULT_SURVEY_SETTINGS
): SurveyFieldSchema[] {
	const f: SurveyFieldSchema = { ...fields[idx], type: nextType };
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
	if (nextType === 'photo' && !f.max_files) {
		f.max_files = settings.default_max_photos || 3;
	}
	return fields.map((it, i) => (i === idx ? f : it));
}

export function buildPreviewCampaignFromForm(
	form: SurveyEditorForm,
	editingId: number | null
): SurveyCampaign {
	return {
		id: editingId ?? 0,
		code: form.code.trim() || 'PREVIEW',
		title: form.title.trim() || '(제목 없음)',
		category: form.category,
		description: form.description || null,
		submit_scope: form.submit_scope,
		target_type: form.target_type,
		target_groups: form.target_groups,
		target_user_ids: form.target_user_ids,
		form_schema: JSON.parse(JSON.stringify(form.fields || [])),
		schema_version: 1,
		options: {
			allow_edit: form.allow_edit,
			push_on_open: form.push_on_open,
			...(form.submit_scope === 'VEHICLE' ? { vehicle_target: form.vehicle_target } : {}),
			...(form.target_conflict_mode && form.target_conflict_mode !== 'INHERIT'
				? { target_conflict_mode: form.target_conflict_mode }
				: {})
		},
		status: form.status,
		due_at: form.due_at ? `${form.due_at}:00` : null,
		created_at: new Date().toISOString().slice(0, 10)
	};
}

export async function saveSurveyCampaignWithMedia(params: {
	form: SurveyEditorForm;
	editingId: number | null;
	publishNow: boolean;
}): Promise<{ message: string; description: string }> {
	const { form, editingId, publishNow } = params;

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
			push_on_open: form.push_on_open,
			...(form.submit_scope === 'VEHICLE' ? { vehicle_target: form.vehicle_target } : {}),
			...(form.target_conflict_mode && form.target_conflict_mode !== 'INHERIT'
				? { target_conflict_mode: form.target_conflict_mode }
				: {})
		},
		status: publishNow ? 'OPEN' : form.status,
		due_at: form.due_at ? `${form.due_at}:00` : null
	};

	if (editingId) {
		await surveyApi.adminUpdateSurveyCampaign(editingId, payload);
		if (publishNow) {
			await surveyApi.adminPublishSurveyCampaign(editingId);
		}
		return {
			message: publishNow ? '수정 및 배포가 완료되었습니다.' : '조사 양식이 수정되었습니다.',
			description: finalDescription || ''
		};
	}

	await surveyApi.adminCreateSurveyCampaign(payload);
	return {
		message: publishNow ? '새 조사가 생성·배포되었습니다.' : '새 조사 양식이 저장되었습니다.',
		description: finalDescription || ''
	};
}

export async function saveSurveyTemplateWithMedia(params: {
	name: string;
	form: SurveyEditorForm;
	editingId: number | null;
}): Promise<{ message: string; description: string }> {
	let publishedDesc = params.form.description;
	if (publishedDesc.trim()) {
		const pub = await publishEditorContentAssets({
			content: publishedDesc,
			content_json: null,
			app_id: 'survey',
			target_id: params.editingId ? String(params.editingId) : null,
			access_level: 'PROTECTED'
		});
		publishedDesc = pub.content;
	}
	const res = await surveyApi.adminSaveSurveyTemplate({
		name: params.name,
		category: params.form.category,
		description: publishedDesc,
		submit_scope: params.form.submit_scope,
		form_schema: JSON.parse(JSON.stringify(params.form.fields))
	});
	return {
		message: res.message,
		description: publishedDesc
	};
}
