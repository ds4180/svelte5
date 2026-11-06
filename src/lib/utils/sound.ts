/**
 * ============================================================================
 * [사내 전역 하드웨어 사운드 & 햅틱 진동 통합 제어 엔진 (sound.ts)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * MP3 파일 없이 브라우저 표준 Web Audio API로 0바이트, 0ms 즉시 합성 챠임벨/비프음과
 * 모바일 Vibration API 햅틱 진동을 전사적으로 제어합니다.
 * 
 * 🌟 주요 특징:
 * 1. [0바이트 합성]: 오디오 파일 다운로드 없이 칩셋 오실레이터로 맑은 챠임벨 생성
 * 2. [L1~L5 계층형 사운드]:
 *    - L1 (토스트): 가벼운 880Hz 숏 팝
 *    - L2 (상단 배너): 부드러운 2단 글라이드 (660Hz -> 880Hz)
 *    - L3 (업무 지시): 맑고 정중한 2단 챠임벨 ("딩~동~" 880Hz -> 1320Hz)
 *    - L4 (긴급 공지): 주의 환기 3단 비프 ("삐-삐-삐-" 1100Hz)
 *    - L5 (시스템 락): 저음 경보 사이렌 ("위잉-위잉-" 440Hz -> 220Hz)
 * 3. [L1~L5 햅틱 진동]: 모바일 진동 모터 밀리초(ms) 패턴 분배
 * 4. [MUTE 통합 연동]: 헤더의 음소거(MUTE) 설정 시 사운드/진동 자동 차단
 */

import { browser } from '$app/environment';

export type AlertSoundLevel = 1 | 2 | 3 | 4 | 5 | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'success' | 'warning' | 'error' | 'beep';

let audioCtx: AudioContext | null = null;

/**
 * 🔇 헤더 및 사용자 설정의 알림 음소거(MUTE) 여부 확인
 */
export function isSoundMuted(): boolean {
	if (!browser) return true;
	try {
		return localStorage.getItem('notification_sound_muted') === 'true';
	} catch {
		return false;
	}
}

/**
 * 🔇 음소거 상태 토글
 */
export function toggleSoundMute(): boolean {
	if (!browser) return false;
	const current = isSoundMuted();
	const next = !current;
	localStorage.setItem('notification_sound_muted', String(next));
	return next;
}

/**
 * 🔊 AudioContext 안전 획득 및 브라우저 Autoplay 해제
 */
function getAudioContext(): AudioContext | null {
	if (!browser) return null;
	try {
		const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextClass) return null;

		if (!audioCtx || audioCtx.state === 'closed') {
			audioCtx = new AudioContextClass();
		}
		if (audioCtx.state === 'suspended') {
			audioCtx.resume();
		}
		return audioCtx;
	} catch (e) {
		console.warn('⚠️ [SoundEngine] AudioContext 초기화 실패:', e);
		return null;
	}
}

/**
 * 🎵 단일 톤/주파수 비프음 재생 코어
 */
export function playTone(
	freq: number = 880,
	duration: number = 0.15,
	type: OscillatorType = 'sine',
	volume: number = 0.25,
	delaySec: number = 0
): void {
	if (isSoundMuted()) return;
	const ctx = getAudioContext();
	if (!ctx) return;

	try {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		const startTime = ctx.currentTime + delaySec;
		const stopTime = startTime + duration;

		osc.type = type;
		osc.frequency.setValueAtTime(freq, startTime);

		// 맑은 종소리 느낌을 위한 지수 감쇠(Decay)
		gain.gain.setValueAtTime(volume, startTime);
		gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(startTime);
		osc.stop(stopTime);
	} catch (e) {
		console.warn('⚠️ [SoundEngine] 사운드 출력 오류:', e);
	}
}

/**
 * 📳 모바일 햅틱 진동 모터 가동
 * @param pattern 밀리초(ms) 단위 단발 숫자 또는 [진동, 쉼, 진동...] 배열
 */
export function triggerVibration(pattern: number | number[]): boolean {
	if (isSoundMuted()) return false;
	if (!browser || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
		return false;
	}
	try {
		return navigator.vibrate(pattern);
	} catch {
		return false;
	}
}

/**
 * 🔔 L1~L5 계층형 알림 사운드 재생
 */
export function playAlertSound(level: AlertSoundLevel = 3): void {
	if (isSoundMuted()) return;

	// 문자열 규격 정규화
	const lvl = typeof level === 'string' && level.startsWith('l')
		? parseInt(level.replace('l', ''), 10)
		: level;

	switch (lvl) {
		case 1:
			// L1 (토스트): 가벼운 880Hz 숏 팝
			playTone(880, 0.08, 'sine', 0.2);
			break;

		case 2:
			// L2 (상단 배너): 부드러운 660Hz -> 880Hz 상승음
			playTone(660, 0.08, 'sine', 0.2);
			playTone(880, 0.12, 'sine', 0.2, 0.08);
			break;

		case 3:
		case 'success':
			// ⭐ L3 (업무 지시 모달 / 핵심): 맑고 정중한 2단 챠임벨 ("딩~동~" 880Hz -> 1320Hz)
			playTone(880, 0.18, 'sine', 0.3); // "딩~"
			playTone(1320, 0.28, 'sine', 0.25, 0.14); // "동~"
			break;

		case 4:
		case 'warning':
			// L4 (긴급 공지): 주의를 환기하는 3단 비프음 ("삐-삐-삐-", 1100Hz)
			playTone(1100, 0.1, 'triangle', 0.3);
			playTone(1100, 0.1, 'triangle', 0.3, 0.12);
			playTone(1100, 0.15, 'triangle', 0.3, 0.24);
			break;

		case 5:
		case 'error':
			// L5 (시스템 락): 저음 경보 사이렌 ("위잉-위잉-")
			playTone(520, 0.2, 'sawtooth', 0.25);
			playTone(390, 0.25, 'sawtooth', 0.25, 0.18);
			playTone(520, 0.2, 'sawtooth', 0.25, 0.42);
			playTone(390, 0.3, 'sawtooth', 0.25, 0.6);
			break;

		case 'beep':
		default:
			// 기본 삐빅 (QR 스캔 등)
			playTone(1320, 0.1, 'sine', 0.25);
			playTone(1760, 0.12, 'sine', 0.25, 0.1);
			break;
	}
}

/**
 * 📳 L1~L5 계층형 모바일 진동 패턴 분배
 */
export function playAlertVibration(level: AlertSoundLevel = 3): void {
	if (isSoundMuted()) return;

	const lvl = typeof level === 'string' && level.startsWith('l')
		? parseInt(level.replace('l', ''), 10)
		: level;

	switch (lvl) {
		case 1:
			// L1: 40ms 미세 틱
			triggerVibration(40);
			break;
		case 2:
			// L2: 70ms 틱
			triggerVibration(70);
			break;
		case 3:
		case 'success':
			// ⭐ L3 (업무 지시): 정중하고 분명한 2단 진동 [150ms 진동, 80ms 쉼, 150ms 진동]
			triggerVibration([150, 80, 150]);
			break;
		case 4:
		case 'warning':
			// L4 (긴급 공지): 3단 빠른 진동
			triggerVibration([180, 80, 180, 80, 180]);
			break;
		case 5:
		case 'error':
			// L5 (시스템 락): 묵직한 경보 연속 진동
			triggerVibration([300, 120, 300, 120, 400]);
			break;
		default:
			triggerVibration(80);
			break;
	}
}

/**
 * 🚀 [원터치 통합 알림기] 사운드와 진동을 등급(Level)에 맞춰 한 번에 동시 실행
 */
export function notifyAlert(level: AlertSoundLevel = 3): void {
	if (isSoundMuted()) return;
	playAlertSound(level);
	playAlertVibration(level);
}

export default {
	isSoundMuted,
	toggleSoundMute,
	playTone,
	triggerVibration,
	playAlertSound,
	playAlertVibration,
	notifyAlert
};
