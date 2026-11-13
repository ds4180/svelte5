/**
 * ============================================================================
 * [전사 통합 관리자 API 모듈 (src/lib/api/admin.ts)]
 * ============================================================================
 * 💡 역할:
 * 중앙 집중형 통신 관문(fastApi)을 경유하여 Trailing Slash 자동 제거,
 * AbortController 타임아웃 제어, 401 세션 만료 및 403/500 에러 토스트를 보장하는
 * 전사 통합 관리자 Type-Safe API 요청 함수를 제공합니다.
 */

import { fastApi, type FastApiOptions } from '$lib/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

async function request<T = any>(
	url: string,
	method: HttpMethod = 'GET',
	body: any = null,
	options: FastApiOptions = {}
): Promise<T> {
	return fastApi<T>(method, url, body || undefined, options);
}

const BASE_URL = '/api/v1/admin';

// 📊 대시보드 요약 API
export const adminGetDashboard = <T = any>() => request<T>(`${BASE_URL}/dashboard`);

// 🌐 메뉴 관리 API
export const adminGetMenus = <T = any>() => request<T>(`${BASE_URL}/menu`);
export const adminCreateMenu = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/menu`, 'POST', data);
export const adminUpdateMenu = <T = any>(id: number | string, data: Record<string, any>) =>
	request<T>(`${BASE_URL}/menu/${id}`, 'PUT', data);
export const adminDeleteMenu = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/menu/${id}`, 'DELETE');

// 📦 앱 레지스트리 API
export const adminGetApps = <T = any>() => request<T>(`${BASE_URL}/apps`);
export const adminGetAppDetail = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/apps/${id}`);
export const adminCreateApp = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/apps`, 'POST', data);
export const adminUpdateApp = <T = any>(id: number | string, data: Record<string, any>) =>
	request<T>(`${BASE_URL}/apps/${id}`, 'PATCH', data);
export const adminDeleteApp = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/apps/${id}`, 'DELETE');

// 📑 게시판 관리 API
export const adminGetBoards = <T = any>() => request<T>(`${BASE_URL}/boards`);
export const adminCreateBoard = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/boards`, 'POST', data);
export const adminUpdateBoard = <T = any>(id: number | string, data: Record<string, any>) =>
	request<T>(`${BASE_URL}/boards/${id}`, 'PUT', data);
export const adminDeleteBoard = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/boards/${id}`, 'DELETE');

// 🔧 서비스 레지스트리 API (서비스 종류 등록)
export const adminGetServiceRegistries = <T = any>() =>
	request<T>(`${BASE_URL}/service-registries`);
export const adminCreateServiceRegistry = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/service-registries`, 'POST', data);
export const adminDeleteServiceRegistry = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/service-registries/${id}`, 'DELETE');

// ⚙️ 서비스 엔진 API (실제 엔진 인스턴스)
export const adminGetServiceEngines = <T = any>() =>
	request<T>(`${BASE_URL}/service-engines`);
export const adminCreateServiceEngine = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/service-engines`, 'POST', data);
export const adminDeleteServiceEngine = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/service-engines/${id}`, 'DELETE');

// 🧩 서비스 앱 API (원자적 기능 단위 인스턴스)
export const adminGetServiceApps = <T = any>() => request<T>(`${BASE_URL}/service-apps`);
export const adminCreateServiceApp = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/service-apps`, 'POST', data);
export const adminUpdateServiceApp = <T = any>(id: number | string, data: Record<string, any>) =>
	request<T>(`${BASE_URL}/service-apps/${id}`, 'PUT', data);

// 🔗 서비스 인스턴스 API (서비스 덩어리/번들)
export const adminGetServiceInstances = <T = any>() =>
	request<T>(`${BASE_URL}/service-instances`);
export const adminCreateServiceInstance = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/service-instances`, 'POST', data);
export const adminUpdateServiceInstance = <T = any>(
	id: number | string,
	data: Record<string, any>
) => request<T>(`${BASE_URL}/service-instances/${id}`, 'PUT', data);
export const adminDeleteServiceInstance = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/service-instances/${id}`, 'DELETE');

// 🚀 범용 앱 데이터 프로바이더 (Hardcoding Zero의 핵심)
export const adminGetAppData = <T = any>(
	appId: string,
	slug: string,
	params: Record<string, any> = {}
) => {
	const searchParams = new URLSearchParams();
	Object.entries(params || {}).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			searchParams.set(key, String(value));
		}
	});
	const queryString = searchParams.toString();
	const url = `/api/v1/app/data/${appId}/${slug}${queryString ? `?${queryString}` : ''}`;
	return request<T>(url);
};

// 🏖️ 휴무 관리 API
export const adminGetAllDayoffs = <T = any>() => request<T>(`${BASE_URL}/dayoffs`);
export const adminUpdateDayoffStatus = <T = any>(dayoffId: number | string, status: string) =>
	request<T>(`${BASE_URL}/dayoffs/${dayoffId}/status`, 'PUT', { status });

// 👤 유저 관리 API
export const adminGetUsers = <T = any>() => request<T>(`${BASE_URL}/users`);
export const adminGetUserDetail = <T = any>(userId: number | string) =>
	request<T>(`${BASE_URL}/users/${userId}`);
export const adminCreateUser = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/users`, 'POST', data);
export const adminDeleteUser = <T = any>(userId: number | string) =>
	request<T>(`${BASE_URL}/users/${userId}`, 'DELETE');
export const adminRestoreUser = <T = any>(userId: number | string) =>
	request<T>(`${BASE_URL}/users/${userId}/restore`, 'PUT');
export const adminUpdateUserRank = <T = any>(userId: number | string, rankLevel: number) =>
	request<T>(`${BASE_URL}/users/${userId}/rank`, 'PUT', { rank_level: rankLevel });
export const adminGetRegisterMode = <T = any>() =>
	request<T>(`${BASE_URL}/users/config/register-mode`);
export const adminUpdateRegisterMode = <T = any>(mode: string) =>
	request<T>(`${BASE_URL}/users/config/register-mode`, 'PUT', { register_mode: mode });

// 🔔 알림 관리 API
export const adminGetAlerts = <T = any>() => request<T>('/api/alert/list');
export const adminCreateAlert = <T = any>(data: Record<string, any>) =>
	request<T>('/api/alert/create', 'POST', data);
export const adminDeleteAlert = <T = any>(alertId: number | string) =>
	request<T>(`/api/alert/delete/${alertId}`, 'DELETE');
export const adminToggleAlert = <T = any>(alertId: number | string) =>
	request<T>(`/api/alert/toggle/${alertId}`, 'POST');
export const adminUpdateAlert = <T = any>(alertId: number | string, data: Record<string, any>) =>
	request<T>(`/api/alert/update/${alertId}`, 'PUT', data);
export const adminGetAlertAcknowledgements = <T = any>(alertId: number | string) =>
	request<T>(`/api/alert/${alertId}/acknowledgements`);

// 📱 푸시 알림 관리 API
export const adminGetPushSubscriptions = <T = any>() =>
	request<T>(`${BASE_URL}/push/subscriptions`);
export const adminSendPush = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/push/send`, 'POST', data);
export const adminDeletePushSubscription = <T = any>(id: number | string) =>
	request<T>(`${BASE_URL}/push/subscriptions/${id}`, 'DELETE');
export const adminDeleteAllPushSubscriptions = <T = any>() =>
	request<T>(`${BASE_URL}/push/subscriptions`, 'DELETE');

// 👥 그룹 관리 API (Redis 기반)
export const adminGetGroups = <T = any>() => request<T>('/api/v1/admin/groups');
export const adminGetTargetGroupUsers = <T = any>() =>
	request<T>('/api/v1/admin/groups/candidates');
export const adminGetGroupMembers = <T = any>(name: string) =>
	request<T>(`/api/v1/admin/groups/${encodeURIComponent(name)}/members`);
export const adminCreateManualGroup = <T = any>(data: Record<string, any>) =>
	request<T>('/api/v1/admin/groups/manual', 'POST', data);
export const adminRefreshDynamicGroups = <T = any>() =>
	request<T>('/api/v1/admin/groups/dynamic/refresh', 'POST');
export const adminCombineGroups = <T = any>(data: Record<string, any>) =>
	request<T>('/api/v1/admin/groups/combine', 'POST', data);
export const adminDeleteGroup = <T = any>(name: string) =>
	request<T>('/api/v1/admin/groups/' + name, 'DELETE');

export const adminGetSessions = <T = any>() => request<T>('/api/users/sessions');
export const adminKickSession = <T = any>(sessionId: number | string) =>
	request<T>('/api/users/sessions/kick/' + sessionId, 'POST');

// 🚐 노선 마스터 및 시간표 연동 API (Route Master & Timetables)
export const adminGetRouteMasters = <T = any>() => request<T>(BASE_URL + '/route-masters');
export const adminCreateRouteMaster = <T = any>(data: Record<string, any>) =>
	request<T>(BASE_URL + '/route-masters', 'POST', data);
export const adminUpdateRouteMaster = <T = any>(
	id: number | string,
	data: Record<string, any>
) => request<T>(BASE_URL + '/route-masters/' + id, 'PUT', data);
export const adminDeleteRouteMaster = <T = any>(id: number | string) =>
	request<T>(BASE_URL + '/route-masters/' + id, 'DELETE');

// 🚐 일일 배차 관리 API (Dispatch Management)
export const adminGetActiveRouteMasters = <T = any>(date: string) =>
	request<T>(BASE_URL + '/dispatch/active-routes?target_date=' + date);
export const adminGetDailyDispatch = <T = any>(date: string, routeMasterId: number | string) =>
	request<T>(BASE_URL + '/dispatch?target_date=' + date + '&route_master_id=' + routeMasterId);
export const adminSaveDailyDispatch = <T = any>(payload: Record<string, any>) =>
	request<T>(BASE_URL + '/dispatch', 'POST', payload);

// 🔐 조직·권한 그룹 마스터 API (PostgreSQL DB groups 기반)
export const adminGetAuthGroupsMaster = <T = any>(groupType?: string) =>
	request<T>(`/api/v1/admin/auth-groups/master${groupType ? `?group_type=${groupType}` : ''}`);
export const adminCreateAuthGroupMaster = <T = any>(data: Record<string, any>) =>
	request<T>('/api/v1/admin/auth-groups/master', 'POST', data);
export const adminUpdateAuthGroupMaster = <T = any>(
	groupId: number | string,
	data: Record<string, any>
) => request<T>(`/api/v1/admin/auth-groups/master/${groupId}`, 'PUT', data);
export const adminDeleteAuthGroupMaster = <T = any>(groupId: number | string) =>
	request<T>(`/api/v1/admin/auth-groups/master/${groupId}`, 'DELETE');

// 👤 [사용자 뷰] 회원-그룹 매칭 API
export const adminGetAuthGroupUsers = <T = any>(query?: string) =>
	request<T>(
		`/api/v1/admin/auth-groups/users${query ? `?query=${encodeURIComponent(query)}` : ''}`
	);
export const adminUpdateUserPrimaryGroup = <T = any>(
	userId: number | string,
	primaryGroup: string
) =>
	request<T>(`/api/v1/admin/auth-groups/users/${userId}/primary`, 'PATCH', {
		primary_group: primaryGroup
	});
export const adminAddUserSecondaryGroup = <T = any>(userId: number | string, code: string) =>
	request<T>(`/api/v1/admin/auth-groups/users/${userId}/secondary`, 'POST', { code });
export const adminRemoveUserSecondaryGroup = <T = any>(userId: number | string, code: string) =>
	request<T>(
		`/api/v1/admin/auth-groups/users/${userId}/secondary/${encodeURIComponent(code)}`,
		'DELETE'
	);
export const adminUpdateUserGroupsBatch = <T = any>(
	userId: number | string,
	data: Record<string, any>
) => request<T>(`/api/v1/admin/auth-groups/users/${userId}/groups`, 'PUT', data);

// 📱 [앱 뷰] 앱 권한 랭킹 & allow/deny API
export const adminGetAuthGroupApps = <T = any>() =>
	request<T>('/api/v1/admin/auth-groups/apps');
export const adminUpdateAppPermissions = <T = any>(
	appId: number | string,
	data: Record<string, any>
) => request<T>(`/api/v1/admin/auth-groups/apps/${appId}/permissions`, 'PATCH', data);

// 🧩 [인스턴스 뷰] 개별 인스턴스(게시판/페이지/커스텀앱) 통합 권한 API
export const adminGetAuthGroupInstances = <T = any>() =>
	request<T>('/api/v1/admin/auth-groups/instances');
export const adminUpdateInstancePermissions = <T = any>(
	instanceType: string,
	targetId: number | string,
	data: Record<string, any>
) =>
	request<T>(
		`/api/v1/admin/auth-groups/instances/${instanceType}/${targetId}/permissions`,
		'PATCH',
		data
	);

// ============================================================================
// 🏛️ [통합 감사로그 및 시스템 관제 (Observability & Audit) API]
// ============================================================================
export const adminGetObservabilitySummary = <T = any>() =>
	request<T>('/api/v1/admin/observability/summary');

export const adminGetAuditLogs = <T = any>(params: Record<string, any> = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, String(val));
		}
	});
	const qs = query.toString();
	return request<T>(`/api/v1/admin/observability/logs${qs ? `?${qs}` : ''}`);
};

export const adminGetLiveSessions = <T = any>(includeHistory = false) =>
	request<T>(
		`/api/v1/admin/observability/sessions${includeHistory ? '?include_history=true' : ''}`
	);

export const adminKickLiveSession = <T = any>(sessionId: number | string) =>
	request<T>(
		`/api/v1/admin/observability/sessions/kick/${encodeURIComponent(String(sessionId))}`,
		'POST'
	);

export const adminGetAuditLogsExportUrl = (params: Record<string, any> = {}): string => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, String(val));
		}
	});
	const qs = query.toString();
	return `/api/v1/admin/observability/logs/export${qs ? `?${qs}` : ''}`;
};

export const adminGetSystemLogDownloadUrl = (): string =>
	'/api/v1/admin/observability/system-logs/download';

// ============================================================================
// ⚙️ [전사 환경설정 및 시스템 GC (System Config & GC) API]
// ============================================================================
export const adminGetConfigs = <T = any>() => request<T>(`${BASE_URL}/config`);

export const adminUpdateConfig = <T = any>(key: string, data: Record<string, any>) =>
	request<T>(`${BASE_URL}/config/${encodeURIComponent(key)}`, 'PUT', data);

export const adminUpdateConfigsBatch = <T = any>(configsDict: Record<string, any>) =>
	request<T>(`${BASE_URL}/config/batch`, 'PUT', configsDict);

export const adminRunSystemGc = <T = any>() => request<T>(`${BASE_URL}/system/gc/run`, 'POST');

// ============================================================================
// 🤖 [시스템 비동기 태스크 및 스케줄러 (System Tasks & Scheduler) API]
// ============================================================================
export const adminGetTasksSummary = <T = any>() => request<T>(`${BASE_URL}/tasks/summary`);

export const adminGetTaskTypes = <T = any>() => request<T>(`${BASE_URL}/tasks/types`);

export const adminGetTasks = <T = any>(params: Record<string, any> = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, String(val));
		}
	});
	const qs = query.toString();
	return request<T>(`${BASE_URL}/tasks${qs ? `?${qs}` : ''}`);
};

export const adminCreateTask = <T = any>(data: Record<string, any>) =>
	request<T>(`${BASE_URL}/tasks`, 'POST', data);

export const adminRetryTask = <T = any>(taskId: number | string) =>
	request<T>(`${BASE_URL}/tasks/${taskId}/retry`, 'POST');

export const adminUpdateTask = <T = any>(taskId: number | string, data: Record<string, any>) =>
	request<T>(`${BASE_URL}/tasks/${taskId}`, 'PUT', data);

export const adminCancelTask = <T = any>(taskId: number | string, hardDelete = false) =>
	request<T>(`${BASE_URL}/tasks/${taskId}${hardDelete ? '?hard_delete=true' : ''}`, 'DELETE');

export const adminClearFailedTasks = <T = any>() =>
	request<T>(`${BASE_URL}/tasks/failed/clear`, 'DELETE');

// ============================================================================
// 📁 [미디어 및 파일·사진 관리 (Media & File Master) API]
// ============================================================================
export const adminGetMediaStats = <T = any>() => request<T>('/api/media/admin/stats');

export const adminGetMediaRecent = <T = any>(limit = 12) =>
	request<T>(`/api/media/admin/recent?limit=${limit}`);

export const adminGetMediaList = <T = any>(params: Record<string, any> = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, String(val));
		}
	});
	const qs = query.toString();
	return request<T>(`/api/media/admin/list${qs ? `?${qs}` : ''}`);
};

export const adminCreateMediaFolder = <T = any>(data: Record<string, any>) =>
	request<T>('/api/media/admin/folder/create', 'POST', data, { offline: false });

export const adminBackupMedia = <T = any>(data: Record<string, any>) =>
	request<T>('/api/media/admin/backup', 'POST', data);

export const adminBulkDeleteMedia = <T = any>(data: Record<string, any>) =>
	request<T>('/api/media/admin/bulk-delete', 'POST', data);

export const adminRunMediaGC = <T = any>(data: Record<string, any>) =>
	request<T>('/api/media/admin/gc', 'POST', data);

export const adminDeleteMedia = <T = any>(assetId: number | string) =>
	request<T>(`/api/media/delete/${assetId}`, 'POST');

// ============================================================================
// 📄 [페이지(Page) 인스턴스 관리 API (page.ts 통합 re-export)]
// ============================================================================
export {
	adminGetPages,
	adminCreatePage,
	adminUpdatePage,
	adminDeletePage
} from './page';
