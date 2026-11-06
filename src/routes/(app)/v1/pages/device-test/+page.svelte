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
	// 3. 🔊 스피커 사운드 합성 & 한국어 TTS 음성 방송
	// ============================================================================
	let audioCtx = /** @type {AudioContext | null} */ (null);
	let ttsText = $state('안전 운행 하십시오. 3분 후 제주공항 방면으로 출발합니다.');
	let isSpeaking = $state(false);

	function playBeepSound(freq = 880, duration = 0.2, type = 'sine') {
		try {
			const AudioContextClass = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext;
			if (!AudioContextClass) {
				toast.error('오디오 엔진을 지원하지 않습니다.');
				return;
			}
			if (!audioCtx || audioCtx.state === 'closed') {
				audioCtx = new AudioContextClass();
			}
			if (audioCtx.state === 'suspended') {
				audioCtx.resume();
			}

			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			osc.type = /** @type {OscillatorType} */ (type);
			osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

			gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

			osc.connect(gain);
			gain.connect(audioCtx.destination);

			osc.start();
			osc.stop(audioCtx.currentTime + duration);
		} catch (e) {
			console.warn('사운드 출력 오류:', e);
		}
	}

	function playSirenSound() {
		try {
			playBeepSound(900, 0.15, 'sawtooth');
			setTimeout(() => playBeepSound(1200, 0.15, 'sawtooth'), 150);
			setTimeout(() => playBeepSound(900, 0.15, 'sawtooth'), 300);
			setTimeout(() => playBeepSound(1200, 0.25, 'sawtooth'), 450);
			toast.warning('긴급 경보 사이렌 사운드를 출력했습니다.');
		} catch (e) {
			toast.error('오디오 출력 실패');
		}
	}

	function speakText() {
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			toast.error('이 기기는 한국어 음성 방송(TTS)을 지원하지 않습니다.');
			return;
		}
		if (!ttsText.trim()) return;

		window.speechSynthesis.cancel();
		const utter = new SpeechSynthesisUtterance(ttsText);
		utter.lang = 'ko-KR';
		utter.rate = 1.0;
		utter.pitch = 1.0;

		utter.onstart = () => { isSpeaking = true; };
		utter.onend = () => { isSpeaking = false; };
		utter.onerror = () => { isSpeaking = false; toast.error('음성 합성 오류 발생'); };

		window.speechSynthesis.speak(utter);
		toast.info('한국어 음성 안내 방송을 스피커로 출력합니다.');
	}

	// ============================================================================
	// 4. 📳 진동 모터 (Vibration)
	// ============================================================================
	let vibrationSupported = $state(false);

	function checkVibrationSupport() {
		vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
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
		const success = navigator.vibrate(pattern);
		if (success) {
			toast.success(`[${label}] 스마트폰 진동 모터를 작동시켰습니다.`);
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

	/**
	 * 🖐️ 스마트폰 네이티브 지문인식 / 보안 패턴 팝업 호출
	 */
	async function testBiometricAuth() {
		if (typeof window === 'undefined' || !window.PublicKeyCredential) {
			toast.error('이 브라우저는 생체 인증(WebAuthn)을 지원하지 않습니다.');
			return;
		}
		biometricsLoading = true;
		lastBioResult = null;
		toast.info('스마트폰 화면에 지문 / 보안 패턴 인증 창을 호출합니다...');

		try {
			// 32바이트 랜덤 챌린지 생성
			const challenge = new Uint8Array(32);
			window.crypto.getRandomValues(challenge);

			// 플랫폼 인증기 (스마트폰 기기 내장 지문센서 또는 Face ID) 호출
			const credential = await navigator.credentials.create({
				publicKey: {
					challenge: challenge,
					rp: {
						name: 'jeju.live Core Test',
						id: window.location.hostname
					},
					user: {
						id: new Uint8Array([1, 2, 3, 4, 5]),
						name: 'driver@jeju.live',
						displayName: '테스트 승무원'
					},
					pubKeyCredParams: [
						{ type: 'public-key', alg: -7 },  // ES256
						{ type: 'public-key', alg: -257 } // RS256
					],
					authenticatorSelection: {
						authenticatorAttachment: 'platform', // 스마트폰 내장 지문/얼굴 센서 지정
						userVerification: 'required'         // 생체 검증 필수
					},
					timeout: 60000
				}
			});

			biometricsLoading = false;
			if (credential) {
				playBeepSound(1320, 0.15, 'sine');
				setTimeout(() => playBeepSound(1760, 0.2, 'sine'), 120);
				if (vibrationSupported) navigator.vibrate([120, 60, 120]);

				const rawId = credential.id || 'AUTH-SUCCESS';
				lastBioResult = `인증 성공! (보안 키: ${rawId.substring(0, 18)}...)`;
				toast.success('🎉 지문/생체 인증 성공! 본인 확인이 완료되었습니다.');
			}
		} catch (e) {
			biometricsLoading = false;
			const err = /** @type {any} */ (e);
			if (err.name === 'NotAllowedError') {
				toast.info('생체 인증이 사용자에 의해 취소되었거나 지문이 일치하지 않습니다.');
			} else {
				toast.error(`생체 인증 오류: ${err.message}`);
			}
		}
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
		checkGpsSupport();
		checkCameraSupport();
		checkVibrationSupport();
		checkMicSupport();
		checkWakeLockSupport();
		checkBattery();
		checkShareSupport();
		checkNetworkStatus();
		checkBiometricsSupport();
		checkNfcSupport();
		checkBluetoothSupport();
		checkBadgingSupport();
		initAmbientSensor();

		if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
			window.addEventListener('deviceorientation', handleOrientation);
		}
	});

	onDestroy(() => {
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
				href="/v1/admin/pages"
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3.5 py-2 text-xs font-black text-slate-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-slate-100"
			>
				<Icon icon="ph:arrow-left-bold" class="text-sm" />
				정적 페이지 탐색기
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
		<!-- [모듈 3] 🔊 스피커 사운드 합성 & 한국어 TTS 방송 -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
							<Icon icon="ph:speaker-high-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">🔊 스피커 & TTS 음성 방송</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Web Audio & SpeechSynthesis</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
						지원됨
					</span>
				</div>

				<!-- 한국어 TTS 텍스트 입력 필드 -->
				<div class="mt-4 space-y-2">
					<label class="block text-[11px] font-bold text-slate-500">
						한국어 안내 음성 방송 문구 입력:
					</label>
					<input
						type="text"
						bind:value={ttsText}
						placeholder="스피커로 방송할 문구를 입력하세요..."
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
				</div>
			</div>

			<!-- 오디오 및 TTS 실행 버튼들 -->
			<div class="mt-5 flex flex-col gap-2">
				<button
					onclick={speakText}
					disabled={isSpeaking}
					class="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
				>
					<Icon icon="ph:megaphone-simple-fill" class="text-base" />
					<span>{isSpeaking ? '음성 방송 출력 중...' : '한국어 음성 방송 실행 (TTS)'}</span>
				</button>

				<div class="grid grid-cols-2 gap-2">
					<button
						onclick={() => playBeepSound(880, 0.2)}
						class="rounded-xl border border-slate-300 bg-slate-50 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 active:scale-95 flex items-center justify-center gap-1.5"
					>
						<Icon icon="ph:bell-simple-fill" class="text-sm text-amber-500" />
						알림 비프음 (880Hz)
					</button>
					<button
						onclick={playSirenSound}
						class="rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95 flex items-center justify-center gap-1.5"
					>
						<Icon icon="ph:warning-octagon-fill" class="text-sm text-rose-600" />
						긴급 사이렌 (4연속)
					</button>
				</div>
			</div>
		</div>

		<!-- ----------------------------------------------------------------- -->
		<!-- [모듈 4] 📳 진동 모터 (Vibration API) -->
		<!-- ----------------------------------------------------------------- -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_#0f172a]">
			<div>
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<div class="flex items-center gap-2">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
							<Icon icon="ph:vibrate-fill" class="text-xl" />
						</div>
						<div>
							<h3 class="font-black text-slate-900 text-sm">📳 진동 모터</h3>
							<span class="text-[10px] font-bold text-slate-400 uppercase">Vibration API (Android/PWA)</span>
						</div>
					</div>
					<span class="rounded px-2 py-0.5 text-[10px] font-black {vibrationSupported ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
						{vibrationSupported ? '기기 지원됨' : '미지원 (iOS제외)'}
					</span>
				</div>

				<p class="mt-3 text-xs leading-relaxed text-slate-500 font-medium">
					스마트폰 내부 물리 진동 모터를 직접 구동합니다. 안드로이드 크롬 및 설치된 PWA 환경에서 완벽 작동합니다.
				</p>
			</div>

			<!-- 진동 패턴 버튼 목록 -->
			<div class="mt-5 grid grid-cols-3 gap-2">
				<button
					onclick={() => triggerVibrate(150, '단일 진동')}
					class="rounded-xl border-2 border-slate-900 bg-white py-3 text-xs font-black text-slate-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-slate-100 active:scale-95"
				>
					짧은 진동 (0.15초)
				</button>
				<button
					onclick={() => triggerVibrate([200, 100, 200, 100, 300], '경고 진동')}
					class="rounded-xl border-2 border-slate-900 bg-amber-50 py-3 text-xs font-black text-amber-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-amber-100 active:scale-95"
				>
					경고 3연속 진동
				</button>
				<button
					onclick={() => triggerVibrate([100, 100, 100, 100, 100, 300, 300, 100, 300, 100, 300, 300, 100, 100, 100], 'SOS 진동')}
					class="rounded-xl border-2 border-slate-900 bg-rose-50 py-3 text-xs font-black text-rose-900 shadow-[2px_2px_0_0_#0f172a] transition hover:bg-rose-100 active:scale-95"
				>
					SOS 모스부호 진동
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

					<!-- 생체 인증 지원 여부 및 실제 지문 팝업 테스트 -->
					<div class="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-bold text-slate-400 uppercase">보안 인증 하드웨어 (Passkey)</span>
							<span class="rounded px-2 py-0.5 text-[10px] font-black {biometricsSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
								{biometricsSupported ? '지문/패턴 센서 감지됨' : '미지원/단말 없음'}
							</span>
						</div>
						<div class="rounded-lg bg-white p-3 border border-slate-200 flex items-center gap-3">
							<Icon icon="ph:fingerprint-bold" class="text-3xl {biometricsSupported ? 'text-emerald-500' : 'text-slate-400'}" />
							<div>
								<div class="font-black text-slate-900 text-xs">{biometricsStatusText}</div>
								<p class="text-[10px] text-slate-400 mt-0.5">
									{biometricsSupported
										? '스마트폰 지문 센서 터치 또는 화면 잠금 패턴으로 비밀번호 없는 초고속 로그인이 가능합니다.'
										: '단말기에 등록된 생체/패턴 인증 수단이 없거나 브라우저에서 차단되었습니다.'}
								</p>
							</div>
						</div>

						<!-- 지문/패턴 네이티브 팝업 호출 버튼 -->
						<button
							onclick={testBiometricAuth}
							disabled={biometricsLoading}
							class="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white hover:bg-violet-700 active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
						>
							<Icon icon="ph:fingerprint-simple-bold" class="text-base text-violet-200" />
							<span>{biometricsLoading ? '스마트폰 지문/패턴 인증 진행 중...' : '🖐️ 스마트폰 지문 / 패턴 인증 팝업 띄우기'}</span>
						</button>

						{#if lastBioResult}
							<div class="rounded-lg bg-emerald-50 p-2.5 text-[11px] font-black text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
								<Icon icon="ph:check-circle-fill" class="text-base text-emerald-600" />
								<span>{lastBioResult}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

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