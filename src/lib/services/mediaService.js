/**
 * [Media Service Engine v1.0]
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
 * 자산 목록을 조회합니다.
 */
export async function listAssets(tier, sub_path = '', recursive = true) {
    return await fastApi('GET', `/api/media/admin/list?tier=${tier}&sub_path=${sub_path}&recursive=${recursive}`);
}
