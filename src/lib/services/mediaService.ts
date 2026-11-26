/**
 * ==============================================================================
 * [미디어 엔진 통합 통신 서비스 (src/lib/services/mediaService.ts)]
 * ==============================================================================
 */

import { fastApi } from '$lib/api';
import { getSecureMediaUrl, type MediaAssetLike } from '$lib/config/media';

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
 * 3. 개인 보관함(USERS) 등 지정 경로 하위 새 폴더 보장/생성 (통합 엔드포인트 연동)
 */
export async function createUserFolder<T = any>(
	subPath: string,
	folderName: string,
	tier: string = 'PRIVATE'
): Promise<T> {
	return await fastApi<T>(
		'POST',
		'/api/media/admin/folder/create',
		{
			tier,
			sub_path: subPath,
			folder_name: folderName
		},
		{ offline: false }
	);
}

export interface PublishAssetsPayload {
	asset_ids: number[];
	app_id?: string;
	target_id?: string | null;
	access_level?: 'PUBLIC' | 'PROTECTED' | string;
	sub_path?: string;
}

const pendingPrivateAssetIds = new Set<number>();

/**
 * 에디터 세션에서 개인 보관함(PRIVATE)에 임시 업로드된 자산 ID 등록
 */
export function registerPendingPrivateAsset(assetId: number | string) {
	const id = Number(assetId);
	if (Number.isFinite(id) && id > 0) {
		pendingPrivateAssetIds.add(id);
	}
}

/**
 * 7. 개인 보관함(PRIVATE) 자산을 서비스 영역(PUBLIC/PROTECTED)으로 물리 복사 배포
 */
export async function publishAssets<T = any>(
	payloadOrIds: PublishAssetsPayload | Array<number | string>
): Promise<T> {
	const payload = Array.isArray(payloadOrIds) ? { asset_ids: payloadOrIds } : payloadOrIds;
	return await fastApi<T>('POST', '/api/media/publish', payload);
}

/**
 * 8. 글 저장 시 본문(HTML/JSON) 내 임시 개인 자산(/media/serve/{id})을 서비스 영역으로 물리 복사하고 URL을 치환
 */
export async function publishEditorContentAssets(params: {
	content: string;
	content_json?: any;
	app_id: string;
	target_id?: string | null;
	access_level: 'PUBLIC' | 'PROTECTED' | string;
	sub_path?: string;
	serverUrl?: string;
}): Promise<{ content: string; content_json: any; publishedAssetIds: number[] }> {
	const {
		content,
		content_json = null,
		app_id,
		target_id = null,
		access_level,
		sub_path = '',
		serverUrl = ''
	} = params;

	if (!content || pendingPrivateAssetIds.size === 0) {
		return { content, content_json, publishedAssetIds: [] };
	}

	const serveRegex = /\/media\/serve\/(\d+)/g;
	const foundIds = new Set<number>();
	let match: RegExpExecArray | null;
	while ((match = serveRegex.exec(content)) !== null) {
		const id = Number(match[1]);
		if (pendingPrivateAssetIds.has(id)) {
			foundIds.add(id);
		}
	}

	if (foundIds.size === 0) {
		return { content, content_json, publishedAssetIds: [] };
	}

	const assetIds = Array.from(foundIds);
	const publishedList = await publishAssets<MediaAssetLike[]>({
		asset_ids: assetIds,
		app_id,
		target_id: target_id ? String(target_id) : null,
		access_level,
		sub_path
	});

	if (!Array.isArray(publishedList) || publishedList.length === 0) {
		return { content, content_json, publishedAssetIds: [] };
	}

	const urlMap = new Map<number, string>();
	const publishedAssetIds: number[] = [];
	publishedList.forEach((newAsset, idx) => {
		const srcId = Number(newAsset?.meta_info?.published_from ?? assetIds[idx]);
		const newUrl = getSecureMediaUrl(serverUrl, newAsset);
		if (newAsset?.id) {
			publishedAssetIds.push(Number(newAsset.id));
		}
		if (srcId && newUrl) {
			urlMap.set(srcId, newUrl);
			pendingPrivateAssetIds.delete(srcId);
		}
	});

	if (urlMap.size === 0) {
		return { content, content_json, publishedAssetIds };
	}

	let nextContent = content;
	let nextJsonStr = content_json ? JSON.stringify(content_json) : null;

	for (const [oldId, newUrl] of urlMap.entries()) {
		const oldPattern = new RegExp(`(?:https?:\\/\\/[^"'\\s)]*)?(?:\\/api)?\\/media\\/serve\\/${oldId}(?:\\?[^"'\\s)]*)?`, 'g');
		nextContent = nextContent.replace(oldPattern, newUrl);
		if (nextJsonStr) {
			nextJsonStr = nextJsonStr.replace(oldPattern, newUrl);
		}
	}

	return {
		content: nextContent,
		content_json: nextJsonStr ? JSON.parse(nextJsonStr) : content_json,
		publishedAssetIds
	};
}
