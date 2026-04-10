/**
 * @file utils.js
 * @description 날짜 및 시간 포맷팅 전용 유틸리티 함수 모음
 */

/**
 * 일시 포맷팅 (YYYY-MM-DD HH:mm)
 */
export function formatDateTime(dateTimeString) {
	if (!dateTimeString) return '';
	const date = new Date(dateTimeString);
	if (isNaN(date.getTime())) return '';
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 기간 포맷팅 (분 단위를 시간:분으로)
 */
export function formatDuration(minutes) {
	if (minutes === null || minutes === undefined) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

/**
 * 타임스탬프를 YYYY-MM-DD 형식의 문자열로 변환
 * @param {number} timestamp 
 */
export function timestampToDateString(timestamp) {
	if (!timestamp) return '';
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * 오늘로부터 하루(24시간)가 지났는지 체크
 * @param {string|number} expiresAt ISO String 또는 타임스탬프
 */
export function isExpired(expiresAt) {
	if (!expiresAt) return true;
	return new Date() > new Date(expiresAt);
}
