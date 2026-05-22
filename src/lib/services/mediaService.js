/**
 * [Media Service Engine v1.1]
 * 업로드, 삭제, 리스트 조회 등 미디어 자산 관련 비즈니스 로직을 담당합니다.
 */
import { fastApi } from '$lib/api';

/**
 * 파일을 서버로 업로드합니다.
 */
export async function uploadFiles(files, { app_id, access_level, sub_path, target_id }) {
	const formData = new FormData();
	files.forEach((file) => formData.append('files', file));

	let url = `/api/media/upload?app_id=${app_id}&access_level=${access_level}&sub_path=${encodeURIComponent(sub_path)}`;
	if (target_id) url += `&target_id=${target_id}`;

	return await fastApi('POST', url, formData);
}

/**
 * 자산을 삭제합니다. (단일 삭제)
 */
export async function deleteAsset(id) {
	return await fastApi('POST', `/api/media/delete/${id}`);
}

/**
 * 자산 목록을 조회합니다. (통합형)
 */
export async function listAssets(tier, sub_path = '', recursive = true) {
	return await fastApi('GET', `/api/media/admin/list`, {
		tier,
		sub_path,
		recursive
	});
}

/**
 * 관리자/스탭용 자산 목록 조회
 */
export async function listStaffAssets(tier, sub_path = '', recursive = true) {
	return await listAssets(tier, sub_path, recursive);
}

/**
 * 일반 사용자용 자산 목록 조회 (PRIVATE 티어 고정)
 */
export async function listUserAssets(sub_path = '', recursive = true) {
	return await listAssets('PRIVATE', sub_path, recursive);
}

/**
 * 폴더 생성
 */
export async function createUserFolder(sub_path, folder_name, tier = 'PRIVATE') {
	return await fastApi('POST', '/api/media/admin/folder/create', {
		tier,
		sub_path,
		folder_name
	});
}
