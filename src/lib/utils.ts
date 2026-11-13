/**
 * ============================================================================
 * [전사 통합 날짜 및 시간 표준 유틸리티 라이브러리 (lib/utils.ts)]
 * ============================================================================
 * 
 * 💡 표준 근거: docs/01_표준정의/데이터_전역_날짜_시간_규격.md
 * 
 * 🌟 핵심 원칙:
 * 1. [타임존 일원화 (KST)]: 한국 로컬 시각 기준으로 안전하게 파싱 및 포맷팅합니다.
 * 2. [toISOString 9시간 시차 해결]: <input type="datetime-local"> 바인딩 시 로컬 시각을
 *    UTC로 강제 왜곡하는 브라우저 결함을 방지하는 `toLocalISOString`을 제공합니다.
 * 3. [상대 시간 일원화]: "방금 전", "3분 전", "2시간 전" 등 상대 시각 계산 함수 `timeAgo`를
 *    전사 모든 컴포넌트(관제탑, 피드, 댓글, 알림 등)에 표준 제공합니다.
 */

export type DateInput = string | number | Date | null | undefined;

/**
 * 1. 로컬 일시 포맷팅 (YYYY-MM-DD HH:mm 또는 초 포함 YYYY-MM-DD HH:mm:ss)
 * @param dateTimeString - 변환할 일시 (ISO 문자열, 타임스탬프, Date 객체 등)
 * @param includeSeconds - 초 단위(:ss) 포함 여부 (기본값: false)
 * @returns 포맷팅된 문자열 (유효하지 않을 경우 '-')
 */
export function formatDateTime(dateTimeString: DateInput, includeSeconds: boolean = false): string {
	if (!dateTimeString) return '-';
	const date = dateTimeString instanceof Date ? dateTimeString : new Date(dateTimeString);
	if (isNaN(date.getTime())) return '-';

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');

	if (includeSeconds) {
		const seconds = String(date.getSeconds()).padStart(2, '0');
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 2. 날짜만 포맷팅 (YYYY-MM-DD)
 * @param dateInput - 변환할 일시
 * @returns 'YYYY-MM-DD' 형식 문자열
 */
export function formatDate(dateInput: DateInput): string {
	if (!dateInput) return '-';
	const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
	if (isNaN(date.getTime())) return '-';

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * 3. <input type="datetime-local"> 바인딩용 로컬 ISO 문자열 변환 (YYYY-MM-DDTHH:mm)
 * 🚨 toISOString()을 쓰면 한국 시각이 9시간 전(새벽/UTC)으로 바뀌는 버그를 완벽 해결
 * @param dateInput - Date 객체 또는 날짜 문자열/타임스탬프 (기본값: 현재 시각)
 * @returns 'YYYY-MM-DDTHH:mm' 형식 문자열
 */
export function toLocalISOString(dateInput: DateInput = new Date()): string {
	const date = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
	if (isNaN(date.getTime())) return '';

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 4. 상대적 시간 경과 표시 (예: "방금 전", "3분 전", "2시간 전", "3일 전")
 * @param dateTimeString - 기준 일시
 * @returns 사람이 읽기 쉬운 상대 시간 문자열
 */
export function timeAgo(dateTimeString: DateInput): string {
	if (!dateTimeString) return '-';
	const date = dateTimeString instanceof Date ? dateTimeString : new Date(dateTimeString);
	if (isNaN(date.getTime())) return '-';

	const diffMs = Date.now() - date.getTime();
	
	// 미세한 미래 시차나 5초 이내 오차 방어
	if (diffMs < 5000 && diffMs > -10000) return '방금 전';
	if (diffMs < 0) return formatDateTime(date);

	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return `${Math.max(1, diffSec)}초 전`;

	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}분 전`;

	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}시간 전`;

	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 30) return `${diffDay}일 전`;

	return formatDate(date);
}

/**
 * 5. 시간 양(Duration) 포맷팅 (분 단위를 시간:분으로)
 * @param minutes - 총 분 (정수)
 * @returns 'H시간 M분' 또는 'M분'
 */
export function formatDuration(minutes: number | null | undefined): string {
	if (minutes === null || minutes === undefined || isNaN(minutes)) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

/**
 * 6. 타임스탬프를 YYYY-MM-DD 형식의 문자열로 변환 (레거시 호환용)
 * @param timestamp - 밀리초 타임스탬프
 */
export function timestampToDateString(timestamp: number | null | undefined): string {
	if (!timestamp) return '';
	return formatDate(timestamp);
}

/**
 * 7. 특정 일시가 현재 시점보다 만료(경과)되었는지 확인
 * @param expiresAt - 만료 예정 일시
 */
export function isExpired(expiresAt: DateInput): boolean {
	if (!expiresAt) return true;
	const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	if (isNaN(date.getTime())) return true;
	return Date.now() > date.getTime();
}

/**
 * 8. D-Day 계산 및 포맷팅 (예: "D-Day", "D-3", "D+5")
 * @param targetDate - 목표 일자
 * @returns 'D-Day' | 'D-N' | 'D+N' (유효하지 않을 경우 '-')
 */
export function formatDDay(targetDate: DateInput): string {
	if (!targetDate) return '-';
	const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
	if (isNaN(date.getTime())) return '-';

	const diff = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (days === 0) return 'D-Day';
	if (days > 0) return `D-${days}`;
	return `D+${Math.abs(days)}`;
}

export const getDday = formatDDay;

/**
 * 9. 파일명 및 로그 생성용 로컬 타임스탬프 (기본: YYYYMMDD_HHmmss)
 * 🚨 toISOString()의 9시간 시차(UTC) 왜곡 없는 한국 표준시(KST) 기반 파일명 생성
 * @param dateInput - 기준 일시 (기본값: 현재 시각)
 * @param withUnderscore - 날짜와 시간 사이에 '_' 포함 여부 (기본값: true)
 * @returns '20261109_090500' 또는 '20261109090500'
 */
export function getLocalFileTimestamp(dateInput: DateInput = new Date(), withUnderscore: boolean = true): string {
	const date = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
	if (isNaN(date.getTime())) return '';

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	const sep = withUnderscore ? '_' : '';
	return `${year}${month}${day}${sep}${hours}${minutes}${seconds}`;
}

export const formatFileDateTime = getLocalFileTimestamp;

/**
 * 10. 파일 용량(Bytes)을 사람이 읽기 쉬운 단위(B, KB, MB, GB, TB)로 변환
 * @param bytes - 바이트 크기
 * @param decimals - 소수점 자리수 (기본값: 2)
 * @returns '1.25 MB', '0 B' 등 포맷팅된 문자열
 */
export function formatBytes(bytes: number | null | undefined, decimals: number = 2): string {
	if (!bytes || bytes <= 0) return '0 B';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}


