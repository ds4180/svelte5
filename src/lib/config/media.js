/**
 * ==============================================================================
 * [Media System Global Configuration v3.1]
 * ==============================================================================
 */

export const MEDIA_TIERS = {
	PUBLIC: 'PUBLIC',
	PROTECTED: 'PROTECTED',
	PRIVATE: 'PRIVATE',
	SYSTEM: 'SYSTEM'
};

export const MEDIA_CATEGORIES = {
	IMAGE: 'image',
	DOCUMENT: 'document',
	ARCHIVE: 'archive'
};

export const getMediaUrl = (serverUrl, relativePath) => {
	if (!relativePath) return '';
	if (relativePath.startsWith('http')) return relativePath;
	const baseUrl = serverUrl.replace(/\/+$/, '');
	const cleanPath = relativePath.startsWith('uploads/') ? relativePath : `uploads/${relativePath}`;
	return `${baseUrl}/${cleanPath}`.replace(/([^:]\/)\/+/g, '$1');
};

/**
 * [v3.1 Strict Thumbnail Logic]
 * 썸네일이 없는 경우 원본을 보여주지 않고 무조건 기본 이미지를 반환합니다.
 */
export const getThumbnailUrl = (serverUrl, asset, size = 'MD') => {
	const DEFAULT_THUMB = '/default-thumbnail.png';
	if (!asset) return DEFAULT_THUMB;
	
	const targetSize = size.toLowerCase();
	
	if (asset.meta_info?.thumbs && asset.meta_info.thumbs[targetSize]) {
		return getMediaUrl(serverUrl, asset.meta_info.thumbs[targetSize]);
	}
	
	// [DB 불일치 대응] DB에 정보가 없더라도 디스크 규칙에 따라 존재할 가능성이 높으므로 예측 경로 반환
	if (asset.category === 'image' && asset.file_path) {
		const filePath = asset.file_path;
		const lastSlash = filePath.lastIndexOf('/');
		const dirName = filePath.substring(0, lastSlash);
		const fileName = filePath.substring(lastSlash + 1);
		const uuid = fileName.replace('IMG_', '').split('.')[0];
		const predicted = `${dirName}/THUMB/TMB_${uuid}_${size.toUpperCase()}.WEBP`;
		return getMediaUrl(serverUrl, predicted);
	}

	// 특정 사이즈가 없으면 sm 재활용 없이 즉시 기본 이미지 반환
	return DEFAULT_THUMB;
};

/**
 * [v3.2 Secure Media Helper]
 */
export const getSecureMediaUrl = (serverUrl, asset, size = null) => {
	if (!asset) return '';
	const tier = (asset.access_level || 'PUBLIC').toUpperCase();

	// PUBLIC 계층은 썸네일 유틸리티 직접 활용
	if (tier === 'PUBLIC') {
		return size ? getThumbnailUrl(serverUrl, asset, size) : getMediaUrl(serverUrl, asset.file_path);
	}

	// 보안 계층은 백엔드 서빙 API 활용
	const baseUrl = serverUrl.replace(/\/+$/, '');
	let url = `${baseUrl}/media/serve/${asset.id}`;
	if (size) url += `?size=${size.toLowerCase()}`;
	return url;
};
