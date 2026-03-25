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

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `API 요청 실패 (${response.status})`);
    }
    return response.json();
}

const BASE_URL = '/v1/admin';

// 📊 대시보드 요약 API
export const adminGetDashboard = () => request(`${BASE_URL}/dashboard`);

// 🌐 메뉴 관리 API
export const adminGetMenus = () => request(`${BASE_URL}/menu`);
export const adminCreateMenu = (data) => request(`${BASE_URL}/menu`, 'POST', data);
export const adminUpdateMenu = (id, data) => request(`${BASE_URL}/menu/${id}`, 'PUT', data);
export const adminDeleteMenu = (id) => request(`${BASE_URL}/menu/${id}`, 'DELETE');

// 📦 앱 레지스트리 API
export const adminGetApps = () => request(`${BASE_URL}/apps`);
export const adminUpdateApp = (id, data) => request(`${BASE_URL}/apps/${id}`, 'PUT', data);

// 📑 게시판 관리 API
export const adminGetBoards = () => request(`${BASE_URL}/boards`);
export const adminCreateBoard = (data) => request(`${BASE_URL}/boards`, 'POST', data);
export const adminUpdateBoard = (id, data) => request(`${BASE_URL}/boards/${id}`, 'PUT', data);
export const adminDeleteBoard = (id) => request(`${BASE_URL}/boards/${id}`, 'DELETE');

// 📦 앱 레지스트리 전체 CRUD (기존에 GET/PUT 만 있었으므로 나머지 추가)
export const adminCreateApp = (data) => request(`${BASE_URL}/apps`, 'POST', data);
export const adminDeleteApp = (id) => request(`${BASE_URL}/apps/${id}`, 'DELETE');

// 🔧 서비스 레지스트리 API (서비스 종류 등록)
export const adminGetServiceRegistries = () => request(`${BASE_URL}/service-registries`);
export const adminCreateServiceRegistry = (data) => request(`${BASE_URL}/service-registries`, 'POST', data);
export const adminDeleteServiceRegistry = (id) => request(`${BASE_URL}/service-registries/${id}`, 'DELETE');

// ⚙️ 서비스 엔진 API (실제 엔진 인스턴스)
export const adminGetServiceEngines = () => request(`${BASE_URL}/service-engines`);
export const adminCreateServiceEngine = (data) => request(`${BASE_URL}/service-engines`, 'POST', data);
export const adminDeleteServiceEngine = (id) => request(`${BASE_URL}/service-engines/${id}`, 'DELETE');

// 🔗 서비스 바인딩 API (앱 ↔ 서비스 연결)
export const adminGetServiceBindings = (appId, instanceId) => request(`${BASE_URL}/service-bindings/${appId}/${instanceId}`);
export const adminCreateServiceBinding = (data) => request(`${BASE_URL}/service-bindings`, 'POST', data);
export const adminDeleteServiceBinding = (id) => request(`${BASE_URL}/service-bindings/${id}`, 'DELETE');

// 🏖️ 휴무 관리 API
export const adminGetAllDayoffs = () => request(`${BASE_URL}/dayoffs`);
export const adminUpdateDayoffStatus = (dayoffId, status) => request(`${BASE_URL}/dayoffs/${dayoffId}/status`, 'PUT', { status });

// 🔒 세션 관리 API
export const adminGetSessions = () => request(`/users/sessions`);
export const adminKickSession = (sessionId) => request(`/users/sessions/kick/${sessionId}`, 'POST');
