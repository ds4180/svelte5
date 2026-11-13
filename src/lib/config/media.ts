/**
 * ==============================================================================
 * [미디어 시스템 전역 설정 및 보안 URL 헬퍼 (src/lib/config/media.ts)]
 * ==============================================================================
 */

export const MEDIA_TIERS = {
	PUBLIC: 'PUBLIC',
	PROTECTED: 'PROTECTED',
	PRIVATE: 'PRIVATE',
	SYSTEM: 'SYSTEM'
} as const;

export const MEDIA_CATEGORIES = {
	IMAGE: 'image',
	DOCUMENT: 'document',
	ARCHIVE: 'archive'
} as const;

export interface MediaAssetLike {
	id?: number | string;
	access_level?: string;
	category?: string;
	file_path?: string;
	meta_info?: {
		has_original?: boolean;
		thumbs?: Record<string, string>;
		[key: string]: any;
	};
	[key: string]: any;
}

export const getMediaUrl = (serverUrl: string, relativePath?: string | null): string => {
	if (!relativePath) return '';
	if (relativePath.startsWith('http')) return relativePath;
	const baseUrl = (serverUrl || '').replace(/\/+$/, '');
	const cleanPath = relativePath.startsWith('uploads/') ? relativePath : `uploads/${relativePath}`;
	return `${baseUrl}/${cleanPath}`.replace(/([^:]\/)\/+/g, '$1');
};

/**
 * [v3.1 Strict Thumbnail Logic]
 * 썸네일이 없는 경우 원본을 보여주지 않고 무조건 기본 이미지를 반환합니다.
 */
export const getThumbnailUrl = (
	serverUrl: string,
	asset?: MediaAssetLike | null,
	size: string = 'MD'
): string => {
	const DEFAULT_THUMB = '/default-thumbnail.png';
	if (!asset) return DEFAULT_THUMB;

	const targetSize = size.toLowerCase();

	// 1. 요청한 사이즈가 DB thumbs 맵에 있으면 즉시 반환
	if (asset.meta_info?.thumbs && asset.meta_info.thumbs[targetSize]) {
		return getMediaUrl(serverUrl, asset.meta_info.thumbs[targetSize]);
	}

	// 2. 요청한 사이즈가 없을 경우, 사용 가능한 대체 썸네일(lg -> md -> sm) 순차 탐색
	if (asset.meta_info?.thumbs && typeof asset.meta_info.thumbs === 'object') {
		for (const fallback of ['lg', 'md', 'sm']) {
			if (asset.meta_info.thumbs[fallback]) {
				return getMediaUrl(serverUrl, asset.meta_info.thumbs[fallback]);
			}
		}
	}

	// 3. [DB 불일치 대응] DB에 정보가 없더라도 디스크 규칙에 따라 존재할 가능성이 높으므로 예측 경로 반환
	if (asset.category === 'image' && asset.file_path) {
		const filePath = asset.file_path;
		const lastSlash = filePath.lastIndexOf('/');
		const dirName = filePath.substring(0, lastSlash);
		const fileName = filePath.substring(lastSlash + 1);
		const uuid = fileName.replace('IMG_', '').split('.')[0];
		const predicted = `${dirName}/THUMB/TMB_${uuid}_${size.toUpperCase()}.WEBP`;
		return getMediaUrl(serverUrl, predicted);
	}

	return DEFAULT_THUMB;
};

/**
 * [v3.5 Secure Media Helper]
 * - 원본 파일이 시한부 파기/격리되었거나 복제본인 경우(has_original === false)
 *   size가 지정되지 않았더라도 자동으로 최고화질 썸네일(LG)로 안전 폴백하여 엑스박스 방지
 */
export const getSecureMediaUrl = (
	serverUrl: string,
	asset?: MediaAssetLike | null,
	size: string | null = null
): string => {
	if (!asset) return '';
	const tier = (asset.access_level || 'PUBLIC').toUpperCase();
	const hasNoOriginal = asset.category === 'image' && asset.meta_info?.has_original === false;

	// PUBLIC 계층은 정적 파일 경로 직접 활용
	if (tier === 'PUBLIC') {
		if (size) {
			return getThumbnailUrl(serverUrl, asset, size);
		}
		if (hasNoOriginal) {
			return getThumbnailUrl(serverUrl, asset, 'lg');
		}
		return getMediaUrl(serverUrl, asset.file_path);
	}

	// 보안 계층(PRIVATE, PROTECTED, SYSTEM)은 백엔드 서빙 API 활용
	const baseUrl = (serverUrl || '').replace(/\/+$/, '');
	let url = `${baseUrl}/media/serve/${asset.id}`;
	if (size) {
		url += `?size=${size.toUpperCase()}`;
	} else if (hasNoOriginal) {
		url += `?size=LG`;
	}
	return url;
};
