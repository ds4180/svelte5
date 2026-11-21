import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * 구버전 복수형 관리자 경로(/v1/admin/boards) 접근 시 정규 경로(/v1/admin/board)로 영구 리다이렉트
 */
export const load: PageServerLoad = async () => {
	throw redirect(301, '/v1/admin/board');
};
