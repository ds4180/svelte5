import { fastApi } from '$lib/api';

/**
 * @function request
 * @description 중앙 집중형 통신 관문(fastApi)을 경유하여 Trailing Slash 자동 제거,
 *              AbortController 타임아웃 제어, 401 세션 만료 및 403/500 에러 토스트를 보장하는
 *              전사 통합 관리자 API 요청 함수
 */
async function request(url, method = 'GET', body = null) {
	return fastApi(method, url, body || undefined);
}

const BASE_URL = '/api/v1/admin';

// 📊 대시보드 요약 API
export const adminGetDashboard = () => request(`${BASE_URL}/dashboard`);

// 🌐 메뉴 관리 API
export const adminGetMenus = () => request(`${BASE_URL}/menu`);
export const adminCreateMenu = (data) => request(`${BASE_URL}/menu`, 'POST', data);
export const adminUpdateMenu = (id, data) => request(`${BASE_URL}/menu/${id}`, 'PUT', data);
export const adminDeleteMenu = (id) => request(`${BASE_URL}/menu/${id}`, 'DELETE');

// 📦 앱 레지스트리 API
export const adminGetApps = () => request(`${BASE_URL}/apps`);
export const adminGetAppDetail = (id) => request(`${BASE_URL}/apps/${id}`);
export const adminCreateApp = (data) => request(`${BASE_URL}/apps`, 'POST', data);
export const adminUpdateApp = (id, data) => request(`${BASE_URL}/apps/${id}`, 'PATCH', data);
export const adminDeleteApp = (id) => request(`${BASE_URL}/apps/${id}`, 'DELETE');
// 📑 게시판 관리 API
export const adminGetBoards = () => request(`${BASE_URL}/boards`);
export const adminCreateBoard = (data) => request(`${BASE_URL}/boards`, 'POST', data);
export const adminUpdateBoard = (id, data) => request(`${BASE_URL}/boards/${id}`, 'PUT', data);
export const adminDeleteBoard = (id) => request(`${BASE_URL}/boards/${id}`, 'DELETE');

// 📦 앱 레지스트리 전체 CRUD (기존에 GET/PUT 만 있었으므로 나머지 추가)

// 🔧 서비스 레지스트리 API (서비스 종류 등록)
export const adminGetServiceRegistries = () => request(`${BASE_URL}/service-registries`);
export const adminCreateServiceRegistry = (data) =>
	request(`${BASE_URL}/service-registries`, 'POST', data);
export const adminDeleteServiceRegistry = (id) =>
	request(`${BASE_URL}/service-registries/${id}`, 'DELETE');

// ⚙️ 서비스 엔진 API (실제 엔진 인스턴스)
export const adminGetServiceEngines = () => request(`${BASE_URL}/service-engines`);
export const adminCreateServiceEngine = (data) =>
	request(`${BASE_URL}/service-engines`, 'POST', data);
export const adminDeleteServiceEngine = (id) =>
	request(`${BASE_URL}/service-engines/${id}`, 'DELETE');

// 🧩 서비스 앱 API (원자적 기능 단위 인스턴스)
export const adminGetServiceApps = () => request(`${BASE_URL}/service-apps`);
export const adminCreateServiceApp = (data) =>
	request(`${BASE_URL}/service-apps`, 'POST', data);
export const adminUpdateServiceApp = (id, data) =>
	request(`${BASE_URL}/service-apps/${id}`, 'PUT', data);

// 🔗 서비스 인스턴스 API (서비스 덩어리/번들)
export const adminGetServiceInstances = () => request(`${BASE_URL}/service-instances`);
export const adminCreateServiceInstance = (data) =>
	request(`${BASE_URL}/service-instances`, 'POST', data);
export const adminUpdateServiceInstance = (id, data) =>
	request(`${BASE_URL}/service-instances/${id}`, 'PUT', data);
export const adminDeleteServiceInstance = (id) =>
	request(`${BASE_URL}/service-instances/${id}`, 'DELETE');

// 🚀 범용 앱 데이터 프로바이더 (Hardcoding Zero의 핵심)
// - 엔드포인트는 /api/v1/admin이 아닌 /api/v1/app/data/{appId}/{slug}를 호출합니다.
// - 페이징 및 검색 파라미터(page, size, keyword 등)를 쿼리스트링으로 변환하여 전달합니다.
export const adminGetAppData = (appId, slug, params = {}) => {
	const searchParams = new URLSearchParams();
	Object.entries(params || {}).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			searchParams.set(key, String(value));
		}
	});
	const queryString = searchParams.toString();
	const url = `/api/v1/app/data/${appId}/${slug}${queryString ? `?${queryString}` : ''}`;
	return request(url);
};

// 🏖️ 휴무 관리 API
export const adminGetAllDayoffs = () => request(`${BASE_URL}/dayoffs`);
export const adminUpdateDayoffStatus = (dayoffId, status) =>
	request(`${BASE_URL}/dayoffs/${dayoffId}/status`, 'PUT', { status });

// 👤 유저 관리 API
export const adminGetUsers = () => request(`${BASE_URL}/users`);
export const adminGetUserDetail = (userId) => request(`${BASE_URL}/users/${userId}`);
export const adminUpdateUserRank = (userId, rankLevel) =>
	request(`${BASE_URL}/users/${userId}/rank`, 'PUT', { rank_level: rankLevel });

// 🔔 알림 관리 API (새로 추가)
export const adminGetAlerts = () => request('/api/alert/list'); // 모든 알림 목록
export const adminCreateAlert = (data) => request('/api/alert/create', 'POST', data);
export const adminDeleteAlert = (alertId) => request(`/api/alert/delete/${alertId}`, 'DELETE');
export const adminToggleAlert = (alertId) => request(`/api/alert/toggle/${alertId}`, 'POST');
export const adminUpdateAlert = (alertId, data) =>
	request(`/api/alert/update/${alertId}`, 'PUT', data);

// 📱 푸시 알림 관리 API (v2.0 리팩토링 버전)
export const adminGetPushSubscriptions = () => request(`${BASE_URL}/push/subscriptions`);
export const adminSendPush = (data) => request(`${BASE_URL}/push/send`, 'POST', data);
export const adminDeletePushSubscription = (id) => request(`${BASE_URL}/push/subscriptions/${id}`, 'DELETE');

// 👥 그룹 관리 API (Redis 기반)
export const adminGetGroups = () => request('/api/v1/admin/groups');
export const adminCreateManualGroup = (data) => request('/api/v1/admin/groups/manual', 'POST', data);
export const adminRefreshDynamicGroups = () => request('/api/v1/admin/groups/dynamic/refresh', 'POST');
export const adminCombineGroups = (data) => request('/api/v1/admin/groups/combine', 'POST', data);
export const adminDeleteGroup = (name) => request('/api/v1/admin/groups/' + name, 'DELETE');

export const adminGetSessions = () => request('/api/users/sessions');
export const adminKickSession = (sessionId) =>
	request('/api/users/sessions/kick/' + sessionId, 'POST');

// 🚐 [v3.0.0] 노선 마스터 및 시간표 연동 API (Route Master & Timetables)
export const adminGetRouteMasters = () => request(BASE_URL + '/route-masters');
export const adminCreateRouteMaster = (data) => request(BASE_URL + '/route-masters', 'POST', data);
export const adminUpdateRouteMaster = (id, data) => request(BASE_URL + '/route-masters/' + id, 'PUT', data);
export const adminDeleteRouteMaster = (id) => request(BASE_URL + '/route-masters/' + id, 'DELETE');

// 🚐 [v3.0.0] 일일 배차 관리 API (Dispatch Management)
export const adminGetActiveRouteMasters = (date) => request(BASE_URL + '/dispatch/active-routes?target_date=' + date);
export const adminGetDailyDispatch = (date, routeMasterId) => request(BASE_URL + '/dispatch?target_date=' + date + '&route_master_id=' + routeMasterId);
export const adminSaveDailyDispatch = (payload) => request(BASE_URL + '/dispatch', 'POST', payload);

// 🔐 [조직·권한 그룹 마스터 API] (PostgreSQL DB groups 기반)
export const adminGetAuthGroupsMaster = (groupType) => 
	request(`/api/v1/admin/auth-groups/master${groupType ? `?group_type=${groupType}` : ''}`);
export const adminCreateAuthGroupMaster = (data) => 
	request('/api/v1/admin/auth-groups/master', 'POST', data);
export const adminUpdateAuthGroupMaster = (groupId, data) => 
	request(`/api/v1/admin/auth-groups/master/${groupId}`, 'PUT', data);
export const adminDeleteAuthGroupMaster = (groupId) => 
	request(`/api/v1/admin/auth-groups/master/${groupId}`, 'DELETE');

// 👤 [사용자 뷰] 회원-그룹 매칭 API
export const adminGetAuthGroupUsers = (query) => 
	request(`/api/v1/admin/auth-groups/users${query ? `?query=${encodeURIComponent(query)}` : ''}`);
export const adminUpdateUserPrimaryGroup = (userId, primaryGroup) => 
	request(`/api/v1/admin/auth-groups/users/${userId}/primary`, 'PATCH', { primary_group: primaryGroup });
export const adminAddUserSecondaryGroup = (userId, code) => 
	request(`/api/v1/admin/auth-groups/users/${userId}/secondary`, 'POST', { code });
export const adminRemoveUserSecondaryGroup = (userId, code) => 
	request(`/api/v1/admin/auth-groups/users/${userId}/secondary/${encodeURIComponent(code)}`, 'DELETE');
export const adminUpdateUserGroupsBatch = (userId, data) => 
	request(`/api/v1/admin/auth-groups/users/${userId}/groups`, 'PUT', data);

// 📱 [앱 뷰] 앱 권한 랭킹 & allow/deny API
export const adminGetAuthGroupApps = () => 
	request('/api/v1/admin/auth-groups/apps');
export const adminUpdateAppPermissions = (appId, data) => 
	request(`/api/v1/admin/auth-groups/apps/${appId}/permissions`, 'PATCH', data);

// 🧩 [인스턴스 뷰] 개별 인스턴스(게시판/페이지/커스텀앱) 통합 권한 API
export const adminGetAuthGroupInstances = () => 
	request('/api/v1/admin/auth-groups/instances');
export const adminUpdateInstancePermissions = (instanceType, targetId, data) => 
	request(`/api/v1/admin/auth-groups/instances/${instanceType}/${targetId}/permissions`, 'PATCH', data);

// ============================================================================
// 🏛️ [통합 감사로그 및 시스템 관제 (Observability & Audit) API]
// ============================================================================

/**
 * @function adminGetObservabilitySummary
 * @description 시스템 관제 상단 4대 핵심 지표 요약(활성 세션, 오늘 접근, 데이터 변경, 에러/보안경보)을 조회합니다.
 */
export const adminGetObservabilitySummary = () =>
	request('/api/v1/admin/observability/summary');

/**
 * @function adminGetAuditLogs
 * @description 전사 통합 감사로그(ACCESS, CHANGE, ERROR, SECURITY)를 다중 조건으로 필터링 조회합니다.
 * @param {Object} params - { app_id, log_type, severity, user_id, date_from, date_to, skip, limit }
 */
export const adminGetAuditLogs = (params = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, val);
		}
	});
	const qs = query.toString();
	return request(`/api/v1/admin/observability/logs${qs ? `?${qs}` : ''}`);
};

/**
 * @function adminGetLiveSessions
 * @description Redis 및 DB에 동기화된 전사 실시간 접속 세션 목록을 조회합니다.
 */
export const adminGetLiveSessions = () =>
	request('/api/v1/admin/observability/sessions');

/**
 * @function adminKickLiveSession
 * @description 특정 실시간 세션을 즉시 강제 종료(Kicked-out) 처리합니다.
 * @param {number|string} sessionId - 강제 추방 대상 세션 ID 또는 session_key
 */
export const adminKickLiveSession = (sessionId) =>
	request(`/api/v1/admin/observability/sessions/kick/${encodeURIComponent(sessionId)}`, 'POST');





