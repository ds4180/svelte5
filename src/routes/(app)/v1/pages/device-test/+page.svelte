<script>
	/**
	 * ============================================================================
	 * [모바일 하드웨어 디바이스 종합 시험 센터 (Device Lab)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 스마트폰의 핵심 물리 장비(GPS, 카메라, 스피커/TTS, 진동, 마이크, 화면 꺼짐 방지,
	 * 배터리/자이로스코프 센서)를 브라우저 표준 Web API로 직접 작동시키고 테스트하는 종합 연구실입니다.
	 */

	import { onMount, onDestroy } from 'svelte';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { websocket } from '$lib/runes/websocket.svelte.js';
	import { enterCameraFullscreen } from '$lib/utils/fullscreen';
	import {
		initAudioUnlocker,
		unlockAudioNow,
		isAudioUnlocked,
		onAudioUnlockChange,
		getSoundBoost,
		setSoundBoost,
		isCompressorEnabled,
		setCompressorEnabled,
		isClarityFilterEnabled,
		setClarityFilterEnabled,
		getVibrationBoost,
		setVibrationBoost,
		playTone,
		playAlertSound,
		playSoundSample,
		triggerVibration,
		speakTTS,
		notifyAlert
	} from '$lib/utils/sound';
	import Icon from '@iconify/svelte';

	// ============================================================================
	// 1. 🛰️ GPS 실시간 위치 센서 상태
	// ============================================================================
	let gpsSupported = $state(false);
	let gpsWatching = $state(false);
	let gpsWatchId = /** @type {number | null} */ (null);
	let gpsData = $state({
		latitude: /** @type {number | null} */ (null),
		longitude: /** @type {number | null} */ (null),
		accuracy: /** @type {number | null} */ (null),
		speed: /** @type {number | null} */ (null),
		altitude: /** @type {number | null} */ (null),
		heading: /** @type {number | null} */ (null),
		updatedAt: /** @type {string | null} */ (null)
	});
	let gpsLoading = $state(false);

	function checkGpsSupport() {
		gpsSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
	}

	function getCurrentLocation() {
		if (!gpsSupported) {
			toast.error('이 브라우저는 위치 센서(GPS)를 지원하지 않습니다.');
			return;
		}
		gpsLoading = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				gpsLoading = false;
				gpsData = {
					latitude: Number(pos.coords.latitude.toFixed(6)),
					longitude: Number(pos.coords.longitude.toFixed(6)),
					accuracy: Math.round(pos.coords.accuracy),
					speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0, // km/h
					altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
					heading: pos.coords.heading ? Math.round(pos.coords.heading) : null,
					updatedAt: new Date().toLocaleTimeString('ko-KR')
				};
				toast.success('GPS 현재 위치를 성공적으로 측정했습니다.');
			},
			(err) => {
				gpsLoading = false;
				toast.error(`GPS 측정 실패: ${err.message}`);
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		);
	}

	function toggleGpsWatch() {
		if (!gpsSupported) return;
		if (gpsWatching) {
			if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
			gpsWatchId = null;
			gpsWatching = false;
			toast.info('실시간 GPS 위치 추적을 중단했습니다.');
		} else {
			gpsWatching = true;
			gpsWatchId = navigator.geolocation.watchPosition(
				(pos) => {
					gpsData = {
						latitude: Number(pos.coords.latitude.toFixed(6)),
						longitude: Number(pos.coords.longitude.toFixed(6)),
						accuracy: Math.round(pos.coords.accuracy),
						speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
						altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
						heading: pos.coords.heading ? Math.round(pos.coords.heading) : null,
						updatedAt: new Date().toLocaleTimeString('ko-KR')
					};
				},
				(err) => {
					toast.error(`GPS 추적 오류: ${err.message}`);
					toggleGpsWatch();
				},
				{ enableHighAccuracy: true, maximumAge: 1000 }
			);
			toast.success('실시간 GPS 연속 추적을 시작했습니다.');
		}
	}

	// ============================================================================
	// 2. 📷 카메라 렌즈 & 비디오 뷰파인더 상태
	// ============================================================================
	let cameraSupported = $state(false);
	let isCameraOn = $state(false);
	let facingMode = $state('environment'); // 'environment'(후면) | 'user'(전면)
	let videoElement = /** @type {HTMLVideoElement | null} */ (null);
	let mediaStream = /** @type {MediaStream | null} */ (null);
	let capturedPhoto = $state(/** @type {string | null} */ (null));
	let isFlashOn = $state(false);
	let flashSupported = $state(false);

	// 🔳 실시간 QR 코드 스캐너 상태
	let qrScanActive = $state(false);
	let lastScannedResult = $state(/** @type {string | null} */ (null));
	let scanIntervalId = /** @type {any} */ (null);
	let barcodeDetector = /** @type {any} */ (null);
	let jsQrLoaded = $state(false);
	let autoNavigateUrl = $state(true); // 웹페이지 QR 감지 시 즉시 자동 이동 모드 (기본 ON)
	let navigatingUrl = $state(/** @type {string | null} */ (null)); // 이동 진행 중인 URL

	function checkCameraSupport() {
		cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

		// 1. 브라우저 내장 BarcodeDetector 지원 확인
		if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
			try {
				barcodeDetector = new (/** @type {any} */ (window)).BarcodeDetector({ formats: ['qr_code'] });
			} catch (e) {
				barcodeDetector = null;
			}
		}

		// 2. iOS 사파리 및 크로스 브라우저 호환을 위한 jsQR 동적 로드
		if (typeof window !== 'undefined' && !(/** @type {any} */ (window)).jsQR) {
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
			script.async = true;
			script.onload = () => { jsQrLoaded = true; };
			document.head.appendChild(script);
		} else {
			jsQrLoaded = true;
		}
	}

	async function startCamera() {
		if (!cameraSupported) {
			toast.error('이 브라우저는 카메라 장비 접근을 지원하지 않습니다.');
			return;
		}
		try {
			stopCamera();
			mediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: facingMode,
					width: { ideal: 1280 },
					height: { ideal: 720 }
				},
				audio: false
			});
			if (videoElement) {
				videoElement.srcObject = mediaStream;
				await videoElement.play();
			}
			isCameraOn = true;

			// 플래시(Torch) 지원 여부 확인
			const track = mediaStream.getVideoTracks()[0];
			const caps = /** @type {any} */ (track.getCapabilities ? track.getCapabilities() : {});
			flashSupported = !!caps.torch;

			toast.success(`${facingMode === 'environment' ? '후면' : '전면'} 카메라가 활성화되었습니다.`);
		} catch (e) {
			toast.error(`카메라 접근 오류: ${/** @type {any} */ (e).message}`);
			isCameraOn = false;
		}
	}

	function stopCamera() {
		stopQrScanning();
		if (mediaStream) {
			mediaStream.getTracks().forEach(t => t.stop());
			mediaStream = null;
		}
		if (videoElement) {
			videoElement.srcObject = null;
		}
		isCameraOn = false;
		isFlashOn = false;
	}

	async function switchCamera() {
		facingMode = facingMode === 'environment' ? 'user' : 'environment';
		if (isCameraOn) {
			await startCamera();
			if (qrScanActive) {
				startQrScanning();
			}
		}
	}

	async function toggleFlash() {
		if (!mediaStream) return;
		const track = mediaStream.getVideoTracks()[0];
		try {
			isFlashOn = !isFlashOn;
			await (/** @type {any} */ (track)).applyConstraints({
				advanced: [{ torch: isFlashOn }]
			});
			toast.info(`카메라 플래시 조명: ${isFlashOn ? 'ON' : 'OFF'}`);
		} catch (e) {
			toast.error('이 기기에서는 카메라 플래시를 제어할 수 없습니다.');
			isFlashOn = false;
		}
	}

	function capturePhoto() {
		if (!videoElement || !isCameraOn) return;
		const canvas = document.createElement('canvas');
		canvas.width = videoElement.videoWidth || 640;
		canvas.height = videoElement.videoHeight || 480;
		const ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			capturedPhoto = canvas.toDataURL('image/jpeg', 0.9);
			toast.success('사진 스냅샷을 캡처했습니다.');
		}
	}

	// 🔳 실시간 QR 스캔 시작 및 정지 제어
	async function toggleQrScan() {
		if (!isCameraOn) {
			await startCamera();
		}
		if (qrScanActive) {
			stopQrScanning();
			toast.info('실시간 QR 스캔을 중단했습니다.');
		} else {
			startQrScanning();
			toast.success('실시간 QR 코드 스캐너가 시작되었습니다. QR을 화면에 비춰주세요!');
		}
	}

	function startQrScanning() {
		if (scanIntervalId) clearInterval(scanIntervalId);
		qrScanActive = true;

		scanIntervalId = setInterval(async () => {
			if (!videoElement || !isCameraOn || videoElement.readyState < 2) return;

			// 1. 브라우저 네이티브 하드웨어 가속 BarcodeDetector 시도
			if (barcodeDetector) {
				try {
					const codes = await barcodeDetector.detect(videoElement);
					if (codes && codes.length > 0 && codes[0].rawValue) {
						handleQrDetected(codes[0].rawValue);
						return;
					}
				} catch (e) {
					// 폴백으로 계속 진행
				}
			}

			// 2. iOS 사파리 및 범용 jsQR 엔진 폴백
			const jsQR = (/** @type {any} */ (window)).jsQR;
			if (typeof jsQR === 'function') {
				try {
					const canvas = document.createElement('canvas');
					const w = Math.min(videoElement.videoWidth || 640, 640);
					const h = Math.min(videoElement.videoHeight || 480, 480);
					canvas.width = w;
					canvas.height = h;
					const ctx = canvas.getContext('2d', { willReadFrequently: true });
					if (ctx) {
						ctx.drawImage(videoElement, 0, 0, w, h);
						const imgData = ctx.getImageData(0, 0, w, h);
						const code = jsQR(imgData.data, imgData.width, imgData.height, {
							inversionAttempts: 'dontInvert'
						});
						if (code && code.data) {
							handleQrDetected(code.data);
						}
					}
				} catch (err) {
					// 일시 프레임 처리 건너뜀
				}
			}
		}, 200); // 0.2초마다 초고속 프레임 디코딩
	}

	function stopQrScanning() {
		if (scanIntervalId) {
			clearInterval(scanIntervalId);
			scanIntervalId = null;
		}
		qrScanActive = false;
	}

	/**
	 * 텍스트에서 유효한 웹페이지 URL 추출 및 정규화
	 * @param {string} text
	 */
	function extractUrl(text) {
		if (!text) return null;
		const trimmed = text.trim();
		// 1. 완전한 프로토콜 URL (http://, https://)
		if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
			return trimmed;
		}
		// 2. 사내 내부 경로 (/v1/...)
		if (trimmed.startsWith('/')) {
			return trimmed;
		}
		// 3. 프로토콜 생략 도메인 (예: naver.com, www.daum.net, bit.ly/...)
		const domainRegex = /^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/;
		if (domainRegex.test(trimmed)) {
			return `https://${trimmed}`;
		}
		return null;
	}

	/**
	 * QR 코드 인식 성공 처리
	 * @param {string} data
	 */
	function handleQrDetected(data) {
		if (lastScannedResult === data) return; // 동일 QR 중복 감지 방지
		lastScannedResult = data;

		// 🔊 인식 성공 비프음 ("삐빅!")
		playBeepSound(1320, 0.12, 'sine');
		setTimeout(() => playBeepSound(1760, 0.15, 'sine'), 120);

		// 📳 지원 기기인 경우 햅틱 진동
		if (vibrationSupported) {
			navigator.vibrate(80);
		}

		// 🌐 웹페이지 URL 감지 및 자동 이동 처리
		const targetUrl = extractUrl(data);
		if (targetUrl) {
			if (autoNavigateUrl) {
				navigatingUrl = targetUrl;
				toast.success(`웹페이지 QR 감지! 해당 페이지로 즉시 자동 이동합니다.`);
				stopCamera();

				setTimeout(() => {
					window.location.href = targetUrl;
				}, 400);
			} else {
				toast.success(`웹페이지 URL이 감지되었습니다.`);
			}
		} else {
			toast.success(`QR 코드 인식 성공! (일반 텍스트)`);
		}
	}

	// ============================================================================
	// 3. 🔊 스피커 사운드 합성 (100%~400% 증폭) & 한국어 TTS 음성 방송
	// ============================================================================
	let ttsText = $state('안전 운행 하십시오. 3분 후 제주공항 방면으로 출발합니다.');
	let isSpeaking = $state(false);
	let audioUnlocked = $state(false);
	let soundBoost = $state(1.8); // 1.0 (100%) ~ 4.0 (400%)
	let compressorOn = $state(true);
	let clarityFilterOn = $state(true);
	let ttsPreChime = $state(true);
	let ttsPitch = $state(1.08);
	let ttsRate = $state(0.96);
	let delayedTestCountdown = $state(0);
	let delayedTestTimer = /** @type {any} */ (null);
	let unsubscribeAudioUnlock = /** @type {(() => void) | null} */ (null);
	let activeSampleId = $state('l3_chime');

	// 🎹 11종 사운드 샘플 뱅크 목록
	const soundSamples = [
		{ id: 'l1_toast', label: '🔔 L1 토스트 팝', desc: '단발 880Hz 알림' },
		{ id: 'l2_banner', label: '✨ L2 배너 상승음', desc: '부드러운 2단 음' },
		{ id: 'l3_chime', label: '🛎️ L3 딩동 차임', desc: '업무지시 표준벨' },
		{ id: 'l4_warning', label: '⚠️ L4 긴급 3단비프', desc: '주의환기 삐삐삐' },
		{ id: 'l5_siren', label: '🚨 L5 경보 사이렌', desc: '시스템락 위잉~' },
		{ id: 'airport_chime', label: '✈️ 공항 4단 차임', desc: '딩-동-댕-동 방송벨' },
		{ id: 'dispatch_fanfare', label: '🚌 신규배차 팡파레', desc: '경쾌한 배차도착음' },
		{ id: 'task_complete', label: '✅ 승차/작업 완료', desc: '밝은 확인 멜로디' },
		{ id: 'error_buzzer', label: '❌ 오류/거부 버저', desc: '저음 띡-띡 경고음' },
		{ id: 'qr_beep', label: '🔳 QR 스캔 삐빅', desc: '고주파 스캐너음' },
		{ id: 'camera_shutter', label: '📷 카메라 셔터음', desc: '기계식 찰칵 효과음' }
	];

	// 🗣️ 한국어 TTS 안내방송 문구 샘플 프리셋
	const ttsPresets = [
		{ label: '🚌 출발안내', text: '안전 운행 하십시오. 3분 후 제주공항 방면으로 출발합니다.' },
		{ label: '📋 배차도착', text: '신규 배차 지시가 도착했습니다. 화면의 배차 내역을 확인해 주십시오.' },
		{ label: '🚨 기상특보', text: '긴급 공지입니다. 현재 한라산 횡단도로 폭설로 인해 우회 운행 바랍니다.' },
		{ label: '🎫 탑승완료', text: '탑승권 QR 확인이 완료되었습니다. 즐거운 제주 여행 되십시오.' }
	];

	/**
	 * @param {any} sample
	 */
	function triggerSample(sample) {
		activeSampleId = sample.id;
		playSoundSample(sample.id, { boostOverride: soundBoost, forceUnmute: true });
		toast.info(`${sample.label} 재생 (증폭: ${Math.round(soundBoost * 100)}%)`);
	}

	function initSoundLabState() {
		initAudioUnlocker();
		soundBoost = getSoundBoost();
		compressorOn = isCompressorEnabled();
		clarityFilterOn = isClarityFilterEnabled();
		vibrationBoost = getVibrationBoost();
		unsubscribeAudioUnlock = onAudioUnlockChange((state) => {
			audioUnlocked = state;
		});
	}

	/**
	 * @param {number} val
	 */
	function updateSoundBoost(val) {
		soundBoost = setSoundBoost(val);
	}

	function toggleCompressor() {
		compressorOn = !compressorOn;
		setCompressorEnabled(compressorOn);
		toast.info(`스피커 찢어짐 방지 리미터(Compressor): ${compressorOn ? 'ON' : 'OFF'}`);
	}

	function toggleClarityFilter() {
		clarityFilterOn = !clarityFilterOn;
		setClarityFilterEnabled(clarityFilterOn);
		toast.info(`2.4kHz 차량 소음 관통 명료도 필터: ${clarityFilterOn ? 'ON' : 'OFF'}`);
	}

	function playBeepSound(freq = 880, duration = 0.2, type = 'sine') {
		playTone(freq, duration, /** @type {OscillatorType} */ (type), 0.35, 0, {
			boostOverride: soundBoost,
			forceUnmute: true
		});
	}

	function playChimeSound() {
		playAlertSound(3, { boostOverride: soundBoost, forceUnmute: true });
		toast.success(`L3 업무지시 차임벨 출력 (증폭: ${Math.round(soundBoost * 100)}%)`);
	}

	function playSirenSound() {
		playAlertSound(5, { boostOverride: soundBoost, forceUnmute: true });
		toast.warning(`L5 긴급 경보 사이렌 출력 (증폭: ${Math.round(soundBoost * 100)}%)`);
	}

	function speakText() {
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			toast.error('이 기기는 한국어 음성 방송(TTS)을 지원하지 않습니다.');
			return;
		}
		if (!ttsText.trim()) return;

		isSpeaking = true;
		const ok = speakTTS(ttsText, {
			preChime: ttsPreChime,
			pitch: ttsPitch,
			rate: ttsRate,
			onStart: () => {
				isSpeaking = true;
			},
			onEnd: () => {
				isSpeaking = false;
			},
			onError: () => {
				isSpeaking = false;
				toast.error('음성 합성 오류 발생');
			}
		});
		if (ok) {
			toast.info(
				`한국어 TTS 방송 출력 (${ttsPreChime ? '선행 앰프 차임벨 포함' : '음성 단독'}, 증폭 ${Math.round(soundBoost * 100)}%)`
			);
		}
	}

	/**
	 * ⏱️ [핵심 검증] 3초 뒤 무터치(웹소켓 수신 시뮬레이션) 자동 발사 테스트
	 * 버튼을 누른 뒤 손을 완전히 떼고 있어도 3초 후 비동기 콜백에서 차임벨 + TTS + 진동이 차단 없이 터지는지 검증
	 */
	function startDelayedNoTouchTest() {
		if (delayedTestCountdown > 0) return;
		unlockAudioNow();
		delayedTestCountdown = 3;
		toast.info('⏱️ 스마트폰/마우스에서 손을 떼세요! 3초 뒤 웹소켓 가상 신호로 소리와 진동이 발사됩니다.');

		delayedTestTimer = setInterval(() => {
			delayedTestCountdown -= 1;
			if (delayedTestCountdown <= 0) {
				clearInterval(delayedTestTimer);
				delayedTestTimer = null;
				// 사용자 이벤트가 전혀 없는 순수 비동기 시점(웹소켓 수신과 동일 조건)에서 발사!
				notifyAlert(3, { boostOverride: soundBoost, forceUnmute: true });
				speakTTS(ttsText, {
					preChime: false,
					pitch: ttsPitch,
					rate: ttsRate,
					onStart: () => {
						isSpeaking = true;
					},
					onEnd: () => {
						isSpeaking = false;
					}
				});
				toast.success('🚀 [무터치 발사 성공!] 사용자 이벤트 없이 차임벨 + TTS + 진동이 출력되었습니다.');
			}
		}, 1000);
	}

	// ============================================================================
	// 4. 📳 진동 모터 (Vibration & 증폭 배율)
	// ============================================================================
	let vibrationSupported = $state(false);
	let vibrationBoost = $state(1.5); // 1.0 (100%) ~ 3.0 (300%)

	function checkVibrationSupport() {
		vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
	}

	/**
	 * @param {number} val
	 */
	function updateVibrationBoost(val) {
		vibrationBoost = setVibrationBoost(val);
	}

	/**
	 * @param {number | number[]} pattern
	 * @param {string} label
	 */
	function triggerVibrate(pattern, label) {
		if (!vibrationSupported) {
			toast.error('이 스마트폰은 진동 모터(Vibration API)를 지원하지 않거나 권한이 없습니다. (iOS 사파리는 진동 미지원)');
			return;
		}
		const success = triggerVibration(pattern, {
			boostOverride: vibrationBoost,
			forceUnmute: true
		});
		if (success) {
			toast.success(
				`[${label}] 진동 모터 작동 완료! (강도 배율: ${Math.round(vibrationBoost * 100)}%)`
			);
		} else {
			toast.warning('기기에서 진동 작동을 거부했습니다.');
		}
	}

	// ============================================================================
	// 5. 🎙️ 마이크 센서 & 실시간 볼륨 레벨 게이지
	// ============================================================================
	let micSupported = $state(false);
	let isMicOn = $state(false);
	let micStream = /** @type {MediaStream | null} */ (null);
	let micAudioCtx = /** @type {AudioContext | null} */ (null);
	let micAnalyser = /** @type {AnalyserNode | null} */ (null);
	let micVolumeLevel = $state(0);
	let micAnimFrame = /** @type {number | null} */ (null);

	function checkMicSupport() {
		micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
	}

	async function toggleMic() {
		if (isMicOn) {
			stopMic();
			toast.info('마이크 측정을 종료했습니다.');
			return;
		}
		if (!micSupported) {
			toast.error('마이크 장치를 지원하지 않습니다.');
			return;
		}
		try {
			micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
			const AudioContextClass = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext;
			micAudioCtx = new AudioContextClass();
			micAnalyser = micAudioCtx.createAnalyser();
			micAnalyser.fftSize = 256;

			const source = micAudioCtx.createMediaStreamSource(micStream);
			source.connect(micAnalyser);

			isMicOn = true;
			toast.success('마이크를 활성화했습니다. 소리를 내보세요!');
			updateMicLevel();
		} catch (e) {
			toast.error(`마이크 권한 거부 또는 오류: ${/** @type {any} */ (e).message}`);
			stopMic();
		}
	}

	function updateMicLevel() {
		if (!isMicOn || !micAnalyser) return;
		const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
		micAnalyser.getByteFrequencyData(dataArray);

		let sum = 0;
		for (let i = 0; i < dataArray.length; i++) {
			sum += dataArray[i];
		}
		const average = sum / dataArray.length;
		micVolumeLevel = Math.min(100, Math.round((average / 128) * 100));

		micAnimFrame = requestAnimationFrame(updateMicLevel);
	}

	function stopMic() {
		if (micAnimFrame) cancelAnimationFrame(micAnimFrame);
		if (micStream) {
			micStream.getTracks().forEach(t => t.stop());
			micStream = null;
		}
		if (micAudioCtx) {
			micAudioCtx.close();
			micAudioCtx = null;
		}
		micAnalyser = null;
		micVolumeLevel = 0;
		isMicOn = false;
	}

	// ============================================================================
	// 6. 📱 화면 꺼짐 방지 (Screen Wake Lock)
	// ============================================================================
	let wakeLockSupported = $state(false);
	let isWakeLocked = $state(false);
	let wakeLockSentinel = /** @type {any} */ (null);

	function checkWakeLockSupport() {
		wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
	}

	async function toggleWakeLock() {
		if (!wakeLockSupported) {
			toast.error('이 브라우저는 화면 꺼짐 방지(Screen Wake Lock)를 지원하지 않습니다.');
			return;
		}
		if (isWakeLocked) {
			if (wakeLockSentinel) {
				await wakeLockSentinel.release();
				wakeLockSentinel = null;
			}
			isWakeLocked = false;
			toast.info('화면 꺼짐 방지를 해제했습니다. (기기 기본 절전 적용)');
		} else {
			try {
				wakeLockSentinel = await navigator.wakeLock.request('screen');
				isWakeLocked = true;
				wakeLockSentinel.addEventListener('release', () => {
					isWakeLocked = false;
				});
				toast.success('화면 꺼짐 방지 활성화: 스마트폰 화면이 상시 켜짐 상태로 유지됩니다.');
			} catch (e) {
				toast.error(`화면 꺼짐 방지 실패: ${/** @type {any} */ (e).message}`);
				isWakeLocked = false;
			}
		}
	}

	// ============================================================================
	// 7. 🔋 배터리 & 기울기 자이로 센서
	// ============================================================================
	let batteryInfo = $state({
		supported: false,
		level: /** @type {number | null} */ (null),
		charging: /** @type {boolean | null} */ (null)
	});

	let orientationData = $state({
		supported: false,
		alpha: /** @type {number | null} */ (null), // 방위각 (0~360)
		beta: /** @type {number | null} */ (null),  // 앞뒤 기울기 (-180~180)
		gamma: /** @type {number | null} */ (null)  // 좌우 기울기 (-90~90)
	});

	async function checkBattery() {
		if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
			batteryInfo.supported = true;
			try {
				const b = await (/** @type {any} */ (navigator)).getBattery();
				batteryInfo.level = Math.round(b.level * 100);
				batteryInfo.charging = b.charging;

				b.addEventListener('levelchange', () => {
					batteryInfo.level = Math.round(b.level * 100);
				});
				b.addEventListener('chargingchange', () => {
					batteryInfo.charging = b.charging;
				});
			} catch (e) {
				batteryInfo.supported = false;
			}
		}
	}

	function handleOrientation(/** @type {DeviceOrientationEvent} */ event) {
		if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
			orientationData.supported = true;
			orientationData.alpha = event.alpha ? Math.round(event.alpha) : 0;
			orientationData.beta = event.beta ? Math.round(event.beta) : 0;
			orientationData.gamma = event.gamma ? Math.round(event.gamma) : 0;
		}
	}

	// ============================================================================
	// 8. 📞 원터치 전화(Call) & 💬 문자(SMS) 자동 템플릿
	// ============================================================================
	let telNumber = $state('064-740-6000'); // 제주 종합교통관제센터 예시 번호
	let smsNumber = $state('010-1234-5678');
	let smsMessage = $state('[jeju.live] 14:00 제주공항 방면 701호 배차가 확정되었습니다.');

	function makePhoneCall(number = telNumber) {
		if (!number) {
			toast.error('전화번호를 입력해 주세요.');
			return;
		}
		const cleanNumber = number.replace(/[^0-9+*#-]/g, '');
		toast.info(`📞 ${cleanNumber} 번호로 통화 화면을 호출합니다...`);
		window.location.href = `tel:${cleanNumber}`;
	}

	function sendSms(number = smsNumber, text = smsMessage) {
		if (!number) {
			toast.error('수신인 전화번호를 입력해 주세요.');
			return;
		}
		const cleanNumber = number.replace(/[^0-9+]/g, '');
		const encodedBody = encodeURIComponent(text || '');
		// iOS는 &body=, 안드로이드/표준은 ?body= 구분자 호환
		const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
		const separator = isIos ? '&' : '?';
		toast.success(`💬 ${cleanNumber} 수신인 및 본문 자동완성 문자 앱을 실행합니다.`);
		window.location.href = `sms:${cleanNumber}${separator}body=${encodedBody}`;
	}

	// ============================================================================
	// 9. 📤 시스템 네이티브 공유 (Web Share) & 📋 클립보드 복사
	// ============================================================================
	let shareSupported = $state(false);
	let shareTitle = $state('제주공항 리무진 701호 운행 일보');
	let shareText = $state('금일 14:00 제주공항 방면 배차 확인 및 차량 점검 완료 보고입니다.');
	let clipboardCopyText = $state('제주 70자 1234 (기사: 홍길동 / 010-1234-5678)');

	function checkShareSupport() {
		shareSupported = typeof navigator !== 'undefined' && 'share' in navigator;
	}

	async function triggerWebShare() {
		if (!shareSupported) {
			toast.error('이 브라우저는 시스템 공유(Web Share API)를 지원하지 않습니다.');
			return;
		}
		try {
			await navigator.share({
				title: shareTitle,
				text: shareText,
				url: window.location.href
			});
			toast.success('시스템 공유 시트를 성공적으로 호출했습니다.');
		} catch (e) {
			if ((/** @type {any} */ (e)).name !== 'AbortError') {
				toast.error(`공유 실패: ${/** @type {any} */ (e).message}`);
			}
		}
	}

	async function copyToClipboard(text = clipboardCopyText) {
		if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
			try {
				await navigator.clipboard.writeText(text);
				if (vibrationSupported) navigator.vibrate(40);
				toast.success('클립보드에 복사되었습니다! (원터치 복사 완료)');
			} catch (e) {
				toast.error('클립보드 복사 실패');
			}
		} else {
			toast.error('클립보드 API를 지원하지 않습니다.');
		}
	}

	// ============================================================================
	// 10. 🌐 네트워크 통신망 감지 & 🔐 생체 인증(지문/Face ID) 지원 판별
	// ============================================================================
	let netInfo = $state({
		online: true,
		type: 'wifi/cellular',
		downlink: /** @type {number | null} */ (null),
		rtt: /** @type {number | null} */ (null)
	});
	let biometricsSupported = $state(false);
	let biometricsStatusText = $state('확인 중...');

	function checkNetworkStatus() {
		if (typeof navigator !== 'undefined') {
			netInfo.online = navigator.onLine;
			const conn = (/** @type {any} */ (navigator)).connection || (/** @type {any} */ (navigator)).mozConnection || (/** @type {any} */ (navigator)).webkitConnection;
			if (conn) {
				netInfo.type = conn.effectiveType || conn.type || '알 수 없음';
				netInfo.downlink = conn.downlink || null;
				netInfo.rtt = conn.rtt || null;
			}
		}
	}

	async function checkBiometricsSupport() {
		if (typeof window !== 'undefined' && window.PublicKeyCredential) {
			try {
				const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
				biometricsSupported = available;
				biometricsStatusText = available ? '지원 기기 (지문 / 패턴 잠금 탑재)' : '생체 센서 미탑재 / 권한 없음';
			} catch (e) {
				biometricsSupported = false;
				biometricsStatusText = '지원 여부 조회 불가';
			}
		} else {
			biometricsSupported = false;
			biometricsStatusText = 'WebAuthn 미지원 브라우저';
		}
	}

	let biometricsLoading = $state(false);
	let lastBioResult = $state(/** @type {string | null} */ (null));
	let lastBioStatus = $state(/** @type {'success' | 'error' | null} */ (null));
	let bioAccountName = $state('driver_kim (김기사)');
	let registeredPasskey = $state(
		/** @type {{ credentialId: string; rawIdBase64: string; ownerAccount: string; registeredAt: string; verifyCount: number } | null} */ (
			null
		)
	);

	const PASSKEY_STORAGE_KEY = 'jeju_biometric_passkey_v1';

	/**
	 * ArrayBuffer -> Base64 변환
	 * @param {ArrayBuffer} buffer
	 */
	function bufferToBase64(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Base64 -> Uint8Array 변환
	 * @param {string} base64
	 */
	function base64ToUint8Array(base64) {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}

	function loadSavedPasskey() {
		if (typeof window === 'undefined') return;
		try {
			const raw = localStorage.getItem(PASSKEY_STORAGE_KEY);
			if (raw) {
				registeredPasskey = JSON.parse(raw);
			}
		} catch {
			registeredPasskey = null;
		}
	}

	function clearSavedPasskey() {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(PASSKEY_STORAGE_KEY);
		}
		registeredPasskey = null;
		lastBioResult = null;
		lastBioStatus = null;
		toast.info('등록된 생체 인증 열쇠(Passkey) 정보가 초기화되었습니다.');
	}

	/**
	 * 🔑 [1단계: 등록 (create)] 현재 선택된 계정에 이 스마트폰의 지문/생체 보안 열쇠를 발급 및 귀속
	 */
	async function registerBiometricKey() {
		if (typeof window === 'undefined' || !window.PublicKeyCredential) {
			toast.error('이 브라우저는 생체 인증(WebAuthn)을 지원하지 않습니다.');
			return;
		}
		biometricsLoading = true;
		lastBioResult = null;
		lastBioStatus = null;
		toast.info(`[1단계 등록] '${bioAccountName}' 계정에 귀속할 지문/패턴을 인증해 주세요...`);

		try {
			const challenge = new Uint8Array(32);
			window.crypto.getRandomValues(challenge);

			const userBytes = new TextEncoder().encode(bioAccountName);

			const credential = /** @type {PublicKeyCredential | null} */ (
				await navigator.credentials.create({
					publicKey: {
						challenge,
						rp: {
							name: 'jeju.live Passkey Auth',
							id: window.location.hostname
						},
						user: {
							id: userBytes,
							name: bioAccountName,
							displayName: bioAccountName
						},
						pubKeyCredParams: [
							{ type: 'public-key', alg: -7 }, // ES256
							{ type: 'public-key', alg: -257 } // RS256
						],
						authenticatorSelection: {
							authenticatorAttachment: 'platform',
							userVerification: 'required'
						},
						timeout: 60000
					}
				})
			);

			biometricsLoading = false;
			if (credential && credential.rawId) {
				const rawIdBase64 = bufferToBase64(credential.rawId);
				const saved = {
					credentialId: credential.id,
					rawIdBase64,
					ownerAccount: bioAccountName,
					registeredAt: new Date().toLocaleTimeString('ko-KR'),
					verifyCount: 0
				};
				registeredPasskey = saved;
				localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(saved));

				playSoundSample('task_complete', { boostOverride: soundBoost, forceUnmute: true });
				if (vibrationSupported) triggerVibration([120, 60, 150], { forceUnmute: true });

				lastBioStatus = 'success';
				lastBioResult = `✅ [1단계 등록 완료] '${bioAccountName}' 계정에 이 휴대폰의 전용 지문 열쇠(${credential.id.substring(0, 14)}...)가 발급·귀속되었습니다!`;
				toast.success(`🎉 1단계 지문 열쇠 등록 완료! 이제 2단계 검증 버튼을 눌러보세요.`);
			}
		} catch (e) {
			biometricsLoading = false;
			const err = /** @type {any} */ (e);
			lastBioStatus = 'error';
			if (err.name === 'NotAllowedError') {
				lastBioResult = '❌ 지문 등록이 취소되었거나 생체 정보가 일치하지 않습니다.';
				toast.info(lastBioResult);
			} else {
				lastBioResult = `❌ 등록 오류: ${err.message}`;
				toast.error(lastBioResult);
			}
		}
	}

	/**
	 * 🛡️ [2단계: 검증 (get)] 휴대폰 지문 일치 + 계정에 등록된 열쇠 번호(Credential ID) 일치 2중 대조
	 */
	async function verifyBiometricKey() {
		if (typeof window === 'undefined' || !window.PublicKeyCredential) {
			toast.error('이 브라우저는 생체 인증(WebAuthn)을 지원하지 않습니다.');
			return;
		}
		if (!registeredPasskey) {
			toast.warning('먼저 [1단계: 지문 열쇠 등록]을 실행하여 계정에 기기를 등록해 주세요!');
			return;
		}

		biometricsLoading = true;
		lastBioResult = null;
		lastBioStatus = null;
		toast.info(`[2단계 검증] '${bioAccountName}' 계정 본인 확인을 위해 지문을 스캔해 주세요...`);

		try {
			const challenge = new Uint8Array(32);
			window.crypto.getRandomValues(challenge);
			const allowedIdBytes = base64ToUint8Array(registeredPasskey.rawIdBase64);

			// 등록된 고유 열쇠 번호(allowCredentials)만 허용하여 하드웨어 서명 요청
			const assertion = /** @type {PublicKeyCredential | null} */ (
				await navigator.credentials.get({
					publicKey: {
						challenge,
						rpId: window.location.hostname,
						allowCredentials: [
							{
								type: 'public-key',
								id: allowedIdBytes
							}
						],
						userVerification: 'required',
						timeout: 60000
					}
				})
			);

			biometricsLoading = false;
			if (assertion) {
				// 1) 하드웨어 열쇠 ID 대조 + 2) 요청 계정과 열쇠 소유 계정 일치 대조
				if (assertion.id !== registeredPasskey.credentialId) {
					playSoundSample('error_buzzer', { boostOverride: soundBoost, forceUnmute: true });
					lastBioStatus = 'error';
					lastBioResult = `🚨 [열쇠 불일치 차단] 등록된 기기 열쇠 번호와 일치하지 않습니다!`;
					toast.error(lastBioResult);
					return;
				}

				if (bioAccountName !== registeredPasskey.ownerAccount) {
					playSoundSample('error_buzzer', { boostOverride: soundBoost, forceUnmute: true });
					if (vibrationSupported) triggerVibration([250, 80, 250], { forceUnmute: true });
					lastBioStatus = 'error';
					lastBioResult = `🚨 [계정 도용 차단!] 휴대폰 지문은 통과했으나, 이 기기 열쇠는 '${registeredPasskey.ownerAccount}' 계정 소유입니다. 현재 선택된 '${bioAccountName}' 계정으로는 인증할 수 없습니다!`;
					toast.error('계정 주인과 기기 소유자가 불일치하여 차단되었습니다!');
					return;
				}

				// 휴대폰 소유자 지문 + 계정 주인 열쇠 100% 일치!
				registeredPasskey.verifyCount += 1;
				localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(registeredPasskey));

				playSoundSample('dispatch_fanfare', { boostOverride: soundBoost, forceUnmute: true });
				if (vibrationSupported) triggerVibration([120, 60, 180], { forceUnmute: true });

				lastBioStatus = 'success';
				lastBioResult = `🎉 [2단계 완벽 일치 (누적 ${registeredPasskey.verifyCount}회)] 휴대폰 지문 + '${bioAccountName}' 계정의 등록 열쇠(${assertion.id.substring(0, 12)}...)가 100% 일치합니다!`;
				toast.success('휴대폰 소유자 및 계정 주인 2중 검증 통과!');
			}
		} catch (e) {
			biometricsLoading = false;
			const err = /** @type {any} */ (e);
			lastBioStatus = 'error';
			if (err.name === 'NotAllowedError') {
				lastBioResult = '❌ 지문 검증이 취소되었거나 이 기기에 해당 계정의 열쇠가 없습니다.';
				toast.info(lastBioResult);
			} else {
				lastBioResult = `❌ 검증 오류: ${err.message}`;
				toast.error(lastBioResult);
			}
		}
	}

	// ============================================================================
	// 10-B. 💻 데스크톱 ↔ 📱 모바일 실시간 원격 지문 공조 (대외비 문서 열람 승인)
	// ============================================================================
	const clientTabId = Math.random().toString(36).substring(2, 9);
	const COOP_DEVICE_ID_KEY = 'jeju_coop_device_id_v1';

	function getMyCoopDeviceId() {
		if (typeof window === 'undefined') return clientTabId;
		let id = localStorage.getItem(COOP_DEVICE_ID_KEY);
		if (!id) {
			id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
			localStorage.setItem(COOP_DEVICE_ID_KEY, id);
		}
		return id;
	}

	let coopDocUnlocked = $state(false);
	let coopWaiting = $state(false);
	let coopCountdown = $state(0);
	let coopTimer = /** @type {any} */ (null);
	let activeCoopRequestId = $state(/** @type {string | null} */ (null));
	let handledCoopRequestId = /** @type {string | null} */ (null);
	let coopApprovalInfo = $state(
		/** @type {{ verifiedAccount: string; credentialId: string; verifiedAt: string; status: string; reason?: string } | null} */ (
			null
		)
	);
	// 모바일(수신측)에 팝업될 원격 승인 요청 데이터
	let incomingCoopRequest = $state(
		/** @type {{ requestId: string; docTitle: string; targetAccount: string; requestedAt: string; senderTabId: string } | null} */ (
			null
		)
	);
	let unsubscribeCoopWs = /** @type {(() => void) | null} */ (null);

	/**
	 * 📱 [모바일 수신 처리] 백엔드가 요청자 본인의 MOBILE 기기로만 타겟 전송한 지문 승인 요청 처리
	 * @param {any} msg
	 */
	function handleIncomingCoopRequest(msg) {
		if (!msg || !msg.requestId) return;
		const myDeviceId = getMyCoopDeviceId();

		// 방어적 검증: 만약 동일 기기/탭에서 발신한 요청이면 무시
		if (
			coopWaiting ||
			activeCoopRequestId === msg.requestId ||
			(msg.senderDeviceId && msg.senderDeviceId === myDeviceId) ||
			(msg.senderTabId && msg.senderTabId === clientTabId)
		) {
			return;
		}

		// 이미 모달에 띄운 동일 요청이면 중복 알림 생략
		if (handledCoopRequestId === msg.requestId && incomingCoopRequest?.requestId === msg.requestId) {
			return;
		}
		handledCoopRequestId = msg.requestId;

		incomingCoopRequest = {
			requestId: msg.requestId,
			docTitle: msg.docTitle || '[대외비] 2026년 제주공항 리무진 배차 정산 기밀 보고서',
			targetAccount: msg.targetAccount || 'driver_kim (김기사)',
			requestedAt: msg.requestedAt || new Date().toLocaleTimeString('ko-KR'),
			senderTabId: msg.senderTabId || ''
		};

		// 🔊 스마트폰 차임벨 + 진동 + TTS 즉시 발사
		notifyAlert(3, { boostOverride: soundBoost, forceUnmute: true });
		speakTTS('데스크톱에서 중요 문서 열람 지문 승인을 요청했습니다. 지문을 인증해 주십시오.', {
			preChime: false,
			pitch: ttsPitch,
			rate: ttsRate
		});
		toast.info('📲 [데스크톱 공조 요청] 중요 문서 열람을 위해 스마트폰 지문 승인이 요청되었습니다!');
	}

	/**
	 * 💻 [데스크톱 수신 처리] 스마트폰에서 보낸 지문 인증 결과(APPROVED / REJECTED) 반영
	 * @param {any} msg
	 */
	function handleIncomingCoopResult(msg) {
		if (!msg || !msg.requestId) return;
		if (activeCoopRequestId && msg.requestId === activeCoopRequestId && coopWaiting) {
			stopCoopWaitingTimer();
			if (msg.status === 'APPROVED') {
				coopDocUnlocked = true;
				coopApprovalInfo = {
					status: 'APPROVED',
					verifiedAccount: msg.verifiedAccount,
					credentialId: msg.credentialId || 'MOBILE-PASSKEY',
					verifiedAt: msg.verifiedAt || new Date().toLocaleTimeString('ko-KR')
				};
				playSoundSample('dispatch_fanfare', { boostOverride: soundBoost, forceUnmute: true });
				toast.success('🔓 스마트폰 지문 승인 완료! 데스크톱 대외비 문서 잠금이 즉시 해제되었습니다.');
			} else {
				coopDocUnlocked = false;
				coopApprovalInfo = {
					status: 'REJECTED',
					verifiedAccount: msg.verifiedAccount || '-',
					credentialId: '-',
					verifiedAt: new Date().toLocaleTimeString('ko-KR'),
					reason: msg.reason || '스마트폰에서 지문 승인을 거부했거나 계정이 일치하지 않습니다.'
				};
				playSoundSample('error_buzzer', { boostOverride: soundBoost, forceUnmute: true });
				toast.error(`🚨 원격 승인 실패: ${coopApprovalInfo.reason}`);
			}
		}
		if (incomingCoopRequest && incomingCoopRequest.requestId === msg.requestId) {
			incomingCoopRequest = null;
		}
	}

	function initBiometricCoopWs() {
		if (unsubscribeCoopWs) {
			unsubscribeCoopWs();
			unsubscribeCoopWs = null;
		}

		// 웹소켓 연결 보장 (이미 연결되어 있으면 유지, 끊어져 있으면 즉시 연결)
		websocket.init();

		unsubscribeCoopWs = websocket.addMessageListener((msg) => {
			if (!msg || !msg.type) return;

			if (msg.type === 'BIOMETRIC_COOP_REQUEST') {
				handleIncomingCoopRequest(msg);
			} else if (msg.type === 'BIOMETRIC_COOP_RESULT') {
				handleIncomingCoopResult(msg);
			} else if (msg.type === 'BIOMETRIC_COOP_CANCEL') {
				if (incomingCoopRequest && incomingCoopRequest.requestId === msg.requestId) {
					incomingCoopRequest = null;
					toast.info('데스크톱에서 지문 승인 요청을 취소했습니다.');
				}
			}
		}, 'biometric_coop');

		// 📱 모바일 기기에서 페이지 진입 시 대기 중인 본인 요청이 있는지 1회 동기화 요청
		// (소켓이 CONNECTING 상태여도 websocket.#sendQueue에 의해 연결 즉시 자동 발송됨)
		websocket.send({ type: 'BIOMETRIC_COOP_SYNC' });
	}

	function stopCoopWaitingTimer() {
		coopWaiting = false;
		coopCountdown = 0;
		if (coopTimer) {
			clearInterval(coopTimer);
			coopTimer = null;
		}
	}

	/**
	 * 💻 [데스크톱 -> 모바일] 대외비 문서 열람을 위한 원격 스마트폰 지문 승인 요청 발송
	 */
	async function requestRemoteBiometricUnlock() {
		const reqId = 'coop_' + Math.random().toString(36).substring(2, 10);
		const myDeviceId = getMyCoopDeviceId();

		activeCoopRequestId = reqId;
		handledCoopRequestId = reqId;
		incomingCoopRequest = null;

		coopDocUnlocked = false;
		coopApprovalInfo = null;
		coopWaiting = true;
		coopCountdown = 60;

		const payload = {
			type: 'BIOMETRIC_COOP_REQUEST',
			requestId: reqId,
			senderDeviceId: myDeviceId,
			senderTabId: clientTabId,
			docTitle: '[대외비] 2026년 제주공항 리무진 배차 정산 및 임원 기밀 보고서.pdf',
			targetAccount: bioAccountName,
			requestedAt: new Date().toLocaleTimeString('ko-KR')
		};

		// 단일 웹소켓 채널로 정석 발송 (CONNECTING 상태여도 #sendQueue가 100% 보장)
		websocket.send(payload);

		playSoundSample('l2_banner', { boostOverride: soundBoost, forceUnmute: true });
		toast.info(`📲 스마트폰으로 지문 승인 요청을 발송했습니다! 스마트폰 화면을 확인해 주세요.`);

		if (coopTimer) clearInterval(coopTimer);
		coopTimer = setInterval(() => {
			coopCountdown -= 1;
			if (coopCountdown <= 0) {
				stopCoopWaitingTimer();
				toast.warning('⏱️ 지문 승인 대기 시간(60초)이 만료되었습니다.');
			}
		}, 1000);
	}

	function cancelRemoteBiometricUnlock() {
		if (activeCoopRequestId) {
			websocket.send({
				type: 'BIOMETRIC_COOP_CANCEL',
				requestId: activeCoopRequestId
			});
		}
		stopCoopWaitingTimer();
		activeCoopRequestId = null;
		toast.info('원격 지문 승인 요청을 취소했습니다.');
	}

	/**
	 * 📱 [모바일 -> 데스크톱] 수신된 문서 열람 요청에 대해 스마트폰 지문을 찍어 승인 응답 전송
	 */
	async function approveIncomingCoopWithBiometrics() {
		if (!incomingCoopRequest) return;
		const req = incomingCoopRequest;

		if (typeof window === 'undefined' || !window.PublicKeyCredential) {
			toast.error('이 기기는 생체 인증(WebAuthn)을 지원하지 않습니다.');
			return;
		}

		// 만약 모바일에 이미 등록된 열쇠가 있는데, 데스크톱이 요청한 계정과 모바일 열쇠 주인이 다르면 즉시 도용 차단!
		if (registeredPasskey && registeredPasskey.ownerAccount !== req.targetAccount) {
			playSoundSample('error_buzzer', { boostOverride: soundBoost, forceUnmute: true });
			if (vibrationSupported) triggerVibration([250, 80, 250], { forceUnmute: true });
			websocket.send({
				type: 'BIOMETRIC_COOP_RESULT',
				requestId: req.requestId,
				status: 'REJECTED',
				verifiedAccount: registeredPasskey.ownerAccount,
				reason: `계정 불일치 차단! 데스크톱 요청 계정(${req.targetAccount})과 스마트폰 등록 열쇠 주인(${registeredPasskey.ownerAccount})이 다릅니다.`
			});
			incomingCoopRequest = null;
			toast.error('🚨 데스크톱 요청 계정과 스마트폰 열쇠 소유주가 달라 자동 차단했습니다!');
			return;
		}

		biometricsLoading = true;
		try {
			const challenge = new Uint8Array(32);
			window.crypto.getRandomValues(challenge);
			let verifiedCredId = 'PASSKEY-VERIFIED';

			if (registeredPasskey) {
				// 등록된 열쇠로 정밀 검증 (get)
				const allowedIdBytes = base64ToUint8Array(registeredPasskey.rawIdBase64);
				const assertion = /** @type {PublicKeyCredential | null} */ (
					await navigator.credentials.get({
						publicKey: {
							challenge,
							rpId: window.location.hostname,
							allowCredentials: [{ type: 'public-key', id: allowedIdBytes }],
							userVerification: 'required',
							timeout: 60000
						}
					})
				);
				if (assertion) {
					verifiedCredId = assertion.id;
					registeredPasskey.verifyCount += 1;
					localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(registeredPasskey));
				}
			} else {
				// 아직 1단계 등록 전인 기기에서도 즉시 테스트할 수 있도록 플랫폼 지문 확인 수행 후 자동 등록
				const userBytes = new TextEncoder().encode(req.targetAccount);
				const credential = /** @type {PublicKeyCredential | null} */ (
					await navigator.credentials.create({
						publicKey: {
							challenge,
							rp: { name: 'jeju.live Co-op Auth', id: window.location.hostname },
							user: { id: userBytes, name: req.targetAccount, displayName: req.targetAccount },
							pubKeyCredParams: [
								{ type: 'public-key', alg: -7 },
								{ type: 'public-key', alg: -257 }
							],
							authenticatorSelection: {
								authenticatorAttachment: 'platform',
								userVerification: 'required'
							},
							timeout: 60000
						}
					})
				);
				if (credential && credential.rawId) {
					verifiedCredId = credential.id;
					const saved = {
						credentialId: credential.id,
						rawIdBase64: bufferToBase64(credential.rawId),
						ownerAccount: req.targetAccount,
						registeredAt: new Date().toLocaleTimeString('ko-KR'),
						verifyCount: 1
					};
					registeredPasskey = saved;
					localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(saved));
				}
			}

			biometricsLoading = false;
			playSoundSample('task_complete', { boostOverride: soundBoost, forceUnmute: true });
			if (vibrationSupported) triggerVibration([120, 60, 180], { forceUnmute: true });

			// 데스크톱으로 승인 완료 신호 전송
			websocket.send({
				type: 'BIOMETRIC_COOP_RESULT',
				requestId: req.requestId,
				status: 'APPROVED',
				verifiedAccount: req.targetAccount,
				credentialId: verifiedCredId,
				verifiedAt: new Date().toLocaleTimeString('ko-KR')
			});

			incomingCoopRequest = null;
			toast.success('🎉 스마트폰 지문 승인 성공! 데스크톱 화면의 문서 잠금이 해제되었습니다.');
		} catch (e) {
			biometricsLoading = false;
			toast.error('지문 인증이 취소되었거나 실패했습니다.');
		}
	}

	function rejectIncomingCoop() {
		if (!incomingCoopRequest) return;
		websocket.send({
			type: 'BIOMETRIC_COOP_RESULT',
			requestId: incomingCoopRequest.requestId,
			status: 'REJECTED',
			verifiedAccount: bioAccountName,
			reason: '스마트폰 사용자가 문서 열람 승인을 직접 거부했습니다.'
		});
		incomingCoopRequest = null;
		toast.warning('데스크톱 문서 열람 요청을 거부했습니다.');
	}

	// ============================================================================
	// 11. 🏷️ Web NFC 실시간 태그 스캐너 & 라이터
	// ============================================================================
	let nfcSupported = $state(false);
	let nfcReading = $state(false);
	let nfcTagData = $state({
		serialNumber: /** @type {string | null} */ (null),
		records: /** @type {string[]} */ ([]),
		time: /** @type {string | null} */ (null)
	});
	let nfcWriteText = $state('jeju.live-BUS-701-PASS');

	function checkNfcSupport() {
		nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window;
	}

	async function startNfcScan() {
		if (!nfcSupported) {
			toast.error('이 기기/브라우저는 Web NFC를 지원하지 않습니다. (안드로이드 크롬 지원)');
			return;
		}
		try {
			const NDEFReaderClass = (/** @type {any} */ (window)).NDEFReader;
			const ndef = new NDEFReaderClass();
			await ndef.scan();
			nfcReading = true;
			toast.success('🏷️ NFC 리더가 가동되었습니다. 스마트폰 뒷면에 사원증이나 태그를 대주세요!');

			ndef.onreading = (/** @type {any} */ event) => {
				playBeepSound(1760, 0.15, 'sine');
				if (vibrationSupported) navigator.vibrate([100, 50, 100]);

				const recs = [];
				if (event.message && event.message.records) {
					for (const record of event.message.records) {
						const decoder = new TextDecoder();
						const dataText = decoder.decode(record.data);
						recs.push(`[${record.recordType || 'text'}] ${dataText}`);
					}
				}

				nfcTagData = {
					serialNumber: event.serialNumber || '태그 시리얼 확인됨',
					records: recs.length > 0 ? recs : ['(빈 레코드 또는 암호화 태그)'],
					time: new Date().toLocaleTimeString('ko-KR')
				};
				toast.success(`NFC 태그 인식 성공! (S/N: ${event.serialNumber || 'NFC-TAG'})`);
			};

			ndef.onreadingerror = () => {
				toast.error('NFC 태그를 읽을 수 없습니다. 다시 밀착해 주세요.');
			};
		} catch (e) {
			toast.error(`NFC 시작 실패: ${/** @type {any} */ (e).message}`);
			nfcReading = false;
		}
	}

	async function writeNfcTag() {
		if (!nfcSupported) {
			toast.error('Web NFC를 지원하지 않는 브라우저입니다.');
			return;
		}
		try {
			const NDEFReaderClass = (/** @type {any} */ (window)).NDEFReader;
			const ndef = new NDEFReaderClass();
			toast.info('스마트폰 뒷면에 기록할 NFC 태그를 밀착해 주세요...');
			await ndef.write(nfcWriteText);
			playBeepSound(1320, 0.2);
			if (vibrationSupported) navigator.vibrate(200);
			toast.success(`NFC 태그에 데이터 기록 완료: "${nfcWriteText}"`);
		} catch (e) {
			toast.error(`NFC 기록 실패: ${/** @type {any} */ (e).message}`);
		}
	}

	// ============================================================================
	// 12. 📶 Web Bluetooth 무선 장치 탐색기
	// ============================================================================
	let bluetoothSupported = $state(false);
	let bleDevice = $state({
		name: /** @type {string | null} */ (null),
		id: /** @type {string | null} */ (null),
		connected: false
	});

	function checkBluetoothSupport() {
		bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
	}

	async function scanBluetooth() {
		if (!bluetoothSupported) {
			toast.error('이 브라우저는 Web Bluetooth를 지원하지 않습니다.');
			return;
		}
		try {
			toast.info('주변 블루투스 장치(영수증 프린터, 차량 스캐너 등)를 검색합니다...');
			const device = await (/** @type {any} */ (navigator)).bluetooth.requestDevice({
				acceptAllDevices: true
			});
			bleDevice = {
				name: device.name || '이름 없는 블루투스 기기',
				id: device.id,
				connected: device.gatt ? device.gatt.connected : false
			};
			playBeepSound(1500, 0.15);
			if (vibrationSupported) navigator.vibrate(100);
			toast.success(`블루투스 장치 페어링 완료: ${bleDevice.name}`);
		} catch (e) {
			if ((/** @type {any} */ (e)).name !== 'NotFoundError') {
				toast.error(`블루투스 오류: ${/** @type {any} */ (e).message}`);
			}
		}
	}

	// ============================================================================
	// 13. 🔴 PWA 홈 화면 배지 (App Badging) & 💡 조도 센서 (Ambient Light)
	// ============================================================================
	let badgeCount = $state(5);
	let badgeSupported = $state(false);
	let ambientLux = $state(/** @type {number | null} */ (null));
	let ambientSupported = $state(false);

	function checkBadgingSupport() {
		badgeSupported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
	}

	function setAppBadge(count = badgeCount) {
		if (badgeSupported) {
			(/** @type {any} */ (navigator)).setAppBadge(count);
			if (vibrationSupported) navigator.vibrate(50);
			toast.success(`홈 화면 PWA 앱 아이콘에 [${count}] 배지가 설정되었습니다!`);
		} else {
			toast.error('이 브라우저는 App Badging API를 지원하지 않습니다. (PWA 홈 화면 추가 필요)');
		}
	}

	function clearAppBadge() {
		if (badgeSupported) {
			(/** @type {any} */ (navigator)).clearAppBadge();
			toast.info('홈 화면 앱 아이콘 배지가 제거되었습니다.');
		}
	}

	function initAmbientSensor() {
		if (typeof window !== 'undefined' && 'AmbientLightSensor' in window) {
			try {
				const SensorClass = (/** @type {any} */ (window)).AmbientLightSensor;
				const sensor = new SensorClass();
				sensor.onreading = () => {
					ambientLux = Math.round(sensor.illuminance);
				};
				sensor.start();
				ambientSupported = true;
			} catch (e) {
				ambientSupported = false;
			}
		}
	}

	onMount(() => {
		initSoundLabState();
		checkGpsSupport();
		checkCameraSupport();
		checkVibrationSupport();
		checkMicSupport();
		checkWakeLockSupport();
		checkBattery();
		checkShareSupport();
		checkNetworkStatus();
		checkBiometricsSupport();
		loadSavedPasskey();
		initBiometricCoopWs();
		checkNfcSupport();
		checkBluetoothSupport();
		checkBadgingSupport();
		initAmbientSensor();

		if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
			window.addEventListener('deviceorientation', handleOrientation);
		}
	});

	onDestroy(() => {
		if (unsubscribeAudioUnlock) unsubscribeAudioUnlock();
		if (unsubscribeCoopWs) unsubscribeCoopWs();
		if (delayedTestTimer) clearInterval(delayedTestTimer);
		if (coopTimer) clearInterval(coopTimer);
		if (gpsWatchId !== null && typeof navigator !== 'undefined') {
			navigator.geolocation.clearWatch(gpsWatchId);
		}
		stopCamera();
		stopMic();
		if (wakeLockSentinel) {
			wakeLockSentinel.release();
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('deviceorientation', handleOrientation);
			if ('speechSynthesis' in window) {
				window.speechSynthesis.cancel();
			}
		}
	});
</script>

<svelte:head>
	<title>모바일 하드웨어 종합 시험 센터 | jeju.live Core</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8 px-4 py-8 font-['Noto_Sans_KR','Outfit'] md:px-6 lg:px-8 pb-32">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-3 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Mobile Hardware Lab
				</span>
				<span class="text-xs font-bold text-slate-400">PWA & Web API Testbench</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				모바일 하드웨어 <span class="not-italic text-blue-600">종합 시험 센터</span>
			</h1>
			<p class="mt-1 text-xs font-medium text-slate-500">
				스마트폰 내장 물리 장비(GPS, 카메라, 스피커/TTS, 진동 모터, 마이크, 화면유지, 센서) 웹 제어 검증
			</p>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/v1/pages"
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3.5 py-2 text-xs font-black text-slate-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-slate-100"
			>
				<Icon icon="ph:arrow-left-bold" class="text-sm" />
				정적 페이지 갤러리
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 7대 하드웨어 장비 인터랙티브 테스트 그리드 -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 1] 🛰️ GPS 실시간 위치 센서 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
							<Icon icon="ph:navigation-arrow-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🛰️ GPS 위치 센서</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Geolocation API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black {gpsSupported ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
						{gpsSupported ? '기기 지원됨' : '미지원'}
					</span>
				</div>

				<!-- GPS 측정 데이터 디스플레이 -->
				<div class="mt-4 grid grid-cols-2 gap-2 text-xs">
					<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">위도 (Latitude)</span>
						<div class="mt-0.5 font-mono text-base font-black text-slate-900">
							{gpsData.latitude ?? '-'}
						</div>
					</div>
					<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">경도 (Longitude)</span>
						<div class="mt-0.5 font-mono text-base font-black text-slate-900">
							{gpsData.longitude ?? '-'}
						</div>
					</div>
					<div class="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">오차 반경</span>
						<div class="font-mono text-xs font-black text-blue-600">
							{gpsData.accuracy ? `±${gpsData.accuracy} m` : '-'}
						</div>
					</div>
					<div class="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">이동 속도</span>
						<div class="font-mono text-xs font-black text-emerald-600">
							{gpsData.speed !== null ? `${gpsData.speed} km/h` : '-'}
						</div>
					</div>
				</div>

				{#if gpsData.updatedAt}
					<div class="mt-2 text-[10px] text-right font-medium text-slate-400">
						최근 측정: {gpsData.updatedAt}
					</div>
				{/if}
			</div>

			<!-- GPS 액션 버튼 -->
			<div class="mt-5 flex gap-2">
				<button
					onclick={getCurrentLocation}
					disabled={gpsLoading}
					class="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-600 active:scale-95 disabled:opacity-50"
				>
					{gpsLoading ? '위치 측정 중...' : '현재 위치 단발 측정'}
				</button>
				<button
					onclick={toggleGpsWatch}
					class="flex-1 rounded-xl border-2 border-slate-900 py-2.5 text-xs font-black transition active:scale-95 {gpsWatching ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-900 hover:bg-slate-100'}"
				>
					{gpsWatching ? '추적 중지 (Watch ON)' : '실시간 연속 추적'}
				</button>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 2] 📷 카메라 렌즈 & 실시간 비디오 뷰파인더 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
							<Icon icon="ph:camera-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📷 카메라 & 뷰파인더</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">MediaDevices API</span>
						</div>
					</div>
					<div class="flex items-center gap-1.5">
						<a
							href="/v1/pages/camera"
							onclick={() => enterCameraFullscreen()}
							class="rounded-lg bg-purple-600 px-2 py-0.5 text-[10px] font-black text-white hover:bg-purple-700 transition flex items-center gap-1 shadow-xs"
							title="16:9 풀옵션 프로 카메라 전용 웹앱으로 이동"
						>
							<Icon icon="ph:sparkle-fill" class="text-xs text-amber-300" />
							<span>프로 카메라 스튜디오</span>
						</a>
						{#if isCameraOn && flashSupported}
							<button
								onclick={toggleFlash}
								class="rounded-lg border px-2 py-0.5 text-[10px] font-black transition {isFlashOn ? 'bg-amber-400 text-slate-900 border-amber-500' : 'bg-slate-100 text-slate-600'}"
							>
								{isFlashOn ? '🔦 플래시 ON' : '플래시 OFF'}
							</button>
						{/if}
						<span class="rounded px-2 py-0.5 text-[10px] font-black {isCameraOn ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
							{isCameraOn ? '작동 중' : '꺼짐'}
						</span>
					</div>
				</div>

				<!-- 카메라 뷰파인더 화면 (모바일에서도 넉넉하고 시원한 뷰파인더 높이 확보) -->
				<div class="relative mt-4 h-80 sm:h-96 w-full overflow-hidden rounded-xl border-2 border-slate-900 bg-slate-950 flex items-center justify-center shadow-inner">
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={videoElement}
						playsinline
						autoplay
						class="h-full w-full object-cover {isCameraOn ? 'block' : 'hidden'}"
					></video>

					<!-- 실시간 QR 스캔 타겟 오버레이 (+ 십자선 및 대형 사각 조준 프레임) -->
					{#if isCameraOn && qrScanActive}
						<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
							<!-- 🔳 대형 정사각형 타겟 프레임 (뷰파인더의 75%를 채우는 넉넉한 크기 w-64 h-64 / sm:w-72 sm:h-72) -->
							<div class="relative shrink-0 w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.35)] flex items-center justify-center">
								<!-- 4개 모서리 대형 굵은 꺽쇠 (┌ ┐ └ ┘) -->
								<div class="absolute -top-1.5 -left-1.5 w-10 h-10 border-t-[5px] border-l-[5px] border-emerald-400 rounded-tl-xl shadow-[0_0_12px_#34d399]"></div>
								<div class="absolute -top-1.5 -right-1.5 w-10 h-10 border-t-[5px] border-r-[5px] border-emerald-400 rounded-tr-xl shadow-[0_0_12px_#34d399]"></div>
								<div class="absolute -bottom-1.5 -left-1.5 w-10 h-10 border-b-[5px] border-l-[5px] border-emerald-400 rounded-bl-xl shadow-[0_0_12px_#34d399]"></div>
								<div class="absolute -bottom-1.5 -right-1.5 w-10 h-10 border-b-[5px] border-r-[5px] border-emerald-400 rounded-br-xl shadow-[0_0_12px_#34d399]"></div>

								<!-- ➕ 중앙 대형 십자선 타겟 조준 마크 (+) -->
								<div class="absolute w-12 h-1 bg-emerald-400 shadow-[0_0_6px_#34d399] rounded-full"></div>
								<div class="absolute h-12 w-1 bg-emerald-400 shadow-[0_0_6px_#34d399] rounded-full"></div>

								<!-- 🔴 중앙 조준 원형 점 -->
								<div class="absolute h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>

								<!-- ⚡ 스캐닝 레이저 가이드 바 (상하 부드러운 스캔) -->
								<div class="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_15px_#34d399] animate-pulse top-1/2 -translate-y-1/2"></div>
							</div>

							<!-- 하단 조준 안내 캡션 -->
							<span class="mt-4 rounded-full bg-black/80 px-4 py-1.5 text-xs font-black text-emerald-300 backdrop-blur-md shadow-lg border border-emerald-400/40">
								QR 코드를 대형 사각형 [+] 안에 맞춰주세요
							</span>
						</div>
					{/if}

					{#if !isCameraOn}
						<div class="flex flex-col items-center justify-center text-slate-500">
							<Icon icon="ph:camera-slash-bold" class="text-4xl opacity-30" />
							<span class="mt-2 text-xs font-bold">카메라가 꺼져 있습니다</span>
						</div>
					{/if}

					<!-- 웹페이지 자동 이동 중 안내 오버레이 -->
					{#if navigatingUrl}
						<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6 text-center">
							<Icon icon="ph:arrow-square-out-bold" class="text-5xl text-emerald-400 animate-bounce" />
							<h4 class="mt-3 text-base font-black text-white">웹페이지로 이동하는 중...</h4>
							<p class="mt-1 font-mono text-xs text-emerald-300 break-all max-w-xs">{navigatingUrl}</p>
							<span class="mt-2 text-[10px] text-slate-400">잠시 후 해당 페이지가 브라우저에 열립니다.</span>
						</div>
					{/if}

					<!-- 스냅샷 촬영 미리보기 팝업 -->
					{#if capturedPhoto}
						<div class="absolute bottom-2 right-2 h-16 w-16 overflow-hidden rounded-lg border-2 border-white shadow-lg bg-black">
							<img src={capturedPhoto} alt="Snapshot" class="h-full w-full object-cover" />
						</div>
					{/if}
				</div>

				<!-- 자동 이동 설정 토글 바 -->
				<div class="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200">
					<div class="flex items-center gap-2">
						<Icon icon="ph:rocket-launch-bold" class="text-base text-blue-600" />
						<span class="text-xs font-bold text-slate-700">웹페이지 QR 감지 시 즉시 자동 이동</span>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input type="checkbox" bind:checked={autoNavigateUrl} class="sr-only peer" />
						<div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
					</label>
				</div>

				<!-- QR 코드 인식 결과 카드 -->
				{#if lastScannedResult}
					{@const targetUrl = extractUrl(lastScannedResult)}
					<div class="mt-3 rounded-xl border-2 {targetUrl ? 'border-emerald-500 bg-emerald-50/80' : 'border-slate-300 bg-slate-50'} p-3.5 text-xs shadow-sm">
						<div class="flex items-center justify-between border-b border-slate-200/60 pb-2">
							<span class="font-black {targetUrl ? 'text-emerald-800' : 'text-slate-800'} flex items-center gap-1.5">
								<Icon icon={targetUrl ? "ph:link-bold" : "ph:qr-code-bold"} class="text-base {targetUrl ? 'text-emerald-600' : 'text-slate-600'}" />
								{targetUrl ? '🌐 웹페이지 주소 QR 인식 완료!' : '📝 일반 텍스트 QR 인식 완료'}
							</span>
							<button
								onclick={() => (lastScannedResult = null)}
								class="text-[10px] font-bold text-slate-400 hover:text-slate-600"
							>
								닫기
							</button>
						</div>

						<div class="mt-2 font-mono font-bold text-slate-900 break-all select-all bg-white p-2.5 rounded-lg border border-slate-200">
							{lastScannedResult}
						</div>

						{#if targetUrl}
							<div class="mt-3 flex gap-2">
								<a
									href={targetUrl}
									class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition"
								>
									<span>🚀 지금 해당 웹페이지로 이동하기</span>
									<Icon icon="ph:arrow-square-out-bold" class="text-sm" />
								</a>
								<a
									href={targetUrl}
									target="_blank"
									class="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
									title="새 탭으로 열기"
								>
									새 탭
								</a>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- 카메라 & QR 제어 액션 버튼 -->
			<div class="mt-4 flex flex-col gap-2">
				{#if !isCameraOn}
					<div class="flex gap-2">
						<button
							onclick={startCamera}
							class="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-purple-600 active:scale-95"
						>
							일반 카메라 켜기
						</button>
						<button
							onclick={toggleQrScan}
							class="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 flex items-center justify-center gap-1.5"
						>
							<Icon icon="ph:qr-code-bold" class="text-base" />
							<span>QR 스캐너 즉시 시작</span>
						</button>
					</div>
				{:else}
					<div class="flex gap-2">
						<button
							onclick={toggleQrScan}
							class="flex-1 rounded-xl py-2.5 text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5 {qrScanActive ? 'bg-emerald-500 text-white shadow-md' : 'border-2 border-slate-900 bg-white text-slate-900 hover:bg-slate-100'}"
						>
							<Icon icon="ph:qr-code-bold" class="text-base" />
							<span>{qrScanActive ? 'QR 스캔 중지 (Watch ON)' : '실시간 QR 스캔 시작'}</span>
						</button>
						<button
							onclick={capturePhoto}
							class="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
							title="스냅샷 찰칵"
						>
							📸 찰칵
						</button>
						<button
							onclick={switchCamera}
							class="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
							title="전면/후면 렌즈 전환"
						>
							<Icon icon="ph:arrows-clockwise-bold" class="text-base" />
						</button>
						<button
							onclick={stopCamera}
							class="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100"
						>
							끄기
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 3] 🔊 스피커 사운드 합성 (400% 증폭) & 한국어 TTS 방송 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
							<Icon icon="ph:speaker-high-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🔊 스피커 앰프 증폭 & TTS 방송</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">400% Gain Boost + Autoplay Unlocker</span>
						</div>
					</div>
					<!-- 첫 터치 잠금 해제 실시간 상태 배지 -->
					<button
						onclick={() => {
							unlockAudioNow();
							toast.success('오디오 · TTS · 진동 잠금이 수동 개통되었습니다!');
						}}
						class="rounded-lg px-2.5 py-1 text-[10px] font-black transition flex items-center gap-1 {audioUnlocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'}"
						title="첫 터치 시 자동 개통됩니다"
					>
						<Icon icon={audioUnlocked ? 'ph:lock-key-open-fill' : 'ph:lock-key-fill'} class="text-xs" />
						<span>{audioUnlocked ? '개통 완료 (무효화 무력화됨)' : '잠김 (아무 곳이나 터치)'}</span>
					</button>
				</div>

				<!-- 🎚️ 1. 하드웨어 사운드 증폭 배율 (100% ~ 400%) 컨트롤 박스 -->
				<div class="mt-3.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-black text-slate-800 flex items-center gap-1">
							<Icon icon="ph:Sliders-horizontal-bold" class="text-amber-600" />
							사운드 앰프 증폭 배율 (Gain Boost)
						</span>
						<span class="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-amber-300">
							{Math.round(soundBoost * 100)}% ({soundBoost.toFixed(1)}x)
						</span>
					</div>

					<input
						type="range"
						min="0.5"
						max="4.0"
						step="0.1"
						value={soundBoost}
						oninput={(e) => updateSoundBoost(parseFloat(/** @type {HTMLInputElement} */ (e.currentTarget).value))}
						class="w-full accent-amber-600 cursor-pointer h-2 rounded-lg bg-amber-200"
					/>

					<!-- 원터치 증폭 프리셋 버튼 -->
					<div class="grid grid-cols-4 gap-1.5">
						{#each [
							{ val: 1.0, label: '100% 기본' },
							{ val: 2.0, label: '200% 2배' },
							{ val: 3.0, label: '300% 현장' },
							{ val: 4.0, label: '400% MAX' }
						] as preset}
							<button
								type="button"
								onclick={() => {
									updateSoundBoost(preset.val);
									playBeepSound(1046, 0.12);
								}}
								class="rounded-lg py-1.5 text-[10px] font-black transition {Math.abs(soundBoost - preset.val) < 0.05 ? 'bg-slate-900 text-amber-300 shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}"
							>
								{preset.label}
							</button>
						{/each}
					</div>

					<!-- DSP 음질 보호 & 소음 관통 옵션 토글 -->
					<div class="grid grid-cols-2 gap-1.5 pt-1">
						<button
							type="button"
							onclick={toggleCompressor}
							class="rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition flex items-center justify-between {compressorOn ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}"
						>
							<span>🛡️ 리미터(찢어짐방지)</span>
							<span>{compressorOn ? 'ON' : 'OFF'}</span>
						</button>
						<button
							type="button"
							onclick={toggleClarityFilter}
							class="rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition flex items-center justify-between {clarityFilterOn ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}"
						>
							<span>📡 2.4kHz 소음관통</span>
							<span>{clarityFilterOn ? 'ON' : 'OFF'}</span>
						</button>
					</div>
				</div>

				<!-- 🎹 2. 사운드 샘플 뱅크 (11종 원터치 비교 청취) -->
				<div class="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-black text-slate-800 flex items-center gap-1">
							<Icon icon="ph:music-notes-fill" class="text-amber-600" />
							사운드 샘플 뱅크 (클릭 시 현재 증폭 배율로 즉시 재생)
						</span>
						<span class="text-[10px] font-bold text-slate-400">총 {soundSamples.length}종</span>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
						{#each soundSamples as sample}
							<button
								type="button"
								onclick={() => triggerSample(sample)}
								class="rounded-xl border px-2.5 py-2 text-left transition active:scale-95 flex flex-col justify-between {activeSampleId === sample.id ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-amber-400 hover:bg-amber-50/40'}"
							>
								<div class="text-[11px] font-black leading-tight truncate">{sample.label}</div>
								<div class="mt-0.5 text-[9px] font-medium truncate {activeSampleId === sample.id ? 'text-amber-300' : 'text-slate-400'}">
									{sample.desc}
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- 🗣️ 3. 한국어 TTS 안내 방송 & 문구 샘플 프리셋 -->
				<div class="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
					<div class="flex items-center justify-between">
						<label for="tts-input" class="block text-[11px] font-black text-slate-700">
							🗣️ 한국어 안내 음성 방송 (TTS):
						</label>
						<button
							type="button"
							onclick={() => (ttsPreChime = !ttsPreChime)}
							class="rounded-md px-2 py-0.5 text-[10px] font-black transition {ttsPreChime ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}"
						>
							{ttsPreChime ? '🔔 선행 앰프차임벨 ON' : '선행 차임벨 OFF'}
						</button>
					</div>

					<!-- TTS 문구 샘플 원터치 프리셋 -->
					<div class="grid grid-cols-4 gap-1">
						{#each ttsPresets as preset}
							<button
								type="button"
								onclick={() => {
									ttsText = preset.text;
									speakText();
								}}
								class="rounded-lg border border-indigo-200 bg-indigo-50/70 py-1.5 px-1 text-[10px] font-black text-indigo-800 hover:bg-indigo-100 active:scale-95 transition truncate"
								title={preset.text}
							>
								{preset.label}
							</button>
						{/each}
					</div>

					<input
						id="tts-input"
						type="text"
						bind:value={ttsText}
						placeholder="스피커로 방송할 문구를 입력하세요..."
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
					/>

					<!-- TTS 음높이(Pitch) & 속도(Rate) 미세 튜닝 -->
					<div class="grid grid-cols-2 gap-3 pt-1 text-[10px] font-bold text-slate-600">
						<div>
							<div class="flex justify-between">
								<span>음높이(Pitch)</span>
								<span class="font-mono font-black text-slate-900">{ttsPitch.toFixed(2)}</span>
							</div>
							<input
								type="range"
								min="0.7"
								max="1.4"
								step="0.02"
								bind:value={ttsPitch}
								class="w-full accent-indigo-600 cursor-pointer h-1.5 mt-1"
							/>
						</div>
						<div>
							<div class="flex justify-between">
								<span>말하기 속도(Rate)</span>
								<span class="font-mono font-black text-slate-900">{ttsRate.toFixed(2)}</span>
							</div>
							<input
								type="range"
								min="0.7"
								max="1.4"
								step="0.02"
								bind:value={ttsRate}
								class="w-full accent-indigo-600 cursor-pointer h-1.5 mt-1"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- 오디오 및 TTS 실행 버튼들 -->
			<div class="mt-4 flex flex-col gap-2">
				<button
					onclick={speakText}
					disabled={isSpeaking}
					class="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
				>
					<Icon icon="ph:megaphone-simple-fill" class="text-base" />
					<span>{isSpeaking ? '음성 방송 출력 중...' : '🗣️ 입력한 문구로 한국어 음성 방송 실행 (TTS)'}</span>
				</button>

				<!-- ⏱️ 3초 뒤 무터치(웹소켓 시뮬레이션) 자동 발사 검증 버튼 -->
				<button
					onclick={startDelayedNoTouchTest}
					disabled={delayedTestCountdown > 0}
					class="w-full rounded-xl border-2 border-slate-900 bg-amber-300 py-2.5 text-xs font-black text-slate-950 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-amber-400 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-1.5"
				>
					<Icon icon="ph:timer-fill" class="text-base" />
					<span>
						{delayedTestCountdown > 0
							? `손을 떼세요! ${delayedTestCountdown}초 뒤 무터치 자동 발사...`
							: '⏱️ 3초 뒤 무터치 자동 발사 테스트 (웹소켓 시뮬레이션)'}
					</span>
				</button>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 4] 📳 진동 모터 (Vibration API & 강도 증폭) -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
							<Icon icon="ph:vibrate-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📳 진동 모터 & 지속시간 증폭</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Vibration API (Android/PWA)</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black {vibrationSupported ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
						{vibrationSupported ? '기기 지원됨' : '미지원 (iOS제외)'}
					</span>
				</div>

				<p class="mt-3 text-xs leading-relaxed text-slate-500 font-medium">
					첫 터치 시 1ms 신호로 진동 잠금이 자동 해제되며, 진동 시간 배율을 높이면 모터가 최대 회전수(RPM)에 도달해 체감 진동이 강력해집니다.
				</p>

				<!-- 📳 진동 증폭 배율 (100% ~ 300%) 컨트롤 -->
				<div class="mt-3.5 rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-black text-slate-800 flex items-center gap-1">
							<Icon icon="ph:wave-sine-bold" class="text-rose-600" />
							진동 모터 지속시간 증폭 (Pulse Boost)
						</span>
						<span class="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-rose-300">
							{Math.round(vibrationBoost * 100)}% ({vibrationBoost.toFixed(1)}x)
						</span>
					</div>

					<input
						type="range"
						min="0.5"
						max="3.0"
						step="0.1"
						value={vibrationBoost}
						oninput={(e) => updateVibrationBoost(parseFloat(/** @type {HTMLInputElement} */ (e.currentTarget).value))}
						class="w-full accent-rose-600 cursor-pointer h-2 rounded-lg bg-rose-200"
					/>

					<div class="grid grid-cols-4 gap-1.5">
						{#each [
							{ val: 1.0, label: '100% 기본' },
							{ val: 1.5, label: '150% 표준' },
							{ val: 2.0, label: '200% 강하게' },
							{ val: 3.0, label: '300% MAX' }
						] as preset}
							<button
								type="button"
								onclick={() => {
									updateVibrationBoost(preset.val);
									triggerVibrate(120, `${Math.round(preset.val * 100)}% 진동`);
								}}
								class="rounded-lg py-1.5 text-[10px] font-black transition {Math.abs(vibrationBoost - preset.val) < 0.05 ? 'bg-slate-900 text-rose-300 shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}"
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- 진동 패턴 버튼 목록 -->
			<div class="mt-4 grid grid-cols-3 gap-2">
				<button
					onclick={() => triggerVibrate(150, '단일 진동')}
					class="rounded-xl border-2 border-slate-900 bg-white py-3 text-xs font-black text-slate-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-slate-100 active:scale-95"
				>
					짧은 진동
				</button>
				<button
					onclick={() => triggerVibrate([200, 90, 200, 90, 300], '경고 진동')}
					class="rounded-xl border-2 border-slate-900 bg-amber-50 py-3 text-xs font-black text-amber-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-amber-100 active:scale-95"
				>
					경고 3연속
				</button>
				<button
					onclick={() => triggerVibrate([100, 80, 100, 80, 100, 220, 300, 80, 300, 80, 300, 220, 100, 80, 100], 'SOS 진동')}
					class="rounded-xl border-2 border-slate-900 bg-rose-50 py-3 text-xs font-black text-rose-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-rose-100 active:scale-95"
				>
					SOS 모스진동
				</button>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 5] 🎙️ 마이크 센서 & 실시간 볼륨 게이지 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
							<Icon icon="ph:microphone-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🎙️ 마이크 센서 & 볼륨 미터</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Web Audio Analyser</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black {isMicOn ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
						{isMicOn ? '감지 중' : '대기 중'}
					</span>
				</div>

				<!-- 실시간 볼륨 레벨 바 -->
				<div class="mt-4 space-y-2">
					<div class="flex items-center justify-between text-xs font-bold">
						<span class="text-slate-500">실시간 음성 입력 레벨:</span>
						<span class="font-mono text-emerald-600">{micVolumeLevel}%</span>
					</div>
					<div class="h-4 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
						<div
							class="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 transition-all duration-75"
							style="width: {micVolumeLevel}%"
						></div>
					</div>
				</div>
			</div>

			<div class="mt-5">
				<button
					onclick={toggleMic}
					class="w-full rounded-xl py-2.5 text-xs font-black transition active:scale-95 {isMicOn ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-900 text-white hover:bg-emerald-600'}"
				>
					{isMicOn ? '마이크 끄기' : '마이크 켜기 (실시간 음성 테스트)'}
				</button>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 6] 📱 화면 꺼짐 방지 (Screen Wake Lock) -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
							<Icon icon="ph:device-mobile-camera-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📱 화면 꺼짐 방지</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Screen Wake Lock API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black {wakeLockSupported ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
						{wakeLockSupported ? '기기 지원됨' : '미지원'}
					</span>
				</div>

				<p class="mt-3 text-xs leading-relaxed text-slate-500 font-medium">
					운행/내비게이션 모드에서 화면이 30초 뒤 저절로 꺼지는 절전 모드를 막고 상시 켜짐 상태를 유지합니다.
				</p>
			</div>

			<div class="mt-5">
				<button
					onclick={toggleWakeLock}
					class="w-full rounded-xl py-2.5 text-xs font-black transition active:scale-95 {isWakeLocked ? 'bg-emerald-600 text-white shadow-md' : 'border-2 border-slate-900 bg-white text-slate-900 hover:bg-slate-100'}"
				>
					{isWakeLocked ? '💡 화면 상시 켜짐 활성 중 (해제하기)' : '화면 꺼짐 방지 시작 (Wake Lock ON)'}
				</button>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 7] 🔋 배터리 & 기울기 자이로 센서 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-2">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
							<Icon icon="ph:compass-tool-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🔋 배터리 잔량 & 3축 자이로 기울기 센서</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Battery & DeviceOrientation API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
						하드웨어 센서
					</span>
				</div>

				<div class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 text-xs">
					<!-- 배터리 잔량 -->
					<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">배터리 상태</span>
						<div class="mt-1 flex items-center gap-2">
							<Icon icon={batteryInfo.charging ? "ph:battery-charging-fill" : "ph:battery-high-fill"} class="text-xl text-emerald-600" />
							<span class="font-mono text-base font-black text-slate-900">
								{batteryInfo.level !== null ? `${batteryInfo.level}%` : '감지 중...'}
							</span>
						</div>
						<span class="text-[10px] text-slate-400">
							{batteryInfo.charging ? '⚡ 충전 중' : '배터리 사용 중'}
						</span>
					</div>

					<!-- 자이로 Alpha (방위각) -->
					<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">방위각 (Alpha, Z축)</span>
						<div class="mt-1 font-mono text-base font-black text-blue-600">
							{orientationData.alpha !== null ? `${orientationData.alpha}°` : '-'}
						</div>
						<span class="text-[10px] text-slate-400">나침반 회전 각도</span>
					</div>

					<!-- 자이로 Beta (앞뒤 기울기) -->
					<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">앞뒤 기울기 (Beta, X축)</span>
						<div class="mt-1 font-mono text-base font-black text-purple-600">
							{orientationData.beta !== null ? `${orientationData.beta}°` : '-'}
						</div>
						<span class="text-[10px] text-slate-400">단말기 상하 틸트</span>
					</div>

					<!-- 자이로 Gamma (좌우 기울기) -->
					<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
						<span class="text-[10px] font-bold text-slate-400 uppercase">좌우 기울기 (Gamma, Y축)</span>
						<div class="mt-1 font-mono text-base font-black text-amber-600">
							{orientationData.gamma !== null ? `${orientationData.gamma}°` : '-'}
						</div>
						<span class="text-[10px] text-slate-400">단말기 좌우 롤링</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 8] 📞 스마트폰 원터치 전화(Call) & 💬 문자(SMS) 자동 템플릿 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-1">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
							<Icon icon="ph:phone-call-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📞 전화(Call) & 💬 문자(SMS)</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">tel: & sms: URL Scheme</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
						통신 표준
					</span>
				</div>

				<!-- 전화 걸기 섹션 -->
				<div class="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
					<span class="text-[10px] font-bold text-slate-400 uppercase">원터치 전화 걸기</span>
					<div class="flex gap-2">
						<input
							type="tel"
							bind:value={telNumber}
							class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none"
							placeholder="전화번호 입력"
						/>
						<button
							onclick={() => makePhoneCall(telNumber)}
							class="rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-black text-white hover:bg-teal-700 active:scale-95 transition shadow-sm flex items-center gap-1 shrink-0"
						>
							<Icon icon="ph:phone-fill" class="text-sm" />
							<span>전화 걸기</span>
						</button>
					</div>
					<div class="flex flex-wrap gap-1 pt-1">
						<button onclick={() => makePhoneCall('064-740-6000')} class="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-100">
							관제실 (064-740-6000)
						</button>
						<button onclick={() => makePhoneCall('112')} class="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50">
							비상 112
						</button>
					</div>
				</div>

				<!-- 문자 자동 완성 발송 섹션 -->
				<div class="mt-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
					<span class="text-[10px] font-bold text-slate-400 uppercase">문자(SMS) 자동 완성 발송</span>
					<input
						type="tel"
						bind:value={smsNumber}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none"
						placeholder="수신 전화번호"
					/>
					<textarea
						bind:value={smsMessage}
						rows="2"
						class="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none resize-none"
						placeholder="발송할 문자 내용"
					></textarea>
					<button
						onclick={() => sendSms(smsNumber, smsMessage)}
						class="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-teal-600 active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5"
					>
						<Icon icon="ph:chat-teardrop-dots-fill" class="text-sm text-teal-400" />
						<span>문자 앱으로 본문 자동 완성 전달</span>
					</button>
				</div>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 9] 📤 스마트폰 시스템 통합 공유 & 📋 클립보드 원터치 제어 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-1">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
							<Icon icon="ph:share-network-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📤 시스템 공유 & 📋 클립보드</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Web Share & Clipboard API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
						OS 네이티브
					</span>
				</div>

				<!-- 시스템 공유(카톡, 문자 등) 섹션 -->
				<div class="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
					<span class="text-[10px] font-bold text-slate-400 uppercase">스마트폰 공유 시트 호출</span>
					<input
						type="text"
						bind:value={shareTitle}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-sky-500 focus:outline-none"
						placeholder="공유 제목"
					/>
					<textarea
						bind:value={shareText}
						rows="2"
						class="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-sky-500 focus:outline-none resize-none"
						placeholder="공유 내용"
					></textarea>
					<button
						onclick={triggerWebShare}
						class="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-black text-white hover:bg-sky-700 active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5"
					>
						<Icon icon="ph:share-fat-fill" class="text-sm" />
						<span>스마트폰 공유 시트 열기 (카톡/문자)</span>
					</button>
				</div>

				<!-- 클립보드 복사 섹션 -->
				<div class="mt-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
					<span class="text-[10px] font-bold text-slate-400 uppercase">원터치 클립보드 복사</span>
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={clipboardCopyText}
							class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-sky-500 focus:outline-none"
						/>
						<button
							onclick={() => copyToClipboard(clipboardCopyText)}
							class="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-white hover:bg-sky-600 active:scale-95 transition shadow-sm flex items-center gap-1 shrink-0"
						>
							<Icon icon="ph:copy-fill" class="text-sm text-sky-400" />
							<span>복사</span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 10] 🌐 네트워크 통신망 감지 & 🔐 생체 인증(지문/Face ID) 지원 판별 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-2">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
							<Icon icon="ph:fingerprint-simple-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🌐 통신망 품질 감지 & 🔐 생체 인증 (지문/Face ID)</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Network Information & WebAuthn API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200">
						보안 및 인프라
					</span>
				</div>

				<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
					<!-- 네트워크 상태 -->
					<div class="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-bold text-slate-400 uppercase">네트워크 연결 상태</span>
							<span class="flex items-center gap-1 font-bold {netInfo.online ? 'text-emerald-600' : 'text-rose-600'}">
								<span class="h-2 w-2 rounded-full {netInfo.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
								{netInfo.online ? '정상 온라인' : '오프라인 단절'}
							</span>
						</div>
						<div class="grid grid-cols-2 gap-2 pt-1 font-mono">
							<div class="rounded-lg bg-white p-2 border border-slate-200">
								<span class="text-[9px] text-slate-400 block">망 유형</span>
								<span class="font-black text-slate-900 text-sm uppercase">{netInfo.type}</span>
							</div>
							<div class="rounded-lg bg-white p-2 border border-slate-200">
								<span class="text-[9px] text-slate-400 block">예상 대역폭</span>
								<span class="font-black text-blue-600 text-sm">{netInfo.downlink ? `${netInfo.downlink} Mbps` : '측정 중'}</span>
							</div>
						</div>
					</div>

					<!-- 생체 인증 2단계 (1단계 계정 열쇠 등록 create -> 2단계 계정+기기 검증 get) -->
					<div class="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-bold text-slate-400 uppercase">보안 인증 하드웨어 (2단계 Passkey)</span>
							<span class="rounded px-2 py-0.5 text-[10px] font-black {biometricsSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
								{biometricsSupported ? '지문/패턴 센서 감지됨' : '미지원/단말 없음'}
							</span>
						</div>

						<!-- 테스트할 로그인 계정 선택 (김기사 vs 박기사 타인 계정 도용 시뮬레이션) -->
						<div class="rounded-lg bg-white p-2.5 border border-slate-200 space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-[10px] font-black text-slate-600">👤 현재 테스트 중인 계정 선택:</span>
								<span class="font-mono text-[10px] font-black text-violet-700">{bioAccountName}</span>
							</div>
							<div class="grid grid-cols-2 gap-1.5">
								<button
									type="button"
									onclick={() => (bioAccountName = 'driver_kim (김기사)')}
									class="rounded-lg py-1.5 px-2 text-[10px] font-black transition {bioAccountName.includes('kim') ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
								>
									👤 김기사 (본인 계정)
								</button>
								<button
									type="button"
									onclick={() => (bioAccountName = 'driver_park (박기사-타인)')}
									class="rounded-lg py-1.5 px-2 text-[10px] font-black transition {bioAccountName.includes('park') ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
								>
									🕵️ 박기사 (타인 계정 테스트)
								</button>
							</div>
						</div>

						<!-- 현재 등록된 열쇠(Credential) 상태 표시 -->
						{#if registeredPasskey}
							<div class="rounded-lg bg-violet-50/80 p-2.5 border border-violet-200 flex items-center justify-between text-[11px]">
								<div class="space-y-0.5">
									<div class="font-black text-violet-900 flex items-center gap-1">
										<Icon icon="ph:key-fill" class="text-violet-600" />
										<span>등록된 열쇠 주인: {registeredPasskey.ownerAccount}</span>
									</div>
									<div class="font-mono text-[10px] text-violet-600">
										열쇠ID: {registeredPasskey.credentialId.substring(0, 16)}... (검증 {registeredPasskey.verifyCount}회)
									</div>
								</div>
								<button
									type="button"
									onclick={clearSavedPasskey}
									class="rounded-lg bg-white border border-violet-200 px-2 py-1 text-[10px] font-black text-slate-500 hover:text-rose-600 hover:border-rose-300 transition"
								>
									초기화
								</button>
							</div>
						{:else}
							<div class="rounded-lg bg-white p-2.5 border border-dashed border-slate-300 text-[11px] font-bold text-slate-400 text-center">
								아직 등록된 지문 열쇠가 없습니다. 아래 [1단계 등록]을 먼저 눌러주세요.
							</div>
						{/if}

						<!-- 1단계(등록 create) & 2단계(검증 get) 액션 버튼 -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							<button
								onclick={registerBiometricKey}
								disabled={biometricsLoading}
								class="rounded-xl border-2 border-violet-600 bg-white py-2.5 px-3 text-xs font-black text-violet-700 hover:bg-violet-50 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
							>
								<Icon icon="ph:key-bold" class="text-base" />
								<span>① 1단계: 현재 계정에 지문 등록</span>
							</button>
							<button
								onclick={verifyBiometricKey}
								disabled={biometricsLoading}
								class="rounded-xl bg-violet-600 py-2.5 px-3 text-xs font-black text-white hover:bg-violet-700 active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
							>
								<Icon icon="ph:fingerprint-simple-bold" class="text-base text-violet-200" />
								<span>② 2단계: 지문 + 계정주인 검증</span>
							</button>
						</div>

						{#if lastBioResult}
							<div class="rounded-lg p-2.5 text-[11px] font-black border flex items-start gap-1.5 {lastBioStatus === 'error' ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}">
								<Icon icon={lastBioStatus === 'error' ? 'ph:warning-octagon-fill' : 'ph:check-circle-fill'} class="text-base shrink-0 mt-0.5 {lastBioStatus === 'error' ? 'text-rose-600' : 'text-emerald-600'}" />
								<span class="leading-relaxed">{lastBioResult}</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- =============================================================== -->
				<!-- 💻 데스크톱 ↔ 📱 모바일 실시간 원격 지문 공조 (대외비 문서 열람 금고) -->
				<!-- =============================================================== -->
				<div class="mt-4 rounded-2xl border-2 border-indigo-900 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-lg space-y-3">
					<div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
						<div class="flex items-center gap-2">
							<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
								<Icon icon="ph:devices-bold" class="text-lg" />
							</span>
							<div>
								<h4 class="text-xs font-black text-white flex items-center gap-1.5">
									<span>💻 데스크톱 ↔ 📱 스마트폰 실시간 지문 공조 (대외비 문서 금고)</span>
								</h4>
								<p class="text-[10px] text-indigo-200/80">
									데스크톱에서 문서 열람을 요청하면 웹소켓(/ws)을 통해 스마트폰에서 알림음과 함께 지문 승인 창이 즉시 열립니다.
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => window.location.reload()}
								class="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-black text-indigo-100 hover:bg-white/20 active:scale-95 transition flex items-center gap-1"
								title="주소창이 없는 PWA 앱 환경에서 최신 코드를 즉시 반영합니다"
							>
								<Icon icon="ph:arrows-clockwise-bold" class="text-xs" />
								<span>PWA 새로고침</span>
							</button>
							<span class="rounded-full px-2.5 py-0.5 text-[10px] font-black {coopDocUnlocked ? 'bg-emerald-400 text-slate-950' : coopWaiting ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'}">
								{coopDocUnlocked ? '🔓 지문 승인 완료 (열람 허가됨)' : coopWaiting ? `⏳ 스마트폰 지문 대기 중 (${coopCountdown}초)` : '🔒 1급 대외비 잠김'}
							</span>
						</div>
					</div>

					<!-- 대외비 문서 미리보기 박스 (잠김 vs 해제) -->
					<div class="rounded-xl border {coopDocUnlocked ? 'border-emerald-400/60 bg-emerald-950/40' : 'border-white/15 bg-black/40'} p-3.5 transition-all">
						<div class="flex items-center justify-between text-xs font-black">
							<span class="flex items-center gap-1.5 text-amber-300">
								<Icon icon={coopDocUnlocked ? 'ph:file-lock-fill' : 'ph:lock-key-fill'} class="text-base" />
								<span>[대외비] 2026년 제주공항 리무진 배차 정산 및 임원 기밀 보고서.pdf</span>
							</span>
							{#if coopDocUnlocked}
								<button
									type="button"
									onclick={() => {
										coopDocUnlocked = false;
										coopApprovalInfo = null;
									}}
									class="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-white/20"
								>
									다시 잠그기
								</button>
							{/if}
						</div>

						{#if coopDocUnlocked && coopApprovalInfo}
							<!-- 🔓 잠금 해제된 대외비 문서 본문 -->
							<div class="mt-3 rounded-lg bg-white p-3 text-slate-900 space-y-2 shadow-inner">
								<div class="flex items-center justify-between border-b border-slate-200 pb-1.5 text-[11px] font-black text-emerald-700">
									<span>✅ 스마트폰 생체 인증 전자서명 검증 통과</span>
									<span class="font-mono text-[10px]">{coopApprovalInfo.verifiedAt}</span>
								</div>
								<p class="text-xs font-bold leading-relaxed text-slate-800">
									1. 금월 제주공항 노선(701~705번) 총 운송 수입 정산액: <span class="text-indigo-700 font-black">₩482,900,000</span><br />
									2. 우수 무사고 승무원 특별 성과급 지급 승인 코드: <span class="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-slate-900 font-black">JEJU-VIP-2026-PASS</span><br />
									3. 승인 계정: <span class="font-mono text-violet-700">{coopApprovalInfo.verifiedAccount}</span> (열쇠: {coopApprovalInfo.credentialId.substring(0, 14)}...)
								</p>
							</div>
						{:else}
							<!-- 🔒 잠긴 상태 (블러 처리 및 대기/거부 상태 표시) -->
							<div class="mt-2.5 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-slate-950/60 py-5 px-4 text-center">
								{#if coopWaiting}
									<Icon icon="ph:device-mobile-speaker-fill" class="text-3xl text-amber-300 animate-bounce" />
									<div class="mt-2 text-xs font-black text-amber-200">
										📱 지금 스마트폰 화면에 뜬 [지문 승인] 버튼을 눌러 손가락을 대주세요! ({coopCountdown}초)
									</div>
									<p class="mt-1 text-[10px] text-slate-400">
										스마트폰과 데스크톱이 모두 이 페이지(또는 시스템)에 접속되어 있으면 웹소켓으로 0.1초 만에 연동됩니다.
									</p>
									<div class="mt-3 flex gap-2">
										<button
											type="button"
											onclick={() => {
												incomingCoopRequest = {
													requestId: activeCoopRequestId || 'local_test',
													docTitle: '[대외비] 2026년 제주공항 리무진 배차 정산 및 임원 기밀 보고서.pdf',
													targetAccount: bioAccountName,
													requestedAt: new Date().toLocaleTimeString('ko-KR'),
													senderTabId: 'preview'
												};
											}}
											class="rounded-lg bg-indigo-500/40 border border-indigo-400/50 px-3 py-1.5 text-[10px] font-black text-indigo-100 hover:bg-indigo-500/60"
										>
											📱 (단독 기기 테스트용) 모바일 승인 팝업 이 화면에 띄우기
										</button>
										<button
											type="button"
											onclick={cancelRemoteBiometricUnlock}
											class="rounded-lg bg-rose-500/30 border border-rose-400/40 px-3 py-1.5 text-[10px] font-black text-rose-200 hover:bg-rose-500/50"
										>
											요청 취소
										</button>
									</div>
								{:else}
									<Icon icon="ph:shield-lock-fill" class="text-3xl text-slate-400" />
									<div class="mt-1.5 text-xs font-bold text-slate-300">
										이 문서는 1급 대외비입니다. 열람하려면 스마트폰 지문 승인이 필요합니다.
									</div>
									{#if coopApprovalInfo && coopApprovalInfo.status === 'REJECTED'}
										<div class="mt-2 rounded-lg bg-rose-500/20 border border-rose-400/50 px-3 py-1.5 text-[11px] font-black text-rose-200">
											🚨 {coopApprovalInfo.reason}
										</div>
									{/if}
									<button
										type="button"
										onclick={requestRemoteBiometricUnlock}
										class="mt-3 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-amber-300 active:scale-95 transition flex items-center gap-1.5"
									>
										<Icon icon="ph:paper-plane-tilt-fill" class="text-base" />
										<span>📲 내 스마트폰으로 지문 승인 요청 보내기 ('{bioAccountName}')</span>
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- 📱 [모바일 수신 전용 모달] 데스크톱에서 지문 승인 요청이 날아왔을 때 스마트폰 화면에 즉시 뜨는 팝업 -->
		{#if incomingCoopRequest}
			<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
				<div class="w-full max-w-md rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
					<div class="flex items-center justify-between border-b border-slate-100 pb-3">
						<div class="flex items-center gap-2.5">
							<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md">
								<Icon icon="ph:fingerprint-bold" class="text-2xl animate-pulse" />
							</div>
							<div>
								<span class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
									💻 데스크톱 원격 공조 요청
								</span>
								<h3 class="mt-0.5 text-base font-black text-slate-900">중요 문서 열람 지문 승인</h3>
							</div>
						</div>
						<span class="font-mono text-[10px] font-bold text-slate-400">{incomingCoopRequest.requestedAt}</span>
					</div>

					<div class="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-2 text-xs">
						<div class="flex items-start justify-between gap-2">
							<span class="text-slate-400 font-bold shrink-0">열람 요청 문서:</span>
							<span class="font-black text-slate-900 text-right">{incomingCoopRequest.docTitle}</span>
						</div>
						<div class="flex items-center justify-between border-t border-slate-200/70 pt-2">
							<span class="text-slate-400 font-bold">요청 계정:</span>
							<span class="font-mono font-black text-violet-700">{incomingCoopRequest.targetAccount}</span>
						</div>
						{#if registeredPasskey}
							<div class="flex items-center justify-between border-t border-slate-200/70 pt-2">
								<span class="text-slate-400 font-bold">내 폰 등록 열쇠 주인:</span>
								<span class="font-mono font-black {registeredPasskey.ownerAccount === incomingCoopRequest.targetAccount ? 'text-emerald-600' : 'text-rose-600'}">
									{registeredPasskey.ownerAccount}
								</span>
							</div>
						{/if}
					</div>

					<p class="text-xs font-bold text-slate-600 text-center leading-relaxed">
						본인이 데스크톱에서 요청한 작업이 맞다면 아래 버튼을 눌러<br />
						<span class="text-violet-700 font-black">스마트폰 지문(또는 Face ID/패턴)</span>을 스캔해 주세요.
					</p>

					<div class="flex flex-col gap-2 pt-1">
						<button
							type="button"
							onclick={approveIncomingCoopWithBiometrics}
							disabled={biometricsLoading}
							class="w-full rounded-2xl bg-violet-600 py-3.5 text-sm font-black text-white shadow-lg hover:bg-violet-700 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
						>
							<Icon icon="ph:fingerprint-simple-bold" class="text-xl" />
							<span>{biometricsLoading ? '지문 확인 중...' : '🖐️ 지금 지문 찍어 데스크톱 문서 잠금 해제'}</span>
						</button>
						<button
							type="button"
							onclick={rejectIncomingCoop}
							class="w-full rounded-2xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition"
						>
							❌ 내가 요청한 게 아님 (열람 거부 및 차단)
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 11] 🏷️ Web NFC 실시간 태그 스캐너 & 라이터 (사원증 / 카드키) -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-2">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
							<Icon icon="ph:contactless-payment-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🏷️ Web NFC 태그 스캔 & 라이터</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">NDEFReader API (Android Chrome)</span>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<span class="rounded px-2 py-0.5 text-[10px] font-black {nfcSupported ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500'}">
							{nfcSupported ? (nfcReading ? '스캔 중' : 'NFC 지원 기기') : '미지원 환경'}
						</span>
					</div>
				</div>

				<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
					<!-- NFC 스캔 & 태그 정보 -->
					<div class="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-bold text-slate-400 uppercase">사원증 / 차량 카드 스캔</span>
							<button
								onclick={startNfcScan}
								class="btn btn-xs rounded-xl bg-orange-600 text-white font-black hover:bg-orange-700 active:scale-95 shadow-sm px-3"
							>
								{nfcReading ? '스캐너 가동 중...' : '🏷️ NFC 태그 스캔 시작'}
							</button>
						</div>

						<div class="rounded-lg bg-white p-3 border border-slate-200 space-y-1.5 font-mono">
							<div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
								<span class="text-[10px] text-slate-400">태그 고유 ID (S/N)</span>
								<span class="font-black text-orange-700 text-xs">{nfcTagData.serialNumber || '태그 대기 중'}</span>
							</div>
							<div class="pt-1">
								<span class="text-[10px] text-slate-400 block mb-1">인식된 레코드 데이터:</span>
								{#if nfcTagData.records.length > 0}
									{#each nfcTagData.records as rec}
										<div class="text-[11px] font-bold text-slate-800 break-all bg-orange-50/60 p-1.5 rounded border border-orange-100">
											{rec}
										</div>
									{/each}
								{:else}
									<span class="text-[11px] text-slate-400 italic">스마트폰 뒷면에 카드를 밀착하면 내용이 표시됩니다.</span>
								{/if}
							</div>
							{#if nfcTagData.time}
								<div class="text-[9px] text-right text-slate-400 pt-1">최근 인식: {nfcTagData.time}</div>
							{/if}
						</div>
					</div>

					<!-- NFC 태그 쓰기(Write) -->
					<div class="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
						<span class="text-[10px] font-bold text-slate-400 uppercase">NFC 태그에 데이터 기록하기</span>
						<input
							type="text"
							bind:value={nfcWriteText}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
							placeholder="태그에 쓸 텍스트/URL"
						/>
						<p class="text-[10px] text-slate-400">
							공태그(NTAG213, 215 등)에 차량 번호나 탑승권 URL을 영구 기록할 수 있습니다.
						</p>
						<button
							onclick={writeNfcTag}
							class="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-orange-600 active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5 mt-2"
						>
							<Icon icon="ph:pencil-line-fill" class="text-sm text-orange-400" />
							<span>NFC 태그에 지금 쓰기 (밀착 필요)</span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 12] 📶 Web Bluetooth 주변 무선 기기 탐색기 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-1">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
							<Icon icon="ph:bluetooth-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📶 Web Bluetooth 무선 기기</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Web Bluetooth API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black {bluetoothSupported ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}">
						{bluetoothSupported ? 'BLE 지원' : '미지원'}
					</span>
				</div>

				<div class="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-3 text-xs">
					<span class="text-[10px] font-bold text-slate-400 uppercase">영수증 프린터 / 차량 스캐너 페어링</span>
					<button
						onclick={scanBluetooth}
						class="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700 active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5"
					>
						<Icon icon="ph:bluetooth-connected-bold" class="text-sm" />
						<span>주변 블루투스 장치 검색 & 연결</span>
					</button>

					<div class="rounded-lg bg-white p-3 border border-slate-200 space-y-1 font-mono">
						<div class="flex items-center justify-between">
							<span class="text-[10px] text-slate-400">장치명</span>
							<span class="font-black text-slate-900">{bleDevice.name || '연결된 장치 없음'}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-[10px] text-slate-400">장치 ID</span>
							<span class="text-[10px] text-slate-500 truncate max-w-[140px]">{bleDevice.id || '-'}</span>
						</div>
					</div>
					<p class="text-[10px] text-slate-400">
						모바일 영수증 프린터, OBD2 차량 진단기, 스마트 밴드와 웹 브라우저가 다이렉트로 무선 통신합니다.
					</p>
				</div>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 13] 🔴 PWA 홈 화면 배지 (Badging) & 💡 조도 센서 (Ambient Light) -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a] md:col-span-2 lg:col-span-1">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
							<Icon icon="ph:app-window-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🔴 앱 아이콘 배지 & 💡 조도</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Badging & Ambient Light API</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
						PWA 특화
					</span>
				</div>

				<div class="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-3 text-xs">
					<!-- 앱 아이콘 배지 조작 -->
					<div>
						<span class="text-[10px] font-bold text-slate-400 uppercase">홈 화면 PWA 아이콘 배지 숫자</span>
						<div class="mt-1 flex gap-2">
							<input
								type="number"
								min="1"
								max="99"
								bind:value={badgeCount}
								class="w-20 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-rose-500 focus:outline-none"
							/>
							<button
								onclick={() => setAppBadge(badgeCount)}
								class="flex-1 rounded-xl bg-rose-600 py-1.5 text-xs font-black text-white hover:bg-rose-700 active:scale-95 transition shadow-sm"
							>
								🔴 배지 켜기
							</button>
							<button
								onclick={clearAppBadge}
								class="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300 transition"
							>
								삭제
							</button>
						</div>
					</div>

					<!-- 조도 센서 측정 -->
					<div class="border-t border-slate-200/60 pt-2.5">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-bold text-slate-400 uppercase">주변 밝기 (조도 센서)</span>
							<span class="font-mono text-xs font-black {ambientLux !== null ? 'text-amber-600' : 'text-slate-400'}">
								{ambientLux !== null ? `${ambientLux} lux` : (ambientSupported ? '측정 중...' : '센서 미지원/권한')}
							</span>
						</div>
						<p class="text-[10px] text-slate-400 mt-1">
							터널이나 어두운 곳에 진입 시 기사님 눈부심 방지 야간 모드로 자동 전환하는 센서입니다.
						</p>
					</div>
				</div>
			</div>
		</div>

	</div>
</div>