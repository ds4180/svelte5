/**
 * @file src/lib/utils/fullscreen.ts
 * @description 브라우저 Fullscreen(F11 모드) 진입 및 웹카메라 자동 복귀 제어 유틸리티
 */

const AUTO_FS_KEY = 'jeju_cam_auto_fs';

/**
 * 현재 창모드 상태일 때만 전체화면(F11 모드)으로 전환하고,
 * 추후 카메라 화면 이탈 시 자동 복귀할 수 있도록 플래그를 기록합니다.
 * (이미 사용자가 전체화면을 켜 둔 상태라면 플래그를 기록하지 않아 기존 상태를 유지합니다.)
 */
export async function enterCameraFullscreen(): Promise<boolean> {
	if (typeof document === 'undefined') return false;
	const docEl = document.documentElement;
	if (!docEl || typeof docEl.requestFullscreen !== 'function') return false;

	// 이미 전체화면이 활성화되어 있다면 웹카메라에 의한 자동 진입으로 표시하지 않음
	if (document.fullscreenElement) {
		try {
			sessionStorage.removeItem(AUTO_FS_KEY);
		} catch {
			// private mode 등 무시
		}
		return true;
	}

	try {
		await docEl.requestFullscreen();
		try {
			sessionStorage.setItem(AUTO_FS_KEY, '1');
		} catch {
			// 무시
		}
		return true;
	} catch {
		// 사용자 제스처 누락 또는 iOS Safari 미지원 등
		return false;
	}
}

/**
 * 웹카메라 진입 시 자동으로 전체화면이 켜졌던 경우에만 전체화면을 해제하여 원래 창모드로 복귀합니다.
 */
export async function exitCameraFullscreenIfAuto(): Promise<void> {
	if (typeof document === 'undefined') return;
	let isAuto = false;
	try {
		isAuto = sessionStorage.getItem(AUTO_FS_KEY) === '1';
		sessionStorage.removeItem(AUTO_FS_KEY);
	} catch {
		isAuto = false;
	}

	if (isAuto && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
		try {
			await document.exitFullscreen();
		} catch {
			// 이미 해제되었거나 권한 제약 시 무시
		}
	}
}

/**
 * 수동 전체화면 토글 (웹카메라 내부 툴바 제어용)
 */
export async function toggleCameraFullscreen(): Promise<boolean> {
	if (typeof document === 'undefined') return false;

	try {
		if (!document.fullscreenElement) {
			if (typeof document.documentElement.requestFullscreen === 'function') {
				await document.documentElement.requestFullscreen();
				try {
					sessionStorage.setItem(AUTO_FS_KEY, '1');
				} catch {
					// 무시
				}
				return true;
			}
		} else if (typeof document.exitFullscreen === 'function') {
			try {
				sessionStorage.removeItem(AUTO_FS_KEY);
			} catch {
				// 무시
			}
			await document.exitFullscreen();
			return false;
		}
	} catch (e) {
		console.warn('전체화면 전환 실패:', e);
	}
	return !!document.fullscreenElement;
}
