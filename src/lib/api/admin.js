import { auth } from '$lib/runes/auth.svelte.js';

/**
 * @function request
 * @description 인증 토큰을 수동으로 주입하여 401 에러를 방지하는 공통 요청 함수
 */
async function request(url, method = 'GET', body = null) {
	const headers = { 'Content-Type': 'application/json' };

	// 🔑 [Auth Check] 인증 정보 확보 (Rune -> localStorage -> Cookie 순서)
	let token = auth.accessToken;
	if (!token && typeof localStorage !== 'undefined') {
		token = localStorage.getItem('accessToken');
	}
	if (!token && typeof document !== 'undefined') {
		const matches = document.cookie.match(/access_token=([^;]+)/);
		if (matches) token = matches[1];
	}

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const options = {
		method,
		headers,
		credentials: 'include'
	};
	if (body) options.body = JSON.stringify(body);

	const response = await fetch(url, options);

	// 401 발생 시 로그 출력 (디버깅용)
	if (response.status === 401) {
		console.error(`❌ [401 Unauthorized] URL: ${url} | Token exists: ${!!token}`);
	}
	// 204 No Content일 경우 빈 객체 반환
	if (response.status === 204) {
		return {};
	}

	if (!response.ok) {
		const err = await response.json().catch(() => ({}));
		throw new Error(
			Array.isArray(err.detail)
				? err.detail.map((item) => item.msg || JSON.stringify(item)).join('; ')
				: err.detail || `API 요청 실패 (${response.status})`
		);
	}
	return response.json();
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
export const adminGetAppData = (appId, slug) => request(`${BASE_URL}/app/data/${appId}/${slug}`);

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

// 🔒 [수동 복사 안전 버전] 백틱 대신 더하기 연산자를 사용하여 치환 오류를 원천 차단합니다.
export const adminGetSessions = () => request('/api/users/sessions');
export const adminKickSession = (sessionId) =>
	request('/api/users/sessions/kick/' + sessionId, 'POST');
