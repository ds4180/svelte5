/**
 * ============================================================================
 * [커스텀 도메인 비즈니스 API 모듈 (src/lib/api/custom.ts)]
 * ============================================================================
 * 💡 역할:
 * 배차, 노선 등 현장 비즈니스 도메인 앱을 위한 Type-Safe 통신 함수를 제공합니다.
 */

import { fastApi } from './index';

const BASE_URL = '/api/v1/custom';

/**
 * 특정 날짜 기준 활성 노선 목록 조회
 */
export const customGetActiveRouteMasters = <T = any>(date: string) => 
	fastApi<T>('GET', `${BASE_URL}/dispatch/active-routes`, { target_date: date });

/**
 * 특정 날짜 & 특정 노선 기준 배차 상세 조회
 */
export const customGetDailyDispatch = <T = any>(date: string, routeMasterId: number | string) => 
	fastApi<T>('GET', `${BASE_URL}/dispatch`, { target_date: date, route_master_id: routeMasterId });
