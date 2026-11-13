/**
 * ============================================================================
 * [페이지(Page) 엔진 전용 API 모듈 (src/lib/api/page.ts)]
 * ============================================================================
 * 💡 역할:
 * 동적/정적 페이지(PageEngine) 조회 및 관리자 CRUD를 위한 Type-Safe 통신 함수를 제공합니다.
 */

import { fastApi } from './index';

export interface PageItem {
	id: number;
	slug: string;
	title: string;
	content?: string;
	content_json?: any;
	status?: 'PUBLISHED' | 'DRAFT' | string;
	is_active?: boolean;
	min_rank?: number;
	redirect_url?: string | null;
	published_at?: string | null;
	expired_at?: string | null;
	view_count?: number;
	created_at?: string;
	updated_at?: string;
	[key: string]: any;
}

export interface PageUpsertPayload {
	id?: number | null;
	slug: string;
	title: string;
	content?: string;
	content_json?: any;
	status?: string;
	is_active?: boolean;
	min_rank?: number;
	redirect_url?: string | null;
	published_at?: string | null;
	expired_at?: string | null;
	[key: string]: any;
}

/**
 * 1. [Public] 슬러그로 특정 페이지 상세 정보 조회
 */
export const getPageDetail = <T = PageItem>(slug: string) =>
	fastApi<T>('GET', `/api/v1/pages/detail/${slug}`);

/**
 * 2. [Public] 현재 활성화된 모든 공개 페이지 목록 조회 (사이드바 등)
 */
export const getPublicPages = <T = PageItem[]>() =>
	fastApi<T>('GET', '/api/v1/pages/list');

/**
 * 3. [Admin] 전체 페이지 목록 조회 (비활성/예약 포함)
 */
export const adminGetPages = <T = PageItem[]>() =>
	fastApi<T>('GET', '/api/v1/admin/pages');

/**
 * 4. [Admin] 새 페이지 생성
 */
export const adminCreatePage = <T = PageItem>(pageData: PageUpsertPayload) =>
	fastApi<T>('POST', '/api/v1/admin/pages', pageData);

/**
 * 5. [Admin] 페이지 정보 수정
 */
export const adminUpdatePage = <T = PageItem>(pageData: PageUpsertPayload) =>
	fastApi<T>('PUT', '/api/v1/admin/pages', pageData);

/**
 * 6. [Admin] 페이지 삭제
 */
export const adminDeletePage = <T = { success?: boolean; message?: string }>(pageId: number | string) =>
	fastApi<T>('DELETE', `/api/v1/admin/pages/${pageId}`);
