/**
 * ============================================================================
 * [사내 전역 하드웨어 사운드 · TTS · 햅틱 진동 통합 제어 엔진 (sound.ts)]
 * ============================================================================
 *
 * 💡 이 파일의 역할:
 * 1. [첫 터치 자동 잠금 해제 (Global Audio/TTS/Vibration Unlocker)]:
 *    사용자가 앱 접속 후 화면 어디든 최초 1회 터치/클릭/키입력하는 순간,
 *    Web Audio(무음 1샘플), SpeechSynthesis(무음 워밍업), Vibration(1ms 미세 신호)의
 *    브라우저 자동재생 차단(Autoplay Policy) 자물쇠를 동시에 영구 해제합니다.
 *    이후 손을 떼고 대기 중일 때 웹소켓으로 도착하는 모든 알림음·TTS·진동이 100% 작동합니다.
 * 2. [미디어 충돌 방지 (Ambient Mixing)]:
 *    기존에 재생 중인 음악(유튜브 뮤직/멜론)이나 네비게이션을 멈추지 않고 그 위에 소리를 겹쳐 출력합니다.
 * 3. [100% ~ 400% 하드웨어 앰프 증폭 & 다이나믹 컴프레서 파이프라인]:
 *    GainNode(최대 4배 증폭) + BiquadFilterNode(2.4kHz 명료도 부스트) + DynamicsCompressorNode(찢어짐 방지 리미터)
 * 4. [L1~L5 계층형 사운드 & 진동 증폭]:
 *    등급별 챠임벨/사이렌 합성 및 진동 지속시간 배율(100%~300%) 증폭 지원
 */

import { browser } from '$app/environment';

export type AlertSoundLevel =
	| 1
	| 2
	| 3
	| 4
	| 5
	| 'l1'
	| 'l2'
	| 'l3'
	| 'l4'
	| 'l5'
	| 'success'
	| 'warning'
	| 'error'
	| 'beep';

export interface TtsSpeakOptions {
	rate?: number;
	pitch?: number;
	preChime?: boolean;
	onStart?: () => void;
	onEnd?: () => void;
	onError?: (err: unknown) => void;
}

const STORAGE_KEYS = {
	MUTED: 'notification_sound_muted',
	SOUND_BOOST: 'notification_sound_boost',
	COMPRESSOR: 'notification_sound_compressor',
	CLARITY_FILTER: 'notification_sound_clarity',
	VIBRATION_BOOST: 'notification_vibration_boost',
	TTS_PRE_CHIME: 'notification_tts_pre_chime',
	TTS_PITCH: 'notification_tts_pitch',
	TTS_RATE: 'notification_tts_rate'
} as const;

let audioCtx: AudioContext | null = null;
let unlocked = false;
let unlockerInitialized = false;
const unlockListeners = new Set<(isUnlocked: boolean) => void>();

function notifyUnlockChange(state: boolean): void {
	unlocked = state;
	for (const fn of unlockListeners) {
		try {
			fn(state);
		} catch {
			// ignore listener error
		}
	}
}

/**
 * 🔓 현재 브라우저 세션의 오디오/TTS/진동 잠금 해제 여부 조회
 */
export function isAudioUnlocked(): boolean {
	if (!browser) return false;
	if (unlocked) return true;
	if (audioCtx && audioCtx.state === 'running') {
		unlocked = true;
		return true;
	}
	return false;
}

/**
 * 🔓 오디오 잠금 해제 상태 변경 구독 (UI 반응형 연동용)
 */
export function onAudioUnlockChange(callback: (isUnlocked: boolean) => void): () => void {
	unlockListeners.add(callback);
	callback(isAudioUnlocked());
	return () => {
		unlockListeners.delete(callback);
	};
}

/**
 * 🔇 헤더 및 사용자 설정의 알림 음소거(MUTE) 여부 확인
 */
export function isSoundMuted(): boolean {
	if (!browser) return true;
	try {
		return localStorage.getItem(STORAGE_KEYS.MUTED) === 'true';
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
	try {
		localStorage.setItem(STORAGE_KEYS.MUTED, String(next));
	} catch {
		// ignore storage error
	}
	return next;
}

/**
 * 🎚️ 사운드 증폭 배율 조회 (1.0 = 100% 기본 ~ 4.0 = 400% 최대 증폭, 기본값 1.8 = 180%)
 */
export function getSoundBoost(): number {
	if (!browser) return 1.8;
	try {
		const raw = parseFloat(localStorage.getItem(STORAGE_KEYS.SOUND_BOOST) || '1.8');
		if (Number.isNaN(raw)) return 1.8;
		return Math.min(4.0, Math.max(0.5, raw));
	} catch {
		return 1.8;
	}
}

export function setSoundBoost(multiplier: number): number {
	const clamped = Math.min(4.0, Math.max(0.5, Number(multiplier.toFixed(2))));
	if (browser) {
		try {
			localStorage.setItem(STORAGE_KEYS.SOUND_BOOST, String(clamped));
		} catch {
			// ignore
		}
	}
	return clamped;
}

/**
 * 🎛️ 다이나믹 컴프레서(스피커 찢어짐/클리핑 방지 리미터) 활성화 여부 (기본 true)
 */
export function isCompressorEnabled(): boolean {
	if (!browser) return true;
	try {
		const val = localStorage.getItem(STORAGE_KEYS.COMPRESSOR);
		return val === null ? true : val === 'true';
	} catch {
		return true;
	}
}

export function setCompressorEnabled(enabled: boolean): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEYS.COMPRESSOR, String(enabled));
	} catch {
		// ignore
	}
}

/**
 * 🎛️ 2.4kHz 중고음 명료도 부스트 필터 활성화 여부 (차량/현장 저주파 소음 관통, 기본 true)
 */
export function isClarityFilterEnabled(): boolean {
	if (!browser) return true;
	try {
		const val = localStorage.getItem(STORAGE_KEYS.CLARITY_FILTER);
		return val === null ? true : val === 'true';
	} catch {
		return true;
	}
}

export function setClarityFilterEnabled(enabled: boolean): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEYS.CLARITY_FILTER, String(enabled));
	} catch {
		// ignore
	}
}

/**
 * 📳 진동 지속시간 증폭 배율 조회 (1.0 = 100% ~ 3.0 = 300%, 기본 1.5)
 */
export function getVibrationBoost(): number {
	if (!browser) return 1.5;
	try {
		const raw = parseFloat(localStorage.getItem(STORAGE_KEYS.VIBRATION_BOOST) || '1.5');
		if (Number.isNaN(raw)) return 1.5;
		return Math.min(3.0, Math.max(0.5, raw));
	} catch {
		return 1.5;
	}
}

export function setVibrationBoost(multiplier: number): number {
	const clamped = Math.min(3.0, Math.max(0.5, Number(multiplier.toFixed(2))));
	if (browser) {
		try {
			localStorage.setItem(STORAGE_KEYS.VIBRATION_BOOST, String(clamped));
		} catch {
			// ignore
		}
	}
	return clamped;
}

/**
 * 🔊 AudioContext 안전 획득 및 Ambient(배경 음악 비충돌) 세션 설정
 */
export function getAudioContext(): AudioContext | null {
	if (!browser) return null;
	try {
		// 최신 브라우저 AudioSession API: 기존 재생 중인 음악(유튜브/멜론 등)을 멈추지 않고 믹싱하도록 'ambient' 설정
		const nav = navigator as unknown as { audioSession?: { type: string } };
		if (nav.audioSession && nav.audioSession.type !== 'ambient') {
			try {
				nav.audioSession.type = 'ambient';
			} catch {
				// ignore unsupported audioSession assignment
			}
		}

		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextClass) return null;

		if (!audioCtx || audioCtx.state === 'closed') {
			audioCtx = new AudioContextClass();
			audioCtx.addEventListener('statechange', () => {
				if (audioCtx && audioCtx.state === 'running') {
					notifyUnlockChange(true);
				}
			});
		}
		if (audioCtx.state === 'suspended') {
			audioCtx.resume().catch(() => {});
		}
		if (audioCtx.state === 'running') {
			notifyUnlockChange(true);
		}
		return audioCtx;
	} catch (e) {
		console.warn('⚠️ [SoundEngine] AudioContext 초기화 실패:', e);
		return null;
	}
}

/**
 * 🔓 [핵심] 첫 터치/클릭 이벤트와 동시에 오디오 · TTS · 진동 자물쇠를 한 번에 해제
 */
export function unlockAudioNow(): boolean {
	if (!browser) return false;

	try {
		// 1. Web Audio API 잠금 해제 (1샘플 무음 버퍼 즉시 재생)
		const ctx = getAudioContext();
		if (ctx) {
			if (ctx.state === 'suspended') {
				ctx.resume().catch(() => {});
			}
			const silentBuffer = ctx.createBuffer(1, 1, 22050);
			const source = ctx.createBufferSource();
			source.buffer = silentBuffer;
			source.connect(ctx.destination);
			source.start(0);
		}

		// 2. SpeechSynthesis (TTS) 엔진 워밍업 잠금 해제
		if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
			try {
				window.speechSynthesis.resume();
				const silentUtter = new SpeechSynthesisUtterance(' ');
				silentUtter.volume = 0;
				silentUtter.rate = 2;
				silentUtter.lang = 'ko-KR';
				window.speechSynthesis.speak(silentUtter);
			} catch {
				// ignore TTS warmup error
			}
		}

		// 3. Vibration API (안드로이드 진동 모터) 사용자 활성화 잠금 해제 (1ms 극미세 신호)
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(1);
			} catch {
				// ignore vibration warmup error
			}
		}

		notifyUnlockChange(true);
		return true;
	} catch (e) {
		console.warn('⚠️ [SoundEngine] 오디오 잠금 해제 중 예외:', e);
		return false;
	}
}

/**
 * 🚀 전역 최상위 레이아웃(+layout.svelte)에서 1회 호출:
 * 사용자의 첫 터치/클릭/키입력을 감지하여 즉시 오디오·TTS·진동 잠금을 해제하고 리스너를 자동 정리합니다.
 * 또한 화면 절전 복귀(visibilitychange) 시 잠든 AudioContext를 자동으로 다시 깨웁니다.
 */
export function initAudioUnlocker(): void {
	if (!browser || unlockerInitialized) return;
	unlockerInitialized = true;

	const unlockEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown'] as const;

	const handleFirstInteraction = () => {
		unlockAudioNow();
		if (isAudioUnlocked()) {
			for (const evt of unlockEvents) {
				window.removeEventListener(evt, handleFirstInteraction, { capture: true });
			}
		}
	};

	for (const evt of unlockEvents) {
		window.addEventListener(evt, handleFirstInteraction, { capture: true, passive: true });
	}

	// 스마트폰 화면을 껐다 켜거나 다른 앱에서 돌아왔을 때 AudioContext가 잠들었으면 즉시 재개
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && audioCtx && audioCtx.state === 'suspended') {
			audioCtx.resume().catch(() => {});
		}
	});
}

/**
 * 🎵 단일 톤/주파수 비프음 재생 코어 (400% 앰프 증폭 + 명료도 필터 + 다이나믹 컴프레서 내장)
 */
export function playTone(
	freq: number = 880,
	duration: number = 0.15,
	type: OscillatorType = 'sine',
	volume: number = 0.25,
	delaySec: number = 0,
	options?: { boostOverride?: number; forceUnmute?: boolean }
): void {
	if (!options?.forceUnmute && isSoundMuted()) return;
	const ctx = getAudioContext();
	if (!ctx) return;

	try {
		const osc = ctx.createOscillator();
		const noteGain = ctx.createGain();
		const masterBoostGain = ctx.createGain();

		const startTime = ctx.currentTime + delaySec;
		const stopTime = startTime + duration;

		const boostMultiplier = options?.boostOverride ?? getSoundBoost();
		const effectiveVolume = Math.max(0.05, volume);

		osc.type = type;
		osc.frequency.setValueAtTime(freq, startTime);

		// 맑은 종소리 느낌을 위한 지수 감쇠(Decay)
		noteGain.gain.setValueAtTime(effectiveVolume, startTime);
		noteGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

		// 앰프 증폭 배율 적용 (1.0x ~ 4.0x)
		masterBoostGain.gain.setValueAtTime(boostMultiplier, startTime);

		// 파이프라인 연결: osc -> noteGain -> [clarityFilter] -> masterBoostGain -> [compressor] -> destination
		let currentNode: AudioNode = noteGain;
		osc.connect(noteGain);

		// 1) 2.4kHz 중고음 명료도 부스트 필터 (차량 엔진음/주변 소음 관통)
		if (isClarityFilterEnabled()) {
			const filter = ctx.createBiquadFilter();
			filter.type = 'peaking';
			filter.frequency.setValueAtTime(2400, startTime);
			filter.Q.setValueAtTime(1.2, startTime);
			filter.gain.setValueAtTime(5.0, startTime); // +5dB 부스트
			currentNode.connect(filter);
			currentNode = filter;
		}

		currentNode.connect(masterBoostGain);
		currentNode = masterBoostGain;

		// 2) 다이나믹 컴프레서 / 리미터 (300~400% 증폭 시 스피커 찢어짐/클리핑 방지)
		if (isCompressorEnabled()) {
			const compressor = ctx.createDynamicsCompressor();
			compressor.threshold.setValueAtTime(-6, startTime);
			compressor.knee.setValueAtTime(10, startTime);
			compressor.ratio.setValueAtTime(12, startTime);
			compressor.attack.setValueAtTime(0.002, startTime);
			compressor.release.setValueAtTime(0.15, startTime);
			currentNode.connect(compressor);
			currentNode = compressor;
		}

		currentNode.connect(ctx.destination);

		osc.start(startTime);
		osc.stop(stopTime);
	} catch (e) {
		console.warn('⚠️ [SoundEngine] 사운드 출력 오류:', e);
	}
}

/**
 * 📳 모바일 햅틱 진동 모터 가동 (진동 증폭 배율 자동 반영)
 * @param pattern 밀리초(ms) 단위 단발 숫자 또는 [진동, 쉼, 진동...] 배열
 */
export function triggerVibration(
	pattern: number | number[],
	options?: { boostOverride?: number; forceUnmute?: boolean }
): boolean {
	if (!options?.forceUnmute && isSoundMuted()) return false;
	if (!browser || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
		return false;
	}
	try {
		const boost = options?.boostOverride ?? getVibrationBoost();
		let boostedPattern: number | number[];
		if (typeof pattern === 'number') {
			boostedPattern = Math.round(pattern * boost);
		} else if (Array.isArray(pattern)) {
			// 짝수 인덱스(진동 작동 시간)는 배율만큼 증폭하고, 홀수 인덱스(쉼 시간)는 리듬감을 유지
			boostedPattern = pattern.map((ms, idx) => (idx % 2 === 0 ? Math.round(ms * boost) : ms));
		} else {
			boostedPattern = pattern;
		}
		return navigator.vibrate(boostedPattern);
	} catch {
		return false;
	}
}

/**
 * 🔔 L1~L5 계층형 알림 사운드 재생
 */
export function playAlertSound(
	level: AlertSoundLevel = 3,
	options?: { boostOverride?: number; forceUnmute?: boolean }
): void {
	if (!options?.forceUnmute && isSoundMuted()) return;

	const lvl =
		typeof level === 'string' && level.startsWith('l')
			? parseInt(level.replace('l', ''), 10)
			: level;

	switch (lvl) {
		case 1:
			// L1 (토스트): 가벼운 880Hz 숏 팝
			playTone(880, 0.09, 'sine', 0.3, 0, options);
			break;

		case 2:
			// L2 (상단 배너): 부드러운 660Hz -> 880Hz 상승음
			playTone(660, 0.09, 'sine', 0.3, 0, options);
			playTone(880, 0.14, 'sine', 0.3, 0.09, options);
			break;

		case 3:
		case 'success':
			// ⭐ L3 (업무 지시 모달 / 핵심): 맑고 정중한 2단 챠임벨 ("딩~동~" 880Hz -> 1320Hz)
			playTone(880, 0.2, 'sine', 0.4, 0, options); // "딩~"
			playTone(1320, 0.32, 'sine', 0.35, 0.15, options); // "동~"
			break;

		case 4:
		case 'warning':
			// L4 (긴급 공지): 주의를 환기하는 3단 비프음 ("삐-삐-삐-", 1100Hz)
			playTone(1100, 0.11, 'triangle', 0.45, 0, options);
			playTone(1100, 0.11, 'triangle', 0.45, 0.13, options);
			playTone(1100, 0.18, 'triangle', 0.45, 0.26, options);
			break;

		case 5:
		case 'error':
			// L5 (시스템 락): 저음 경보 사이렌 ("위잉-위잉-")
			playTone(520, 0.22, 'sawtooth', 0.4, 0, options);
			playTone(390, 0.26, 'sawtooth', 0.4, 0.2, options);
			playTone(520, 0.22, 'sawtooth', 0.4, 0.44, options);
			playTone(390, 0.32, 'sawtooth', 0.4, 0.64, options);
			break;

		case 'beep':
		default:
			// 기본 삐빅 (QR 스캔 등)
			playTone(1320, 0.1, 'sine', 0.35, 0, options);
			playTone(1760, 0.14, 'sine', 0.35, 0.1, options);
			break;
	}
}

/**
 * 📳 L1~L5 계층형 모바일 진동 패턴 분배
 */
export function playAlertVibration(
	level: AlertSoundLevel = 3,
	options?: { boostOverride?: number; forceUnmute?: boolean }
): void {
	if (!options?.forceUnmute && isSoundMuted()) return;

	const lvl =
		typeof level === 'string' && level.startsWith('l')
			? parseInt(level.replace('l', ''), 10)
			: level;

	switch (lvl) {
		case 1:
			triggerVibration(50, options);
			break;
		case 2:
			triggerVibration(90, options);
			break;
		case 3:
		case 'success':
			// ⭐ L3 (업무 지시): 정중하고 분명한 2단 진동
			triggerVibration([160, 80, 180], options);
			break;
		case 4:
		case 'warning':
			// L4 (긴급 공지): 3단 빠른 진동
			triggerVibration([200, 80, 200, 80, 220], options);
			break;
		case 5:
		case 'error':
			// L5 (시스템 락): 묵직한 경보 연속 진동
			triggerVibration([320, 100, 320, 100, 450], options);
			break;
		default:
			triggerVibration(90, options);
			break;
	}
}

/**
 * 🗣️ 한국어 TTS 음성 방송 (선행 증폭 차임벨 + 차량 소음 관통 피치/속도 튜닝 지원)
 */
export function speakTTS(text: string, options: TtsSpeakOptions = {}): boolean {
	if (!browser || typeof window === 'undefined' || !('speechSynthesis' in window)) {
		return false;
	}
	const trimmed = text?.trim();
	if (!trimmed) return false;

	const preChime = options.preChime ?? true;
	const rate = options.rate ?? 0.96;
	const pitch = options.pitch ?? 1.08;

	const startSpeech = () => {
		try {
			window.speechSynthesis.cancel();
			window.speechSynthesis.resume();

			const utter = new SpeechSynthesisUtterance(trimmed);
			utter.lang = 'ko-KR';
			utter.volume = 1.0; // SpeechSynthesis 최대 볼륨 강제
			utter.rate = rate;
			utter.pitch = pitch;

			if (options.onStart) utter.onstart = () => options.onStart?.();
			if (options.onEnd) utter.onend = () => options.onEnd?.();
			if (options.onError) utter.onerror = (e) => options.onError?.(e);

			window.speechSynthesis.speak(utter);
		} catch (err) {
			options.onError?.(err);
		}
	};

	if (preChime) {
		// 방송 직전 고출력 3단 공항식 프리어텐션 차임벨("딩-동-댕~") 송출 후 음성 시작
		playTone(660, 0.14, 'sine', 0.4, 0, { forceUnmute: true });
		playTone(880, 0.14, 'sine', 0.4, 0.12, { forceUnmute: true });
		playTone(1320, 0.24, 'sine', 0.42, 0.24, { forceUnmute: true });
		setTimeout(startSpeech, 420);
	} else {
		startSpeech();
	}

	return true;
}

export type SoundSampleId =
	| 'l1_toast'
	| 'l2_banner'
	| 'l3_chime'
	| 'l4_warning'
	| 'l5_siren'
	| 'airport_chime'
	| 'dispatch_fanfare'
	| 'task_complete'
	| 'error_buzzer'
	| 'qr_beep'
	| 'camera_shutter';

/**
 * 🎹 11종 사운드 샘플 뱅크 재생 (하드웨어 시험 센터 및 전사 업무 효과음 겸용)
 */
export function playSoundSample(
	sampleId: SoundSampleId,
	options?: { boostOverride?: number; forceUnmute?: boolean }
): void {
	const opts = { forceUnmute: true, ...options };

	switch (sampleId) {
		case 'l1_toast':
			playAlertSound(1, opts);
			break;
		case 'l2_banner':
			playAlertSound(2, opts);
			break;
		case 'l3_chime':
			playAlertSound(3, opts);
			break;
		case 'l4_warning':
			playAlertSound(4, opts);
			break;
		case 'l5_siren':
			playAlertSound(5, opts);
			break;
		case 'airport_chime':
			// ✈️ 공항 안내방송 3단 차임벨 ("딩-동-댕~": G5 -> E5 -> C5 -> G5)
			playTone(523.25, 0.22, 'sine', 0.4, 0, opts); // 도(C5)
			playTone(659.25, 0.22, 'sine', 0.4, 0.18, opts); // 미(E5)
			playTone(783.99, 0.22, 'sine', 0.4, 0.36, opts); // 솔(G5)
			playTone(1046.5, 0.45, 'sine', 0.45, 0.54, opts); // 높은 도(C6)
			break;
		case 'dispatch_fanfare':
			// 🚌 신규 배차 도착 팡파레 (경쾌한 상승 트라이어드)
			playTone(587.33, 0.12, 'triangle', 0.42, 0, opts); // D5
			playTone(739.99, 0.12, 'triangle', 0.42, 0.11, opts); // F#5
			playTone(880.0, 0.12, 'triangle', 0.42, 0.22, opts); // A5
			playTone(1174.66, 0.35, 'triangle', 0.48, 0.33, opts); // D6
			break;
		case 'task_complete':
			// ✅ 작업/승차 완료 멜로디 (맑은 2단 완료음)
			playTone(783.99, 0.12, 'sine', 0.38, 0, opts); // G5
			playTone(1046.5, 0.28, 'sine', 0.42, 0.1, opts); // C6
			break;
		case 'error_buzzer':
			// ❌ 오류/접근 거부 버저 ("띡-띡!" 저음 경고)
			playTone(220, 0.16, 'sawtooth', 0.4, 0, opts);
			playTone(180, 0.26, 'sawtooth', 0.45, 0.18, opts);
			break;
		case 'qr_beep':
			// 🔳 QR/바코드 스캔 성공 ("삐빅!")
			playAlertSound('beep', opts);
			break;
		case 'camera_shutter':
			// 📷 기계식 카메라 셔터음 ("찰-칵")
			playTone(1600, 0.035, 'triangle', 0.45, 0, opts);
			playTone(900, 0.05, 'sine', 0.4, 0.045, opts);
			break;
	}
}

/**
 * 🚀 [원터치 통합 알림기] 사운드와 진동을 등급(Level)에 맞춰 한 번에 동시 실행
 */
export function notifyAlert(
	level: AlertSoundLevel = 3,
	options?: { boostOverride?: number; forceUnmute?: boolean }
): void {
	if (!options?.forceUnmute && isSoundMuted()) return;
	playAlertSound(level, options);
	playAlertVibration(level, options);
}

export default {
	initAudioUnlocker,
	unlockAudioNow,
	isAudioUnlocked,
	onAudioUnlockChange,
	isSoundMuted,
	toggleSoundMute,
	getSoundBoost,
	setSoundBoost,
	isCompressorEnabled,
	setCompressorEnabled,
	isClarityFilterEnabled,
	setClarityFilterEnabled,
	getVibrationBoost,
	setVibrationBoost,
	playTone,
	triggerVibration,
	playAlertSound,
	playAlertVibration,
	playSoundSample,
	speakTTS,
	notifyAlert
};
