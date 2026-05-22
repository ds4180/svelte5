import { fastApi } from './index';

const BASE_URL = '/api/v1/custom';

/**
 * 특정 날짜 기준 활성 노선 목록 조회
 */
export const customGetActiveRouteMasters = (date) => 
	fastApi('GET', `${BASE_URL}/dispatch/active-routes`, { target_date: date });

/**
 * 특정 날짜 & 특정 노선 기준 배차 상세 조회
 */
export const customGetDailyDispatch = (date, routeMasterId) => 
	fastApi('GET', `${BASE_URL}/dispatch`, { target_date: date, route_master_id: routeMasterId });
