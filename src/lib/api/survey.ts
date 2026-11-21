import { fastApi } from './index';

export interface SurveySubField {
	key: string;
	label: string;
	unit?: string;
	min?: number;
	max?: number;
	default?: number;
}

export interface SurveyFieldSchema {
	key: string;
	label: string;
	type:
		| 'text'
		| 'textarea'
		| 'number'
		| 'number_group'
		| 'radio'
		| 'checkbox'
		| 'select'
		| 'vehicle'
		| 'photo'
		| 'date';
	required?: boolean;
	placeholder?: string;
	unit?: string;
	default?: any;
	options?: string[];
	issue_values?: string[];
	fields?: SurveySubField[];
	max_files?: number;
}

export interface SurveyResponseItem {
	id: number;
	campaign_id: number;
	user_id: number | null;
	submitter_snapshot: Record<string, any>;
	submitter_name: string;
	submitter_group: string;
	vehicle_no: string | null;
	answers: Record<string, any>;
	schema_version: number;
	form_snapshot?: SurveyFieldSchema[] | null;
	has_issue: boolean;
	source_app_id: string;
	source_ref_id: string | null;
	status: string;
	submitted_at: string;
	updated_at: string;
}

export interface SurveyCampaign {
	id: number;
	code: string;
	title: string;
	category: string;
	description?: string | null;
	submit_scope: 'USER' | 'VEHICLE';
	target_type: 'ALL' | 'GROUP' | 'USER';
	target_groups: string[];
	target_user_ids: number[];
	form_schema: SurveyFieldSchema[];
	schema_version: number;
	options: Record<string, any>;
	status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
	start_at?: string | null;
	due_at?: string | null;
	created_by?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
	response_count?: number;
	target_count?: number;
	issue_count?: number;
	my_response?: SurveyResponseItem | null;
	my_responses?: SurveyResponseItem[];
}

export interface SurveyVehicleContext {
	vehicles: Array<{ vehicle_no: string; route: string }>;
	my_default_vehicle: string | null;
}

// ============================================================================
// 1. 사용자 / 서비스앱 API (/api/v1/survey)
// ============================================================================
export const getMySurveys = (includeClosed = true) =>
	fastApi<{ campaigns: SurveyCampaign[]; vehicle_context: SurveyVehicleContext }>(
		'GET',
		`/api/v1/survey/my-list?include_closed=${includeClosed}`
	);

export const getSurveyDetail = (campaignId: number | string) =>
	fastApi<{ campaign: SurveyCampaign; vehicle_context: SurveyVehicleContext }>(
		'GET',
		`/api/v1/survey/${campaignId}`
	);

export const getSurveyByCode = (code: string) =>
	fastApi<{ campaign: SurveyCampaign; vehicle_context: SurveyVehicleContext }>(
		'GET',
		`/api/v1/survey/by-code/${encodeURIComponent(code)}`
	);

export const submitSurveyResponse = (
	campaignId: number | string,
	payload: {
		vehicle_no?: string | null;
		answers: Record<string, any>;
		status?: 'DRAFT' | 'SUBMITTED';
		source_app_id?: string;
		source_ref_id?: string | null;
	}
) =>
	fastApi<{ message: string; response: SurveyResponseItem }>(
		'POST',
		`/api/v1/survey/${campaignId}/submit`,
		payload
	);

// ============================================================================
// 2. 관리자 API (/api/v1/admin/survey)
// ============================================================================
export const adminListSurveyCampaigns = (params: Record<string, any> = {}) => {
	const qs = new URLSearchParams();
	Object.entries(params).forEach(([k, v]) => {
		if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
	});
	const q = qs.toString();
	return fastApi<{ campaigns: SurveyCampaign[] }>(
		'GET',
		`/api/v1/admin/survey/campaigns${q ? `?${q}` : ''}`
	);
};

export const adminCreateSurveyCampaign = (payload: Record<string, any>) =>
	fastApi<{ message: string; campaign: SurveyCampaign }>(
		'POST',
		'/api/v1/admin/survey/campaigns',
		payload
	);

export const adminUpdateSurveyCampaign = (
	campaignId: number | string,
	payload: Record<string, any>
) =>
	fastApi<{ message: string; campaign: SurveyCampaign }>(
		'PUT',
		`/api/v1/admin/survey/campaigns/${campaignId}`,
		payload
	);

export const adminDeleteSurveyCampaign = (campaignId: number | string) =>
	fastApi<{ message: string }>('DELETE', `/api/v1/admin/survey/campaigns/${campaignId}`);

export const adminPublishSurveyCampaign = (campaignId: number | string) =>
	fastApi<{ message: string; target_count: number }>(
		'POST',
		`/api/v1/admin/survey/campaigns/${campaignId}/publish`
	);

export const adminCloseSurveyCampaign = (campaignId: number | string) =>
	fastApi<{ message: string }>('POST', `/api/v1/admin/survey/campaigns/${campaignId}/close`);

export const adminRemindSurveyMissing = (campaignId: number | string) =>
	fastApi<{ message: string; sent_count: number }>(
		'POST',
		`/api/v1/admin/survey/campaigns/${campaignId}/remind`
	);

export const adminGetSurveyResponses = (
	campaignId: number | string,
	params: { only_issue?: boolean; vehicle_no?: string; keyword?: string } = {}
) => {
	const qs = new URLSearchParams();
	if (params.only_issue) qs.append('only_issue', 'true');
	if (params.vehicle_no) qs.append('vehicle_no', params.vehicle_no);
	if (params.keyword) qs.append('keyword', params.keyword);
	const q = qs.toString();
	return fastApi<{ campaign: SurveyCampaign; responses: SurveyResponseItem[] }>(
		'GET',
		`/api/v1/admin/survey/campaigns/${campaignId}/responses${q ? `?${q}` : ''}`
	);
};

export const adminGetSurveyStats = (campaignId: number | string) =>
	fastApi<{ campaign: SurveyCampaign; stats: any }>(
		'GET',
		`/api/v1/admin/survey/campaigns/${campaignId}/stats`
	);

export const getSurveyCsvDownloadUrl = (campaignId: number | string) =>
	`/api/v1/admin/survey/campaigns/${campaignId}/export`;

export interface SurveyTemplate {
	id: string;
	name: string;
	category: string;
	description?: string;
	submit_scope: 'USER' | 'VEHICLE';
	form_schema: SurveyFieldSchema[];
	is_builtin?: boolean;
	created_by?: string;
	updated_at?: string;
}

export const adminListSurveyTemplates = () =>
	fastApi<{ templates: SurveyTemplate[] }>('GET', '/api/v1/admin/survey/templates');

export const adminSaveSurveyTemplate = (payload: {
	id?: string;
	name: string;
	category: string;
	description?: string;
	submit_scope: 'USER' | 'VEHICLE';
	form_schema: SurveyFieldSchema[];
}) =>
	fastApi<{ message: string; template: SurveyTemplate }>(
		'POST',
		'/api/v1/admin/survey/templates',
		payload
	);

export const adminDeleteSurveyTemplate = (templateId: string) =>
	fastApi<{ message: string }>(
		'DELETE',
		`/api/v1/admin/survey/templates/${encodeURIComponent(templateId)}`
	);
