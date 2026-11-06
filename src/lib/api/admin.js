import { fastApi } from '$lib/api';

/**
 * @function request
 * @description 중앙 집중형 통신 관문(fastApi)을 경유하여 Trailing Slash 자동 제거,
 *              AbortController 타임아웃 제어, 401 세션 만료 및 403/500 에러 토스트를 보장하는
 *              전사 통합 관리자 API 요청 함수
 */
async function request(url, method = 'GET', body = null, options = {}) {
	return fastApi(method, url, body || undefined, options);
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
export const adminCreateUser = (data) => request(`${BASE_URL}/users`, 'POST', data);
export const adminDeleteUser = (userId) => request(`${BASE_URL}/users/${userId}`, 'DELETE');
export const adminRestoreUser = (userId) => request(`${BASE_URL}/users/${userId}/restore`, 'PUT');
export const adminUpdateUserRank = (userId, rankLevel) =>
	request(`${BASE_URL}/users/${userId}/rank`, 'PUT', { rank_level: rankLevel });
export const adminGetRegisterMode = () => request(`${BASE_URL}/users/config/register-mode`);
export const adminUpdateRegisterMode = (mode) =>
	request(`${BASE_URL}/users/config/register-mode`, 'PUT', { register_mode: mode });

// 🔔 알림 관리 API (새로 추가)
export const adminGetAlerts = () => request('/api/alert/list'); // 모든 알림 목록
export const adminCreateAlert = (data) => request('/api/alert/create', 'POST', data);
export const adminDeleteAlert = (alertId) => request(`/api/alert/delete/${alertId}`, 'DELETE');
export const adminToggleAlert = (alertId) => request(`/api/alert/toggle/${alertId}`, 'POST');
export const adminUpdateAlert = (alertId, data) =>
	request(`/api/alert/update/${alertId}`, 'PUT', data);
export const adminGetAlertAcknowledgements = (alertId) =>
	request(`/api/alert/${alertId}/acknowledgements`);

// 📱 푸시 알림 관리 API (v2.0 리팩토링 버전)
export const adminGetPushSubscriptions = () => request(`${BASE_URL}/push/subscriptions`);
export const adminSendPush = (data) => request(`${BASE_URL}/push/send`, 'POST', data);
export const adminDeletePushSubscription = (id) => request(`${BASE_URL}/push/subscriptions/${id}`, 'DELETE');
export const adminDeleteAllPushSubscriptions = () => request(`${BASE_URL}/push/subscriptions`, 'DELETE');

// 👥 그룹 관리 API (Redis 기반)
export const adminGetGroups = () => request('/api/v1/admin/groups');
export const adminGetTargetGroupUsers = () => request('/api/v1/admin/groups/candidates');
export const adminGetGroupMembers = (name) => request(`/api/v1/admin/groups/${encodeURIComponent(name)}/members`);
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
 * @description Redis 및 DB에 동기화된 실시간 접속 세션 및 과거 접속 이력을 조회합니다.
 * @param {boolean} [includeHistory=false] - 과거 만료/추방된 접속 기록까지 포함 여부
 */
export const adminGetLiveSessions = (includeHistory = false) =>
	request(`/api/v1/admin/observability/sessions${includeHistory ? '?include_history=true' : ''}`);

/**
 * @function adminKickLiveSession
 * @description 특정 실시간 세션을 즉시 강제 종료(Kicked-out) 처리합니다.
 * @param {number|string} sessionId - 강제 추방 대상 세션 ID 또는 session_key
 */
export const adminKickLiveSession = (sessionId) =>
	request(`/api/v1/admin/observability/sessions/kick/${encodeURIComponent(sessionId)}`, 'POST');

/**
 * @function adminGetAuditLogsExportUrl
 * @description 현재 필터 조건에 맞춘 감사로그 CSV 다운로드 URL을 반환합니다.
 * @param {Object} params - { app_id, log_type, severity, user_id, query, limit }
 */
export const adminGetAuditLogsExportUrl = (params = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, val);
		}
	});
	const qs = query.toString();
	return `/api/v1/admin/observability/logs/export${qs ? `?${qs}` : ''}`;
};

/**
 * @function adminGetSystemLogDownloadUrl
 * @description 서버 시스템 원시 콘솔 로그(.log) 파일 다운로드 URL을 반환합니다.
 */
export const adminGetSystemLogDownloadUrl = () =>
	'/api/v1/admin/observability/system-logs/download';

// ============================================================================
// ⚙️ [전사 환경설정 및 시스템 GC (System Config & GC) API]
// ============================================================================

/**
 * @function adminGetConfigs
 * @description 시스템 전역 환경설정 목록을 조회합니다.
 */
export const adminGetConfigs = () => request(`${BASE_URL}/config`);

/**
 * @function adminUpdateConfig
 * @description 단일 환경설정 키-값을 수정합니다.
 * @param {string} key
 * @param {Object} data - { value, description }
 */
export const adminUpdateConfig = (key, data) =>
	request(`${BASE_URL}/config/${encodeURIComponent(key)}`, 'PUT', data);

/**
 * @function adminUpdateConfigsBatch
 * @description 변경된 시스템 환경설정들을 단일 트랜잭션으로 일괄 저장합니다.
 * @param {Object} configsDict - { key: value, ... }
 */
export const adminUpdateConfigsBatch = (configsDict) =>
	request(`${BASE_URL}/config/batch`, 'PUT', configsDict);

/**
 * @function adminRunSystemGc
 * @description 데이터 보존 주기 초과 이력 및 Redis 메모리 GC를 즉시 수동 실행합니다.
 */
export const adminRunSystemGc = () => request(`${BASE_URL}/system/gc/run`, 'POST');

// ============================================================================
// 🤖 [시스템 비동기 태스크 및 스케줄러 (System Tasks & Scheduler) API]
// ============================================================================

/**
 * @function adminGetTasksSummary
 * @description 로봇 일꾼(워커) 상태 및 4대 핵심 지표(대기/실행/실패/정기예약) 요약을 조회합니다.
 */
export const adminGetTasksSummary = () => request(`${BASE_URL}/tasks/summary`);

/**
 * @function adminGetTaskTypes
 * @description 지원되는 태스크 유형 목록 및 친절한 한글 메타데이터를 조회합니다.
 */
export const adminGetTaskTypes = () => request(`${BASE_URL}/tasks/types`);

/**
 * @function adminGetTasks
 * @description 비동기 및 정기 스케줄 태스크 목록을 조회합니다.
 * @param {Object} params - { status, task_type, is_scheduler, limit, offset }
 */
export const adminGetTasks = (params = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, String(val));
		}
	});
	const qs = query.toString();
	return request(`${BASE_URL}/tasks${qs ? `?${qs}` : ''}`);
};

/**
 * @function adminCreateTask
 * @description 신규 비동기/예약 태스크를 등록합니다.
 * @param {Object} data
 */
export const adminCreateTask = (data) => request(`${BASE_URL}/tasks`, 'POST', data);

/**
 * @function adminRetryTask
 * @description 실패한 태스크를 즉시 다시 실행 큐에 투입합니다.
 * @param {number|string} taskId
 */
export const adminRetryTask = (taskId) =>
	request(`${BASE_URL}/tasks/${taskId}/retry`, 'POST');

/**
 * @function adminUpdateTask
 * @description 대기 중인 태스크의 스케줄, 주기 및 옵션을 수정합니다.
 * @param {number|string} taskId
 * @param {Object} data
 */
export const adminUpdateTask = (taskId, data) =>
	request(`${BASE_URL}/tasks/${taskId}`, 'PUT', data);

/**
 * @function adminCancelTask
 * @description 대기 중이거나 실패한 태스크를 취소 또는 영구 삭제합니다.
 * @param {number|string} taskId
 * @param {boolean} hardDelete
 */
export const adminCancelTask = (taskId, hardDelete = false) =>
	request(`${BASE_URL}/tasks/${taskId}${hardDelete ? '?hard_delete=true' : ''}`, 'DELETE');

/**
 * @function adminClearFailedTasks
 * @description 실패(FAILED) 상태인 모든 고아 태스크를 일괄 영구 삭제합니다.
 */
export const adminClearFailedTasks = () =>
	request(`${BASE_URL}/tasks/failed/clear`, 'DELETE');

// ============================================================================
// 📁 [미디어 및 파일·사진 관리 (Media & File Master) API]
// ============================================================================

/**
 * @function adminGetMediaStats
 * @description 미디어 시스템 전역 통계(전체 개수, 누적 바이트, 티어별 요약)를 조회합니다.
 */
export const adminGetMediaStats = () => request('/api/media/admin/stats');

/**
 * @function adminGetMediaRecent
 * @description 티어별 최근 업로드 미디어 목록을 조회합니다.
 * @param {number} limit
 */
export const adminGetMediaRecent = (limit = 12) =>
	request(`/api/media/admin/recent?limit=${limit}`);

/**
 * @function adminGetMediaList
 * @description 계층(Tier) 및 하위 경로별 미디어 파일·폴더 목록을 조회합니다.
 * @param {Object} params - { tier, sub_path, recursive, show_hidden }
 */
export const adminGetMediaList = (params = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, String(val));
		}
	});
	const qs = query.toString();
	return request(`/api/media/admin/list${qs ? `?${qs}` : ''}`);
};

/**
 * @function adminCreateMediaFolder
 * @description 지정한 계층 및 하위 경로에 새 폴더를 생성합니다.
 * @param {Object} data - { tier, sub_path, folder_name }
 */
export const adminCreateMediaFolder = (data) =>
	request('/api/media/admin/folder/create', 'POST', data, { offline: false }); // 즉시 결과 확인 필요 → 오프라인 우체통 제외

/**
 * @function adminBackupMedia
 * @description 선택된 미디어 파일들의 압축 백업 태스크를 예약합니다.
 * @param {Object} data - { asset_ids, folder_paths, tier }
 */
export const adminBackupMedia = (data) =>
	request('/api/media/admin/backup', 'POST', data);

/**
 * @function adminBulkDeleteMedia
 * @description 선택된 미디어 파일 및 폴더들을 일괄 소프트 삭제(격리)합니다.
 * @param {Object} data - { asset_ids, folder_paths, tier }
 */
export const adminBulkDeleteMedia = (data) =>
	request('/api/media/admin/bulk-delete', 'POST', data);

/**
 * @function adminRunMediaGC
 * @description 미디어 스토리지 가비지 컬렉션(GC) 작업을 즉시 또는 예약 실행합니다.
 * @param {Object} data - { indices, scheduled_at }
 */
export const adminRunMediaGC = (data) =>
	request('/api/media/admin/gc', 'POST', data);

/**
 * @function adminDeleteMedia
 * @description 단일 미디어 자산을 소프트 삭제(격리)합니다.
 * @param {number|string} assetId
 */
export const adminDeleteMedia = (assetId) =>
	request(`/api/media/delete/${assetId}`, 'POST');









