/**
 * ============================================================================
 * [미니앱 통합 액션 피드 API 클라이언트 (src/lib/api/miniapp.ts)]
 * ============================================================================
 * 💡 역할:
 * 메모, 알람, 지시사항, 메시지, 전사알림의 미결 건수 및 피드 아이템 CRUD를
 * 중앙 `fastApi` 게이트웨이를 통해 Type-Safe하게 수행합니다.
 */

import { fastApi } from './index';

export type MiniappCategory = 'NOTIFICATION' | 'INSTRUCTION' | 'MESSAGE' | 'MEMO' | 'ALARM' | string;

export interface MiniappCounts {
	NOTIFICATION: number;
	INSTRUCTION: number;
	MESSAGE: number;
	MEMO: number;
	ALARM: number;
	TOTAL: number;
	[key: string]: number;
}

export interface MiniappItem {
	id: number;
	category: MiniappCategory;
	status: 'PENDING' | 'ONGOING' | 'COMPLETED' | 'READ' | string;
	title?: string | null;
	content: string;
	sender_id?: number | null;
	receiver_id?: number | null;
	target_time?: string | null;
	link?: string | null;
	extra_payload?: Record<string, any>;
	created_at?: string;
	updated_at?: string;
	[key: string]: any;
}

export interface MiniappQueryParams {
	category?: string;
	status?: string;
	skip?: number;
	limit?: number;
	[key: string]: any;
}

/**
 * 상단 헤더 뱃지 및 슬라이더 뱃지용 실시간 미결 건수 조회
 */
export const getMiniappCounts = () =>
	fastApi<MiniappCounts>('GET', '/api/v1/miniapps/counts');

/**
 * 사용자의 미니앱 액션 피드 목록 조회
 */
export const getMiniappItems = (params: MiniappQueryParams = {}) => {
	const cleanParams: Record<string, any> = {};
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			cleanParams[key] = val;
		}
	});
	return fastApi<MiniappItem[]>('GET', '/api/v1/miniapps', cleanParams);
};

/**
 * 새 메모, 알람, 메시지, 지시사항 등록
 */
export const createMiniappItem = (data: Partial<MiniappItem>) =>
	fastApi<MiniappItem>('POST', '/api/v1/miniapps', data);

/**
 * 미니앱 아이템 상태 갱신 (지시사항 완료, 메모 완료 등)
 */
export const updateMiniappItem = (id: number | string, data: Partial<MiniappItem>) =>
	fastApi<MiniappItem>('PATCH', `/api/v1/miniapps/${id}`, data);

/**
 * 미니앱 아이템 삭제
 */
export const deleteMiniappItem = (id: number | string) =>
	fastApi<{ success?: boolean }>('DELETE', `/api/v1/miniapps/${id}`);
