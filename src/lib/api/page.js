import { fastApi } from './index.js';

/**
 * 페이지 엔진 API (v1.1)
 */

// 1. 사용자용 페이지 상세 정보 조회
export const getPageDetail = (slug) => 
    fastApi('GET', `/api/v1/page/detail/${slug}`);

// 2. 관리자용 페이지 목록 조회
export const adminGetPages = () => 
    fastApi('GET', '/api/v1/page/admin/list');

// 3. 관리자용 페이지 생성
export const adminCreatePage = (data) => 
    fastApi('POST', '/api/v1/page/admin/create', data);

// 4. 관리자용 페이지 수정
export const adminUpdatePage = (data) => 
    fastApi('PUT', '/api/v1/page/admin/update', data);

// 5. 관리자용 페이지 삭제
export const adminDeletePage = (pageId) => 
    fastApi('DELETE', `/api/v1/page/admin/delete/${pageId}`);
