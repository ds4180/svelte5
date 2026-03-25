import { env } from '$env/dynamic/public';
import { auth } from '$lib/runes/auth.svelte.js';

/**
 * FastAPI 백엔드와 통신하는 중앙 집중형 통신 함수 (표준 v1.1 준수)
 * @param {string} method - HTTP 메서드 (GET, POST 등)
 * @param {string} url - 요청 주소 (예: '/v1/app/board/list')
 * @param {Object} [params] - 요청 본문 데이터 또는 쿼리 파라미터
 * @param {Function} [success_callback] - 성공 시 실행할 콜백 (Legacy 대응)
 * @param {Function} [failure_callback] - 실패 시 실행할 콜백 (Legacy 대응)
 * @returns {Promise<any>} - 서버 응답 데이터
 */
export const fastApi = async (method, url, params = {}, success_callback, failure_callback) => {
    const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || "";
    let _url = PUBLIC_SERVER_URL + url;
    let body = params;
    
    // 1. 헤더 설정 및 자동 토큰 주입 (auth 싱글톤 활용)
    const headers = {};
    if (auth.accessToken) {
        headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }

    // 2. 메서드 및 바디 처리
    if (method.toLowerCase() === 'get') {
        _url += "?" + new URLSearchParams(params);
        body = undefined;
    } else if (!(params instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(params);
    }

    const options = {
        method: method,
        headers: headers,
        body: body,
    };

    try {
        const response = await fetch(_url, options);
        
        // 401 Unauthorized 처리 (사용자님께서 정의하신 리프레시 로직 등과 연계 가능)
        if (response.status === 401) {
            console.warn("[API] 인증 에러(401) 발생. 로그아웃 또는 세션 갱신이 필요합니다.");
        }

        const text = await response.text();
        let json = {};
        if (text) {
            try {
                json = JSON.parse(text);
            } catch (e) {
                // JSON 파싱 실패 시 원문 반환
                json = { detail: text };
            }
        }

        if (response.ok) {
            if (success_callback) success_callback(json);
            return json;
        } else {
            console.error(`[API Error] ${response.status}:`, json);
            if (failure_callback) failure_callback(json);
            return Promise.reject(json);
        }
    } catch (error) {
        const errorData = { detail: "서버 연결에 실패했습니다." };
        if (failure_callback) failure_callback(errorData);
        return Promise.reject(errorData);
    }
};

/**
 * 기존 프로젝트와의 호환성을 위한 소문자 별칭
 */
export const fastapi = fastApi;

// 기본 내보내기
export default fastApi;
