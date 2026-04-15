/**
 * ==============================================================================
 * [Media System Global Configuration v1.0]
 * ==============================================================================
 * ⚠️ 중요: 이 설정 값들은 백엔드 `test/domain/media/media_config.py`와
 * 반드시 1:1로 일치해야 합니다. 한 쪽을 변경하면 반드시 다른 쪽도 동기화하십시오.
 * ==============================================================================
 */

// 1. 접근 계층(Tier) 정의: 백엔드의 저장 폴더명과 동일해야 함
export const MEDIA_TIERS = {
	PUBLIC: 'public',
	PROTECTED: 'protected',
	PRIVATE: 'private',
	SYSTEM: 'system'
};

// 2. 미디어 카테고리 정의
export const MEDIA_CATEGORIES = {
	IMAGE: 'image',
	DOCUMENT: 'document',
	ARCHIVE: 'archive'
};

/**
 * [URL 생성 로직]
 * 미디어 자산의 전체 URL을 생성합니다. (Nginx 정적 서빙 경로 대응)
 * @param {string} serverUrl - PUBLIC_SERVER_URL (예: http://jeju.live)
 * @param {string} relativePath - DB에 저장된 relative_path (예: public/image/...)
 * @returns {string} 완성된 절대 URL
 */
export const getMediaUrl = (serverUrl, relativePath) => {
	if (!relativePath) return '';
	if (relativePath.startsWith('http')) return relativePath;

	// ⚠️ FastAPI StaticFiles 설정에 따라 'uploads/' 프리픽스가 필요함
	const cleanPath = relativePath.startsWith('uploads/') ? relativePath : `uploads/${relativePath}`;
	
	// 중복 슬래시 방지 로직 포함하여 URL 결합
	return `${serverUrl}/${cleanPath}`.replace(/([^:]\/)\/+/g, '$1');
};

/**
 * [썸네일 매핑 로직]
 * MediaAsset 모델(또는 메타데이터)에 담긴 썸네일 경로를 사이즈별로 추출합니다.
 * @param {string} serverUrl - PUBLIC_SERVER_URL
 * @param {Object} asset - MediaAsset 객체 (DB 레코드 형태)
 * @param {string} [size='md'] - 'sm'(리스트), 'md'(상세), 'lg'(원본급)
 * @returns {string} 조립된 썸네일 절대 URL
 */
export const getThumbnailUrl = (serverUrl, asset, size = 'md') => {
	if (!asset) return '';
	
	// 1. [운영급] meta_info.thumbs 필드에 상세 경로가 있는 경우 우선 사용
	if (asset.meta_info?.thumbs && asset.meta_info.thumbs[size]) {
		return getMediaUrl(serverUrl, asset.meta_info.thumbs[size]);
	}
	
	// 2. [레거시] thumbnail_path 필드만 있는 경우 기본값으로 활용
	if (asset.thumbnail_path) {
		return getMediaUrl(serverUrl, asset.thumbnail_path);
	}
	
	// 3. 이미지가 아닌 문서 등의 경우, 나중에 타입별 아이콘 경로 반환 로직 추가 가능
	return '';
};
