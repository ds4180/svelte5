/**
 * ==============================================================================
 * [Media System Global Configuration v3.2]
 * ==============================================================================
 * ⚠️ 중요: 이 설정 값들은 백엔드 `test/domain/media/media_config.py`와
 * 반드시 1:1로 일치해야 합니다. 한 쪽을 변경하면 반드시 다른 쪽도 동기화하십시오.
 * ==============================================================================
 */

// 1. 접근 계층(Tier) 정의: 백엔드의 저장 폴더명과 동일 (v3.1 대문자 강제)
export const MEDIA_TIERS = {
	PUBLIC: 'PUBLIC',
	PROTECTED: 'PROTECTED',
	PRIVATE: 'PRIVATE',
	SYSTEM: 'SYSTEM'
};

// 2. 미디어 카테고리 정의
export const MEDIA_CATEGORIES = {
	IMAGE: 'image',
	DOCUMENT: 'document',
	ARCHIVE: 'archive'
};

/**
 * [URL 생성 로직]
 * PUBLIC 미디어 자산의 전체 URL을 생성합니다.
 */
export const getMediaUrl = (serverUrl, relativePath) => {
	if (!relativePath) return '';
	if (relativePath.startsWith('http')) return relativePath;

	// [v3.2] /api/uploads/ 경로를 통해 Nginx 직접 서빙 (api 프리픽스 유지)
	const baseUrl = serverUrl.replace(/\/+$/, '');
	const cleanPath = relativePath.startsWith('uploads/') ? relativePath : `uploads/${relativePath}`;
	
	return `${baseUrl}/${cleanPath}`.replace(/([^:]\/)\/+/g, '$1');
};

/**
 * [썸네일 매핑 로직] v3.1
 * MediaAsset 모델에 담긴 썸네일 경로를 사이즈별로 추출합니다.
 */
export const getThumbnailUrl = (serverUrl, asset, size = 'MD') => {
	const DEFAULT_THUMB = '/assets/default-thumbnail.webp';
	if (!asset) return DEFAULT_THUMB;
	
	// 소문자로 변환하여 meta_info.thumbs에서 조회
	const targetSize = size.toLowerCase();
	
	if (asset.meta_info?.thumbs && asset.meta_info.thumbs[targetSize]) {
		return getMediaUrl(serverUrl, asset.meta_info.thumbs[targetSize]);
	}
	
	if (asset.thumbnail_path) {
		return getMediaUrl(serverUrl, asset.thumbnail_path);
	}
	
	return DEFAULT_THUMB;
};

/**
 * [v3.2] Tier 인식 보안 URL 생성
 * PUBLIC → Nginx 직접 서빙 (/api/uploads/PUBLIC/...)
 * PROTECTED/PRIVATE/SYSTEM → FastAPI 보안 서빙 (/api/media/serve/{id})
 */
export const getSecureMediaUrl = (serverUrl, asset, size = null) => {
	if (!asset) return '';
	
	const tier = (asset.access_level || 'PUBLIC').toUpperCase();
	if (tier === 'PUBLIC') {
		return size
			? getThumbnailUrl(serverUrl, asset, size)
			: getMediaUrl(serverUrl, asset.file_path);
	}
	
	// PROTECTED/PRIVATE/SYSTEM → 백엔드 보안 서빙
	const baseUrl = serverUrl.replace(/\/+$/, '');
	let url = `${baseUrl}/media/serve/${asset.id}`;
	if (size) url += `?size=${size}`;
	return url;
};
