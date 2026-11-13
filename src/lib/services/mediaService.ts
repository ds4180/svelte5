/**
 * ==============================================================================
 * [미디어 엔진 통합 통신 서비스 (src/lib/services/mediaService.ts)]
 * ==============================================================================
 */

import { fastApi } from '$lib/api';

export interface UploadFilesOptions {
	app_id?: string;
	access_level?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' | 'SYSTEM' | string;
	sub_path?: string;
	target_id?: number | string | null;
}

/**
 * 1. 파일 업로드 (단일/다중 자동 대응)
 */
export async function uploadFiles<T = any>(
	files: File[],
	{
		app_id = 'general',
		access_level = 'PUBLIC',
		sub_path = '',
		target_id = null
	}: UploadFilesOptions = {}
): Promise<T> {
	const formData = new FormData();
	files.forEach((f) => formData.append('files', f));

	const query = new URLSearchParams({
		app_id: app_id || 'general',
		access_level: access_level || 'PUBLIC',
		sub_path: sub_path || ''
	});
	if (target_id) query.append('target_id', String(target_id));

	const firstName = files[0]?.name || '파일';
	const label =
		files.length > 1 ? `📷 사진/파일 ${files.length}개 업로드` : `📷 사진 업로드 (${firstName})`;

	return await fastApi<T>('POST', `/api/media/upload?${query.toString()}`, formData, {
		offlineLabel: label
	});
}

/**
 * 2. 자산 삭제 (Soft Delete / 격리)
 */
export async function deleteAsset<T = any>(assetId: number | string): Promise<T> {
	return await fastApi<T>('POST', `/api/media/delete/${assetId}`);
}

/**
 * 3. 자산 목록 조회 (일반 사용자용 - 본인 자산 + 공개 자산)
 */
export async function listAssets<T = any>(
	appId: string | null = null,
	category: string | null = null
): Promise<T> {
	const query = new URLSearchParams();
	if (appId) query.append('app_id', appId);
	if (category) query.append('category', category);
	return await fastApi<T>('GET', `/api/media/list?${query.toString()}`);
}

/**
 * 4. 부서(STAFF) 자산 목록 조회 (Rank 2+ 전용)
 */
export async function listStaffAssets<T = any>(subPath = ''): Promise<T> {
	const query = new URLSearchParams({ sub_path: subPath });
	return await fastApi<T>('GET', `/api/media/staff/list?${query.toString()}`);
}

/**
 * 5. 개인 보관함(USERS) 목록 조회 (Rank 1+ 전용)
 */
export async function listUserAssets<T = any>(subPath = ''): Promise<T> {
	const query = new URLSearchParams({ sub_path: subPath });
	return await fastApi<T>('GET', `/api/media/user/list?${query.toString()}`);
}

/**
 * 6. 개인 보관함(USERS) 내 새 폴더 생성
 */
export async function createUserFolder<T = any>(folderName: string, subPath = ''): Promise<T> {
	return await fastApi<T>('POST', '/api/media/user/folder/create', {
		folder_name: folderName,
		sub_path: subPath
	});
}

/**
 * 7. 선택 자산 공식 배포 (Publish Copy to PUBLIC/POSTS)
 */
export async function publishAssets<T = any>(assetIds: Array<number | string>): Promise<T> {
	return await fastApi<T>('POST', '/api/media/publish', { asset_ids: assetIds });
}
