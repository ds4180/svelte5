<script>
	/**
	 * ============================================================================
	 * [프로 모바일 카메라 스튜디오 (Standalone Fullscreen WebApp)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 특징:
	 * 로그인 화면처럼 사내 관리자 레이아웃(헤더, 사이드바, 본문 패딩)이 100% 제거된
	 * '완전 독립 순수 풀스크린' 모바일 카메라 전용 웹앱입니다.
	 * 
	 * 🌟 핵심 아키텍처:
	 * 1. 📱 (fullscreen) 독립 라우트: 상위 껍데기 0px, 스마트폰 화면 100%를 오직 카메라 전용으로 사용
	 * 2. ⚡ 단일 Video DOM 상시 고정: 가로/세로 회전 시 비디오 스트림 끊김 0%
	 * 3. 🔍 상단 옵션 2배 대형화: 모바일 터치 최적화 48px 대형 아이콘/버튼 적용
	 * 4. ☁️ 웹페이지(서버) 업로드 풀옵션: 촬영 즉시 자동 업로드 & 모달 수동 업로드 & 업로드 히스토리 완비
	 * 5. 🔄 스마트 플로팅 HUD: 가로 모드 시 우측 셔터, 세로 모드 시 하단 셔터 자동 전환
	 * 6. 🛡️ Safe Area 여백: 모바일 하단 주소창 및 우측 제스처 바 간섭 완벽 회피
	 */

	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { getAuthContext } from '$lib/runes/auth.svelte.js';
	import { offlineSync } from '$lib/runes/offlineSync.svelte.js';
	import { uploadFiles, createUserFolder } from '$lib/services/mediaService';
	import Icon from '@iconify/svelte';

	// 사용자 인증 상태 (내 파일함 USERS/{id}/WEBCAM 경로 결정)
	const auth = getAuthContext();

	/**
	 * 🔙 [스마트 뒤로가기 엔진]:
	 * 1. 브라우저 히스토리가 있으면 직전 이전 페이지로 자연스럽게 복귀
	 * 2. PWA 독립 실행/새 탭 유입 등 뒤로가기가 불가능하거나 응답이 없으면 안전하게 홈('/')으로 즉시 이동
	 */
	function handleGoBack() {
		if (typeof window === 'undefined') {
			goto('/');
			return;
		}

		if (window.history.length <= 1) {
			goto('/');
			return;
		}

		const currentPath = window.location.pathname;
		window.history.back();

		setTimeout(() => {
			if (window.location.pathname === currentPath) {
				goto('/');
			}
		}, 250);
	}

	/**
	 * 🌟 [정책 통일] 개인 폴더(USERS/{userId}) 하위에 'WEBCAM' 전용 폴더를 자동 보장/생성
	 * (오프라인 상태에서는 불필요하게 우체통 대기열에 들어가지 않도록 온라인일 때만 호출)
	 */
	async function ensureWebcamFolder() {
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;
		const user = auth.user;
		if (!user || !user.id) return;
		try {
			await createUserFolder(`USERS/${user.id}`, 'WEBCAM', 'PRIVATE');
		} catch (e) {
			// 이미 존재하는 경우 400 무시하고 통과
		}
	}

	// ============================================================================
	// 1. 카메라 하드웨어 및 스트림 상태
	// ============================================================================
	let videoElement = /** @type {HTMLVideoElement | null} */ (null);
	let mediaStream = /** @type {MediaStream | null} */ (null);
	let isCameraOn = $state(false);
	let isInitializing = $state(false);

	// 물리 렌즈 목록
	/** @type {MediaDeviceInfo[]} */
	let availableCameras = $state([]);
	let selectedCameraId = $state('');
	let facingMode = $state('environment'); // 'environment' | 'user'

	// 해상도 프리셋 ('4k' | 'fhd' | 'hd' | 'sd')
	let selectedResolution = $state('fhd');
	const resolutionPresets = {
		'4k': { label: '4K UHD (2160p)', width: 3840, height: 2160 },
		'fhd': { label: 'Full HD (1080p)', width: 1920, height: 1080 },
		'hd': { label: 'HD (720p)', width: 1280, height: 720 },
		'sd': { label: 'SD (480p)', width: 640, height: 480 }
	};

	// 뷰파인더 맞춤 모드 ('cover' | 'contain')
	let fitMode = $state('cover');

	// 기기 방향 (가로/세로)
	let isLandscape = $state(false);

	// 하드웨어 제어 기능
	let flashSupported = $state(false);
	let isFlashOn = $state(false);
	let zoomSupported = $state(false);
	let zoomRange = $state({ min: 1, max: 5, step: 0.1 });
	let currentZoom = $state(1);

	// 설정 옵션 (시스템 기본값 규격)
	let showGrid = $state(true); // 3x3 구도 격자선 기본 활성화
	let autoSave = $state(false); // 스마트폰 로컬 파일 다운로드 안함 (기본 OFF)
	let autoUpload = $state(true); // 촬영 즉시 내 파일함(WEBCAM) 자동 업로드 (기본 ON)
	let isUploading = $state(false); // 서버 업로드 진행 상태
	let shutterSound = $state(false); // 셔터 사운드 사용 안함 (기본 OFF)
	let timerSeconds = $state(0); // 0(OFF), 3, 5, 10
	let countdownRemain = $state(0);
	let isCountingDown = $state(false);

	// 실시간 비디오 필터 (기본 원본 'none' 고정)
	let selectedFilter = $state('none');
	const filterStyles = {
		none: '',
		vivid: 'contrast(1.2) saturate(1.3)',
		mono: 'grayscale(1) contrast(1.1)',
		sepia: 'sepia(0.8) contrast(1.1)',
		night: 'brightness(1.4) contrast(1.2) saturate(1.2)'
	};

	// QR 스캔 모드 (기본 ON)
	let qrMode = $state(true);
	let scannedQrResult = $state(/** @type {string | null} */ (null));
	let scanIntervalId = /** @type {any} */ (null);
	let barcodeDetector = /** @type {any} */ (null);

	// 갤러리 히스토리
	/** @type {Array<{ id: string, url: string, time: string, resolution: string, fileName: string, uploaded: boolean, serverUrl: string | null }>} */
	let capturedGallery = $state([]);
	let selectedPhotoModal = $state(/** @type {string | null} */ (null));

	// 서버 업로드 완료 히스토리
	/** @type {Array<{ id: string, name: string, serverPath: string, time: string, thumbUrl: string }>} */
	let uploadedHistory = $state([]);

	// 풀옵션 세부 설정 패널
	let showSettingsPanel = $state(false);

	// ============================================================================
	// 2. 가로/세로 방향 실시간 감지 (스트림 재연결 없이 UI만 회전)
	// ============================================================================
	function checkOrientation() {
		if (typeof window !== 'undefined') {
			isLandscape = window.innerWidth > window.innerHeight;
		}
	}

	// ============================================================================
	// 3. 오디오 셔터음 및 햅틱 진동
	// ============================================================================
	let audioCtx = /** @type {AudioContext | null} */ (null);

	function playShutterAudio() {
		if (!shutterSound) return;
		try {
			const AudioClass = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext;
			if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioClass();
			if (audioCtx.state === 'suspended') audioCtx.resume();

			const t = audioCtx.currentTime;
			const osc1 = audioCtx.createOscillator();
			const osc2 = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			osc1.type = 'triangle';
			osc1.frequency.setValueAtTime(1400, t);
			osc1.frequency.exponentialRampToValueAtTime(300, t + 0.05);

			osc2.type = 'sine';
			osc2.frequency.setValueAtTime(800, t + 0.04);
			osc2.frequency.exponentialRampToValueAtTime(200, t + 0.1);

			gain.gain.setValueAtTime(0.4, t);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

			osc1.connect(gain);
			osc2.connect(gain);
			gain.connect(audioCtx.destination);

			osc1.start(t);
			osc2.start(t + 0.04);
			osc1.stop(t + 0.05);
			osc2.stop(t + 0.12);
		} catch (e) {
			console.warn('셔터 사운드 오류:', e);
		}
	}

	function triggerHaptic(duration = 80) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try { navigator.vibrate(duration); } catch {}
		}
	}

	// ============================================================================
	// 4. 카메라 하드웨어 초기화 및 렌즈 제어
	// ============================================================================
	async function initCameras() {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
			toast.error('이 브라우저는 카메라 하드웨어 접근을 지원하지 않습니다.');
			return;
		}

		if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
			try {
				barcodeDetector = new (/** @type {any} */ (window)).BarcodeDetector({ formats: ['qr_code'] });
			} catch (e) {
				barcodeDetector = null;
			}
		}

		await updateCameraList();
		await startCamera();
	}

	async function updateCameraList() {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			availableCameras = devices.filter((d) => d.kind === 'videoinput');
		} catch (e) {
			console.warn('렌즈 목록 탐색 실패:', e);
		}
	}

	async function startCamera() {
		isInitializing = true;
		stopCamera();

		try {
			const preset = resolutionPresets[selectedResolution] || resolutionPresets.fhd;
			
			/** @type {MediaStreamConstraints} */
			const constraints = {
				audio: false,
				video: {
					width: { ideal: preset.width },
					height: { ideal: preset.height }
				}
			};

			const videoConstraints = /** @type {MediaTrackConstraints} */ (constraints.video);
			if (selectedCameraId) {
				videoConstraints.deviceId = { exact: selectedCameraId };
			} else {
				videoConstraints.facingMode = { ideal: facingMode };
			}

			try {
				mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
			} catch (firstErr) {
				console.warn('기본 해상도/렌즈 제약 조건 연결 실패 -> 범용 비디오 모드로 자동 폴백 재시도:', firstErr);
				mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			}

			if (videoElement) {
				videoElement.muted = true;
				videoElement.srcObject = mediaStream;
				try {
					await videoElement.play();
				} catch (playErr) {
					console.warn('비디오 자동 재생 경고 (무시 가능):', playErr);
				}
			}

			isCameraOn = true;
			isInitializing = false;

			inspectTrackCapabilities();
			await updateCameraList();

			const activeTrack = mediaStream.getVideoTracks()[0];
			const activeSettings = activeTrack.getSettings ? activeTrack.getSettings() : {};
			if (activeSettings.deviceId) {
				selectedCameraId = activeSettings.deviceId;
			}

			// QR 모드 기본 활성화 연동
			if (qrMode) {
				startQrLoop();
			}

			toast.success(`카메라 기동 완료 (${preset.label})`);
		} catch (err) {
			isInitializing = false;
			isCameraOn = false;
			toast.error(`카메라 실행 실패: ${/** @type {any} */ (err).message}`);
		}
	}

	function inspectTrackCapabilities() {
		if (!mediaStream) return;
		const track = mediaStream.getVideoTracks()[0];
		if (!track) return;

		const caps = /** @type {any} */ (track.getCapabilities ? track.getCapabilities() : {});

		flashSupported = !!caps.torch;

		if (caps.zoom) {
			zoomSupported = true;
			zoomRange = {
				min: caps.zoom.min || 1,
				max: caps.zoom.max || 5,
				step: caps.zoom.step || 0.1
			};
			const settings = track.getSettings ? track.getSettings() : {};
			currentZoom = (/** @type {any} */ (settings)).zoom || caps.zoom.min || 1;
		} else {
			zoomSupported = false;
		}
	}

	function stopCamera() {
		stopQrLoop();
		if (mediaStream) {
			mediaStream.getTracks().forEach((t) => t.stop());
			mediaStream = null;
		}
		if (videoElement) {
			videoElement.srcObject = null;
		}
		isCameraOn = false;
		isFlashOn = false;
	}

	async function toggleFacingMode() {
		facingMode = facingMode === 'environment' ? 'user' : 'environment';
		selectedCameraId = '';
		await startCamera();
	}

	async function onSelectCamera(deviceId) {
		selectedCameraId = deviceId;
		await startCamera();
	}

	async function onSelectResolution(resKey) {
		selectedResolution = resKey;
		await startCamera();
	}

	async function toggleFlash() {
		if (!mediaStream || !flashSupported) return;
		const track = mediaStream.getVideoTracks()[0];
		try {
			isFlashOn = !isFlashOn;
			await (/** @type {any} */ (track)).applyConstraints({
				advanced: [{ torch: isFlashOn }]
			});
			triggerHaptic(50);
			toast.info(`플래시 조명: ${isFlashOn ? 'ON' : 'OFF'}`);
		} catch (e) {
			toast.error('플래시 제어 실패');
			isFlashOn = false;
		}
	}

	async function onZoomChange(zoomVal) {
		currentZoom = Number(zoomVal);
		if (!mediaStream || !zoomSupported) return;
		const track = mediaStream.getVideoTracks()[0];
		try {
			await (/** @type {any} */ (track)).applyConstraints({
				advanced: [{ zoom: currentZoom }]
			});
		} catch (e) {
			console.warn('줌 적용 실패:', e);
		}
	}

	// ============================================================================
	// 5. 웹페이지(서버) 업로드 코어 엔진
	// ============================================================================
	/**
	 * DataURL(Base64)을 전송 가능한 File 객체로 변환 (네트워크 fetch 없이 순수 메모리 변환으로 오프라인 100% 호환)
	 * @param {string} dataUrl
	 * @param {string} filename
	 */
	function dataUrlToFile(dataUrl, filename) {
		const arr = dataUrl.split(',');
		const mimeMatch = arr[0].match(/:(.*?);/);
		const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
		const bstr = atob(arr[1]);
		let n = bstr.length;
		const u8arr = new Uint8Array(n);
		while (n--) {
			u8arr[n] = bstr.charCodeAt(n);
		}
		return new File([u8arr], filename, { type: mime });
	}

	/**
	 * 사진을 사내 공식 미디어 엔진(/api/media/upload)을 통해 로그인 유저의 '내 파일함 (PRIVATE/USERS/{id})'으로 업로드
	 */
	async function uploadPhotoToServer(photoUrl, fileName) {
		if (!photoUrl) return null;

		// 로그인 유저 세션 확인
		const user = auth.user;
		if (!user || !user.id) {
			toast.error('⚠️ "내 파일함"에 보관하려면 로그인이 필요합니다. 먼저 로그인해 주세요.');
			return null;
		}

		isUploading = true;
		const name = fileName || `camera_${Date.now()}.jpg`;

		try {
			const file = await dataUrlToFile(photoUrl, name);
			// 🌟 [정책 통일] 개인 폴더 내 'WEBCAM' 하위 폴더로 자동 지정
			const targetSubPath = `USERS/${user.id}/WEBCAM`;

			// 사내 표준 미디어 서비스 호출 -> PRIVATE/USERS/{userId}/WEBCAM 경로에 실제 MediaAsset DB 및 파일 등록
			const newAssets = await uploadFiles([file], {
				app_id: 'camera',
				access_level: 'PRIVATE',
				sub_path: targetSubPath
			});

			// 📮 [오프라인 우체통 연동]: 인터넷 단절 시 fastApi 코어가 IndexedDB 우체통에 원본 JPEG 파일을 자동 보관함
			if (newAssets && (/** @type {any} */ (newAssets)).offline_queued) {
				const pendingPath = `PRIVATE/${targetSubPath}/${name} (동기화 대기중)`;
				capturedGallery = capturedGallery.map((item) => {
					if (item.url === photoUrl) {
						return { ...item, uploaded: false, queued: true, serverUrl: pendingPath };
					}
					return item;
				});
				triggerHaptic([50, 50]);
				return { id: String((/** @type {any} */ (newAssets)).queue_id || 'queued'), name, serverPath: pendingPath, time: new Date().toLocaleTimeString('ko-KR'), thumbUrl: photoUrl };
			}

			const uploadedItem = Array.isArray(newAssets) ? newAssets[0] : newAssets;
			const serverPath = uploadedItem?.file_path || `PRIVATE/${targetSubPath}/${name}`;
			const assetId = uploadedItem?.id;

			// 갤러리 내 상태 업데이트
			capturedGallery = capturedGallery.map((item) => {
				if (item.url === photoUrl) {
					return { ...item, uploaded: true, queued: false, serverUrl: serverPath, assetId };
				}
				return item;
			});

			// 업로드 히스토리 기록
			const historyItem = {
				id: assetId ? String(assetId) : Math.random().toString(36).substring(2, 9),
				name: uploadedItem?.original_name || name,
				serverPath: serverPath,
				time: new Date().toLocaleTimeString('ko-KR'),
				thumbUrl: photoUrl
			};
			uploadedHistory = [historyItem, ...uploadedHistory.slice(0, 15)];

			triggerHaptic(80);
			toast.success(`📁 내 파일함 (WEBCAM)에 저장 완료! (${uploadedItem?.original_name || name})`);
			return historyItem;
		} catch (e) {
			console.error('내 파일함 업로드 실패:', e);
			const errMsg = /** @type {any} */ (e).detail || /** @type {any} */ (e).message || '서버 통신 실패';
			toast.error(`내 파일함 업로드 실패: ${errMsg}`);
			return null;
		} finally {
			isUploading = false;
		}
	}

	// ============================================================================
	// 6. 사진 촬영 및 자동 저장 / 웹페이지 업로드
	// ============================================================================
	function requestCapture() {
		if (!isCameraOn || isCountingDown) return;

		if (timerSeconds > 0) {
			isCountingDown = true;
			countdownRemain = timerSeconds;

			const interval = setInterval(() => {
				playShutterBeep();
				countdownRemain -= 1;
				if (countdownRemain <= 0) {
					clearInterval(interval);
					isCountingDown = false;
					executeCapture();
				}
			}, 1000);
		} else {
			executeCapture();
		}
	}

	function playShutterBeep() {
		try {
			const AudioClass = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext;
			if (!audioCtx) audioCtx = new AudioClass();
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.frequency.setValueAtTime(880, audioCtx.currentTime);
			gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
			osc.connect(gain);
			gain.connect(audioCtx.destination);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.1);
		} catch {}
	}

	function executeCapture() {
		if (!videoElement || !isCameraOn) return;

		playShutterAudio();
		triggerHaptic([60, 40, 80]);

		const canvas = document.createElement('canvas');
		const vw = videoElement.videoWidth || 1920;
		const vh = videoElement.videoHeight || 1080;

		canvas.width = vw;
		canvas.height = vh;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		if (selectedFilter !== 'none') {
			ctx.filter = filterStyles[selectedFilter] || 'none';
		}

		ctx.drawImage(videoElement, 0, 0, vw, vh);

		const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
		const now = new Date();
		const timeStr = now.toLocaleTimeString('ko-KR');
		const fileTimestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
		const fileName = `jeju_camera_${fileTimestamp}.jpg`;

		const newPhoto = {
			id: Math.random().toString(36).substring(2, 9),
			url: photoDataUrl,
			time: timeStr,
			resolution: `${vw}x${vh}`,
			fileName: fileName,
			uploaded: false,
			serverUrl: null
		};
		capturedGallery = [newPhoto, ...capturedGallery.slice(0, 20)];

		// [1] 스마트폰 기기 로컬 파일 자동 다운로드 저장
		if (autoSave) {
			const link = document.createElement('a');
			link.download = fileName;
			link.href = photoDataUrl;
			link.click();
			toast.success(`📸 "${fileName}" 기기 자동 저장됨`);
		} else {
			toast.success(`📸 사진 촬영 완료! (${vw}x${vh})`);
		}

		// [2] 웹페이지(서버) 자동 업로드
		if (autoUpload) {
			uploadPhotoToServer(photoDataUrl, fileName);
		}
	}

	// ============================================================================
	// 7. 실시간 QR 모드 제어
	// ============================================================================
	function toggleQrMode() {
		qrMode = !qrMode;
		if (qrMode) {
			startQrLoop();
			toast.info('실시간 QR 감지 모드를 활성화했습니다.');
		} else {
			stopQrLoop();
			scannedQrResult = null;
		}
	}

	function startQrLoop() {
		if (scanIntervalId) clearInterval(scanIntervalId);
		scanIntervalId = setInterval(async () => {
			if (!videoElement || !isCameraOn || videoElement.readyState < 2 || !qrMode) return;
			if (barcodeDetector) {
				try {
					const codes = await barcodeDetector.detect(videoElement);
					if (codes && codes.length > 0 && codes[0].rawValue) {
						handleQrFound(codes[0].rawValue);
					}
				} catch {}
			}
		}, 300);
	}

	function stopQrLoop() {
		if (scanIntervalId) {
			clearInterval(scanIntervalId);
			scanIntervalId = null;
		}
	}

	function handleQrFound(data) {
		if (scannedQrResult === data) return;
		scannedQrResult = data;
		playShutterBeep();
		triggerHaptic(100);
		toast.success(`QR 코드 감지: ${data.slice(0, 30)}...`);
	}

	// 클립보드 복사 헬퍼
	function copyToClipboard(text, label = '주소') {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(text);
			toast.success(`📋 ${label}가 클립보드에 복사되었습니다!`);
		}
	}

	// ============================================================================
	// 8. 마운트 및 언마운트
	// ============================================================================
	function handleOfflineSynced() {
		// 오프라인 우체통 전송이 완료되면 대기 중이던 사진 배지를 CLOUD 완료로 갱신
		capturedGallery = capturedGallery.map((item) => {
			if (/** @type {any} */ (item).queued) {
				return { ...item, uploaded: true, queued: false };
			}
			return item;
		});
	}

	onMount(() => {
		checkOrientation();
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', checkOrientation);
			window.addEventListener('orientationchange', checkOrientation);
			window.addEventListener('jeju:offline-synced', handleOfflineSynced);
		}
		ensureWebcamFolder();
		initCameras();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkOrientation);
			window.removeEventListener('orientationchange', checkOrientation);
			window.removeEventListener('jeju:offline-synced', handleOfflineSynced);
		}
		stopCamera();
	});
</script>

<svelte:head>
	<title>웹카메라 스튜디오 (WebCam) | jeju.live</title>
</svelte:head>

<!-- ===================================================================== -->
<!-- 📱 [독립 풀스크린 뷰포트]: 상위 레이아웃 간섭 0px 순수 전체화면 캔버스 -->
<!-- ===================================================================== -->
<div class="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden select-none bg-black text-white font-['Noto_Sans_KR','Outfit']">

	<!-- ================================================================= -->
	<!-- 🎥 [단일 영구 비디오 뷰파인더]: DOM 조건문 없이 상시 100% 영구 유지 -->
	<!-- ================================================================= -->
	<div class="absolute inset-0 z-0 flex h-full w-full items-center justify-center bg-black overflow-hidden">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={videoElement}
			playsinline
			autoplay
			muted
			class="h-full w-full transition-all {fitMode === 'cover' ? 'object-cover' : 'object-contain'}"
			style:filter={filterStyles[selectedFilter] || 'none'}
		></video>

		<!-- 3x3 구도 격자선 오버레이 -->
		{#if showGrid && isCameraOn}
			<div class="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 z-10">
				<div class="border-r border-b border-white/20"></div>
				<div class="border-r border-b border-white/20"></div>
				<div class="border-b border-white/20"></div>
				<div class="border-r border-b border-white/20"></div>
				<div class="border-r border-b border-white/20"></div>
				<div class="border-b border-white/20"></div>
				<div class="border-r border-b border-white/20"></div>
				<div class="border-r border-b border-white/20"></div>
				<div></div>
			</div>
		{/if}

		<!-- 카운트다운 숫자 -->
		{#if isCountingDown}
			<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs">
				<span class="text-9xl font-black text-white animate-ping">{countdownRemain}</span>
			</div>
		{/if}

		<!-- 카메라 미작동 안내 -->
		{#if !isCameraOn && !isInitializing}
			<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 text-slate-400 p-4 text-center">
				<Icon icon="ph:camera-slash-bold" class="text-6xl opacity-40" />
				<p class="mt-3 text-sm font-bold text-slate-300">카메라가 꺼져 있습니다.</p>
				<button
					onclick={startCamera}
					class="mt-4 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700 active:scale-95 shadow-lg"
				>
					카메라 다시 켜기
				</button>
			</div>
		{/if}

		<!-- 로딩 인디케이터 -->
		{#if isInitializing}
			<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
				<span class="loading loading-spinner loading-lg text-blue-500 scale-125"></span>
				<span class="mt-4 text-sm font-bold text-slate-200">카메라 렌즈 초기화 중...</span>
			</div>
		{/if}

		<!-- QR 감지 모드 오버레이 -->
		{#if qrMode && isCameraOn}
			<div class="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center p-4">
				<div class="h-44 w-44 rounded-3xl border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_#34d399] flex items-center justify-center animate-pulse">
					<Icon icon="ph:scan-bold" class="text-4xl text-emerald-300" />
				</div>
			</div>
		{/if}

		<!-- QR 감지 결과 플로팅 바 -->
		{#if scannedQrResult}
			<div class="absolute top-16 sm:top-18 inset-x-4 z-40 mx-auto max-w-md flex items-center justify-between rounded-xl bg-emerald-950/90 border border-emerald-500 p-2.5 text-xs text-white shadow-2xl backdrop-blur-md">
				<div class="flex items-center gap-2 truncate">
					<Icon icon="ph:qr-code-fill" class="text-xl text-emerald-400 shrink-0" />
					<span class="font-mono font-bold truncate text-xs">{scannedQrResult}</span>
				</div>
				<div class="flex items-center gap-1.5 shrink-0 ml-2">
					<button
						onclick={() => {
							if (typeof window !== 'undefined') window.location.href = scannedQrResult || '';
						}}
						class="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-black hover:bg-emerald-400"
					>
						이동
					</button>
					<button
						onclick={() => (scannedQrResult = null)}
						class="text-slate-400 hover:text-white px-1 text-xs"
					>
						✕
					</button>
				</div>
			</div>
		{/if}

		<!-- 서버 업로드 중 상단 플로팅 배너 -->
		{#if isUploading}
			<div class="absolute top-16 sm:top-18 inset-x-4 z-40 mx-auto max-w-xs flex items-center justify-center gap-2 rounded-xl bg-sky-950/90 border border-sky-400 py-2 px-3 text-[11px] font-black text-sky-200 shadow-xl backdrop-blur-md animate-pulse">
				<span class="loading loading-spinner loading-xs text-sky-300"></span>
				<span>📁 내 파일함으로 사진 전송 중...</span>
			</div>
		{/if}
	</div>

	<!-- ================================================================= -->
	<!-- 📱 [스마트 플로팅 아일랜드 HUD]: 주소창/메뉴바 짤림 100% 회피 여백 -->
	<!-- ================================================================= -->

	<!-- ----------------------------------------------------------------- -->
	<!-- [1] 상단 옵션 툴바 (컴팩트 최적화: 34px 스마트 아일랜드, CAM 제거) -->
	<!-- ----------------------------------------------------------------- -->
	<header
		class="absolute z-30 flex items-center justify-between bg-black/80 backdrop-blur-lg border border-white/20 shadow-xl transition-all
			{isLandscape 
				? 'left-3 top-3 bottom-3 w-13 flex-col py-3 px-1 rounded-2xl' 
				: 'top-3 left-3 right-3 max-w-md mx-auto h-12 flex-row px-2.5 rounded-2xl'}"
	>
		<!-- 뒤로가기 (이전 화면 복귀 또는 홈으로) -->
		<div class="flex items-center">
			<button
				onclick={handleGoBack}
				class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/15 active:scale-90 transition"
				title="뒤로가기 (또는 홈으로)"
			>
				<Icon icon="ph:arrow-left-bold" class="text-lg sm:text-xl" />
			</button>
		</div>

		<!-- 중간 도구 아이콘들 (스마트 컴팩트 크기) -->
		<div class="flex items-center gap-1.5 sm:gap-2 {isLandscape ? 'flex-col' : 'flex-row'}">
			<!-- 플래시 조명 -->
			{#if flashSupported}
				<button
					onclick={toggleFlash}
					class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition active:scale-90 {isFlashOn ? 'text-amber-400 bg-amber-400/25 ring-1.5 ring-amber-400 shadow-[0_0_10px_#f59e0b]' : 'text-white/70 hover:text-white hover:bg-white/10'}"
					title="플래시 조명 ON/OFF"
				>
					<Icon icon={isFlashOn ? "ph:flashlight-fill" : "ph:flashlight-bold"} class="text-lg sm:text-xl" />
				</button>
			{/if}

			<!-- 3x3 격자선 -->
			<button
				onclick={() => (showGrid = !showGrid)}
				class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition active:scale-90 {showGrid ? 'text-emerald-400 bg-emerald-400/25 ring-1.5 ring-emerald-400' : 'text-white/60 hover:text-white hover:bg-white/10'}"
				title="3x3 구도 격자선"
			>
				<Icon icon="ph:grid-four-bold" class="text-lg sm:text-xl" />
			</button>

			<!-- 셔터 타이머 -->
			<button
				onclick={() => {
					if (timerSeconds === 0) timerSeconds = 3;
					else if (timerSeconds === 3) timerSeconds = 5;
					else if (timerSeconds === 5) timerSeconds = 10;
					else timerSeconds = 0;
					toast.info(`셔터 타이머: ${timerSeconds === 0 ? 'OFF' : `${timerSeconds}초`}`);
				}}
				class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-[11px] font-black transition active:scale-90 {timerSeconds > 0 ? 'bg-amber-500 text-black shadow-[0_0_10px_#f59e0b]' : 'bg-white/10 text-white/70 hover:text-white'}"
				title="타이머 설정"
			>
				{timerSeconds === 0 ? '0s' : `${timerSeconds}s`}
			</button>

			<!-- QR 모드 -->
			<button
				onclick={toggleQrMode}
				class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition active:scale-90 {qrMode ? 'text-emerald-300 bg-emerald-400/25 ring-1.5 ring-emerald-400 shadow-[0_0_10px_#34d399]' : 'text-white/60 hover:text-white hover:bg-white/10'}"
				title="실시간 QR 감지 모드"
			>
				<Icon icon="ph:qr-code-bold" class="text-lg sm:text-xl" />
			</button>

			<!-- ☁️ 내 파일함 업로드 자동 옵션 토글 버튼 (오프라인 우체통 대기 건수 표시 포함) -->
			<button
				onclick={() => {
					autoUpload = !autoUpload;
					triggerHaptic(50);
					toast.info(autoUpload ? '📁 촬영 즉시 내 파일함(WEBCAM) 자동 업로드 ON' : '내 파일함 자동 업로드 OFF');
				}}
				class="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition active:scale-90 {autoUpload ? 'text-sky-300 bg-sky-500/25 ring-1.5 ring-sky-400 shadow-[0_0_10px_#38bdf8]' : 'text-white/50 hover:text-white hover:bg-white/10'}"
				title="내 파일함(WEBCAM) 자동 업로드 (ON/OFF)"
			>
				<Icon icon={autoUpload ? "ph:cloud-arrow-up-fill" : "ph:cloud-arrow-up-bold"} class="text-lg sm:text-xl" />
				{#if offlineSync.pendingCount > 0}
					<span class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-black shadow">
						{offlineSync.pendingCount}
					</span>
				{/if}
			</button>
		</div>

		<!-- 우측: 풀옵션 세부 설정 열기 -->
		<div class="flex items-center">
			<button
				onclick={() => (showSettingsPanel = !showSettingsPanel)}
				class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition active:scale-90 {showSettingsPanel ? 'text-purple-400 bg-purple-400/25 ring-1.5 ring-purple-400' : 'text-white/70 hover:text-white hover:bg-white/10'}"
				title="풀옵션 설정 열기"
			>
				<Icon icon="ph:sliders-horizontal-bold" class="text-lg sm:text-xl" />
			</button>
		</div>
	</header>

	<!-- ----------------------------------------------------------------- -->
	<!-- [2] 줌(Zoom) 슬라이더 바 (플로팅) -->
	<!-- ----------------------------------------------------------------- -->
	{#if zoomSupported && isCameraOn}
		<div
			class="absolute z-20 flex items-center justify-center gap-2 rounded-full bg-black/75 px-4 py-2 backdrop-blur-md border border-white/20 shadow-lg transition-all
				{isLandscape 
					? 'bottom-5 left-24 max-w-[240px]' 
					: 'bottom-36 inset-x-8 mx-auto max-w-xs'}"
		>
			<Icon icon="ph:magnifying-glass-minus-bold" class="text-sm text-slate-400" />
			<input
				type="range"
				min={zoomRange.min}
				max={zoomRange.max}
				step={zoomRange.step}
				bind:value={currentZoom}
				oninput={(e) => onZoomChange((/** @type {HTMLInputElement} */ (e.target)).value)}
				class="range range-xs range-primary flex-1"
			/>
			<Icon icon="ph:magnifying-glass-plus-bold" class="text-sm text-slate-400" />
			<span class="min-w-[32px] text-right font-mono text-xs font-black text-blue-400">
				{currentZoom.toFixed(1)}x
			</span>
		</div>
	{/if}

	<!-- ----------------------------------------------------------------- -->
	<!-- [3] 셔터 컨트롤러 (플로팅 아일랜드: 우측/하단 여백 넉넉히 확보) -->
	<!-- ----------------------------------------------------------------- -->
	<footer
		class="absolute z-30 flex items-center justify-between bg-black/85 backdrop-blur-md border border-white/20 shadow-2xl transition-all
			{isLandscape 
				? 'right-6 top-4 bottom-4 w-24 flex-col py-5 px-2 rounded-3xl' 
				: 'bottom-7 sm:bottom-9 left-4 right-4 h-26 flex-col px-5 pb-3 pt-2 rounded-3xl'}"
	>
		<!-- 렌즈 퀵 스위처 버튼들 -->
		<div class="flex items-center justify-center gap-2 {isLandscape ? 'flex-col' : 'flex-row mb-1.5'}">
			{#if availableCameras.length > 0}
				{#each availableCameras.slice(0, 3) as cam, idx}
					<button
						onclick={() => onSelectCamera(cam.deviceId)}
						class="rounded-full px-3 py-1 text-[11px] font-black transition-all {selectedCameraId === cam.deviceId ? 'bg-amber-400 text-black shadow-md scale-105' : 'bg-white/10 text-white/70 hover:bg-white/20'}"
					>
						{cam.label ? (cam.label.includes('front') ? '셀피' : `${idx + 1}x`) : `${idx + 1}x`}
					</button>
				{/each}
			{/if}
		</div>

		<!-- 메인 셔터 & 갤러리 & 회전 버튼 -->
		<div class="flex items-center justify-around w-full {isLandscape ? 'flex-col gap-3' : 'flex-row'}">
			<!-- 좌측/상단: 최근 갤러리 썸네일 & 업로드 뱃지 -->
			<div class="flex items-center justify-center w-14">
				{#if capturedGallery.length > 0}
					<button
						onclick={() => (selectedPhotoModal = capturedGallery[0].url)}
						class="relative h-12 w-12 overflow-hidden rounded-2xl border-2 border-white/40 shadow-md active:scale-95 transition"
						title="최근 사진 보기"
					>
						<img src={capturedGallery[0].url} alt="Recent" class="h-full w-full object-cover" />
						{#if capturedGallery[0].uploaded}
							<div class="absolute bottom-0 inset-x-0 bg-sky-500/90 text-[8px] font-black text-center text-white py-0.2">
								CLOUD
							</div>
						{:else if /** @type {any} */ (capturedGallery[0]).queued}
							<div class="absolute bottom-0 inset-x-0 bg-amber-500/95 text-[8px] font-black text-center text-black py-0.2">
								우체통
							</div>
						{/if}
					</button>
				{:else}
					<div class="h-12 w-12 rounded-2xl border border-dashed border-white/20 flex items-center justify-center text-white/30">
						<Icon icon="ph:image-square-bold" class="text-xl" />
					</div>
				{/if}
			</div>

			<!-- 중앙: 대형 프로 셔터 버튼 (찰칵!) -->
			<button
				onclick={requestCapture}
				disabled={!isCameraOn || isCountingDown}
				class="group relative flex h-18 w-18 items-center justify-center rounded-full border-4 border-white/90 p-1 shadow-[0_0_25px_rgba(255,255,255,0.4)] transition active:scale-90 disabled:opacity-50"
				title="사진 촬영"
			>
				<div class="h-full w-full rounded-full bg-white transition group-hover:scale-95 group-active:bg-rose-500"></div>
			</button>

			<!-- 우측/하단: 전면/후면 회전 버튼 -->
			<div class="flex items-center justify-center w-14">
				<button
					onclick={toggleFacingMode}
					class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
					title="전면/후면 전환"
				>
					<Icon icon="ph:camera-rotate-bold" class="text-2xl" />
				</button>
			</div>
		</div>
	</footer>

	<!-- ----------------------------------------------------------------- -->
	<!-- 🎛️ 풀옵션 세부 설정 모달 (웹페이지 업로드 옵션 & 히스토리 추가) -->
	<!-- ----------------------------------------------------------------- -->
	{#if showSettingsPanel}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 pb-12 backdrop-blur-md"
			onclick={(e) => { if (e.target === e.currentTarget) showSettingsPanel = false; }}
		>
			<div class="w-full max-w-sm rounded-3xl border border-white/20 bg-slate-900 p-5 shadow-2xl space-y-4 max-h-[84dvh] overflow-y-auto">
				<!-- 헤더 -->
				<div class="flex items-center justify-between border-b border-white/10 pb-3">
					<h4 class="text-base font-black text-white flex items-center gap-2">
						<Icon icon="ph:camera-gear-fill" class="text-blue-400 text-xl" />
						카메라 풀옵션 설정
					</h4>
					<button
						onclick={() => (showSettingsPanel = false)}
						class="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-white"
					>
						✕
					</button>
				</div>

				<!-- 1. 화질 해상도 -->
				<div>
					<span class="text-xs font-bold text-slate-400 block mb-2 uppercase">1. 화질 해상도 선택</span>
					<div class="grid grid-cols-2 gap-2">
						{#each Object.entries(resolutionPresets) as [key, val]}
							<button
								onclick={() => onSelectResolution(key)}
								class="rounded-xl p-2.5 text-left border transition {selectedResolution === key ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/5 text-slate-300 border-white/10'}"
							>
								<div class="font-black text-xs">{val.label}</div>
								<div class="text-[10px] opacity-70 font-mono">{val.width} x {val.height}</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- 2. 화면 맞춤 모드 (Cover vs Contain) -->
				<div>
					<span class="text-xs font-bold text-slate-400 block mb-2 uppercase">2. 화면 맞춤 (Fit Mode)</span>
					<div class="grid grid-cols-2 gap-2">
						<button
							onclick={() => (fitMode = 'cover')}
							class="rounded-xl py-2.5 text-xs font-black transition border {fitMode === 'cover' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-white/5 text-slate-300 border-white/10'}"
						>
							꽉 채움 (Cover)
						</button>
						<button
							onclick={() => (fitMode = 'contain')}
							class="rounded-xl py-2.5 text-xs font-black transition border {fitMode === 'contain' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-white/5 text-slate-300 border-white/10'}"
						>
							원본 전체 (Contain)
						</button>
					</div>
				</div>

				<!-- 3. 컬러 필터 (원본 고정 disabled 처리 - 추후 활성화 가능) -->
				<div class="opacity-70">
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-bold text-slate-400 uppercase">3. 실시간 컬러 필터</span>
						<span class="text-[10px] text-slate-500 font-bold bg-white/5 px-2 py-0.5 rounded-md">비활성화됨 (원본 고정)</span>
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each [
							{ key: 'none', label: '원본 (기본)' },
							{ key: 'vivid', label: '선명' },
							{ key: 'mono', label: '흑백' },
							{ key: 'sepia', label: '세피아' },
							{ key: 'night', label: '야간' }
						] as f}
							<button
								disabled
								class="rounded-xl px-3 py-1.5 text-xs font-bold border cursor-not-allowed transition {f.key === 'none' ? 'bg-purple-900/50 text-purple-200 border-purple-500/50' : 'bg-white/5 text-slate-600 border-white/5'}"
								title="필터는 현재 원본으로 고정되어 있습니다."
							>
								{f.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- 4. 내 파일함 업로드 & 저장 & 사운드 스위치 -->
				<div class="space-y-3 pt-3 border-t border-white/10">
					<span class="text-xs font-bold text-slate-400 block uppercase">4. 저장 및 내 파일함 연동 옵션</span>
					
					<!-- 내 파일함 자동 업로드 스위치 -->
					<div class="flex items-center justify-between rounded-xl bg-sky-950/40 border border-sky-500/30 p-2.5">
						<div class="flex items-center gap-2">
							<Icon icon="ph:cloud-arrow-up-fill" class="text-lg text-sky-400" />
							<div>
								<div class="text-xs font-black text-white">촬영 즉시 내 파일함(WEBCAM)으로 업로드</div>
								<div class="text-[10px] text-sky-200/70">
									{#if auth.user}
										보관 경로: USERS/{auth.user.id}/WEBCAM ({auth.user.username})
									{:else}
										<span class="text-rose-400 font-bold">⚠️ 로그인 필요 (비로그인 상태)</span>
									{/if}
								</div>
							</div>
						</div>
						<input type="checkbox" bind:checked={autoUpload} class="toggle toggle-info toggle-sm" />
					</div>

					<!-- 스마트폰 기기 자동 저장 스위치 -->
					<div class="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-2.5">
						<div class="flex items-center gap-2">
							<Icon icon="ph:download-simple-bold" class="text-lg text-emerald-400" />
							<div>
								<div class="text-xs font-black text-white">스마트폰에 자동 다운로드</div>
								<div class="text-[10px] text-slate-400">촬영 즉시 기기 갤러리에 파일 저장</div>
							</div>
						</div>
						<input type="checkbox" bind:checked={autoSave} class="toggle toggle-success toggle-sm" />
					</div>

					<!-- 셔터 사운드 -->
					<div class="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-2.5">
						<div class="flex items-center gap-2">
							<Icon icon="ph:speaker-high-bold" class="text-lg text-amber-400" />
							<div>
								<div class="text-xs font-black text-white">찰칵 셔터 사운드</div>
								<div class="text-[10px] text-slate-400">Web Audio API 칩셋 합성음</div>
							</div>
						</div>
						<input type="checkbox" bind:checked={shutterSound} class="toggle toggle-warning toggle-sm" />
					</div>
				</div>

				<!-- 5. 최근 내 파일함 업로드 이력 -->
				{#if uploadedHistory.length > 0}
					<div class="pt-3 border-t border-white/10">
						<span class="text-xs font-bold text-sky-400 block mb-2 uppercase">📁 최근 내 파일함 업로드 이력 ({uploadedHistory.length})</span>
						<div class="space-y-1.5 max-h-32 overflow-y-auto pr-1">
							{#each uploadedHistory as up}
								<div class="flex items-center justify-between rounded-lg bg-black/40 border border-white/10 p-2 text-[11px]">
									<div class="flex items-center gap-2 truncate">
										<img src={up.thumbUrl} alt="Thumb" class="h-7 w-7 rounded object-cover shrink-0" />
										<div class="truncate">
											<div class="font-bold text-white truncate">{up.name}</div>
											<div class="text-[9px] text-slate-400 font-mono truncate">{up.serverPath}</div>
										</div>
									</div>
									<button
										onclick={() => copyToClipboard(up.serverPath, '내 파일함 경로')}
										class="rounded bg-sky-600 px-2 py-1 text-[10px] font-black text-white hover:bg-sky-500 shrink-0 ml-2"
									>
										복사
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<button
					onclick={() => (showSettingsPanel = false)}
					class="w-full rounded-2xl bg-white py-3 text-xs font-black text-black hover:bg-slate-200 active:scale-95 transition mt-2"
				>
					확인 및 닫기
				</button>
			</div>
		</div>
	{/if}

	<!-- ----------------------------------------------------------------- -->
	<!-- 🖼️ 촬영 사진 전체화면 확대 모달 (내 파일함 업로드 버튼 완비) -->
	<!-- ----------------------------------------------------------------- -->
	{#if selectedPhotoModal}
		{@const currentPhoto = capturedGallery.find((p) => p.url === selectedPhotoModal)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-black/95 p-4 pb-12 backdrop-blur-md"
			onclick={(e) => { if (e.target === e.currentTarget) selectedPhotoModal = null; }}
		>
			<button
				onclick={() => (selectedPhotoModal = null)}
				class="absolute top-4 right-4 btn btn-circle btn-ghost btn-md text-white text-xl"
			>
				✕
			</button>

			<div class="relative max-h-[70vh] max-w-full overflow-hidden rounded-3xl border border-white/20 shadow-2xl">
				<img src={selectedPhotoModal} alt="Preview" class="max-h-[65vh] w-auto object-contain" />
				{#if currentPhoto?.uploaded}
					<div class="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-sky-600/90 px-3 py-1 text-xs font-black text-white shadow-md backdrop-blur-xs">
						<Icon icon="ph:check-circle-fill" class="text-sm" />
						내 파일함 저장 완료
					</div>
				{/if}
			</div>

			<!-- 하단 액션 버튼들 (기기 저장 & 내 파일함 업로드) -->
			<div class="mt-5 flex flex-wrap items-center justify-center gap-2.5">
				<!-- 1. 스마트폰 기기 저장 -->
				<a
					href={selectedPhotoModal}
					download={currentPhoto?.fileName || "jeju_camera_download.jpg"}
					class="btn btn-sm rounded-xl bg-slate-800 text-white font-black hover:bg-slate-700 border border-white/20"
				>
					<Icon icon="ph:download-simple-bold" class="text-base" />
					스마트폰 저장
				</a>

				<!-- 2. 내 파일함으로 업로드 버튼 -->
				{#if currentPhoto?.uploaded}
					<button
						onclick={() => copyToClipboard(currentPhoto.serverUrl || '', '내 파일함 경로')}
						class="btn btn-sm rounded-xl bg-sky-600 text-white font-black hover:bg-sky-500 shadow-md"
					>
						<Icon icon="ph:copy-bold" class="text-base" />
						파일함 경로 복사
					</button>
				{:else}
					<button
						onclick={() => uploadPhotoToServer(selectedPhotoModal, currentPhoto?.fileName)}
						disabled={isUploading}
						class="btn btn-sm rounded-xl bg-blue-600 text-white font-black hover:bg-blue-500 shadow-md disabled:opacity-50"
					>
						{#if isUploading}
							<span class="loading loading-spinner loading-xs"></span>
							업로드 중...
						{:else}
							<Icon icon="ph:cloud-arrow-up-fill" class="text-base" />
							내 파일함에 업로드
						{/if}
					</button>
				{/if}

				<!-- 3. 모달 닫기 -->
				<button
					onclick={() => (selectedPhotoModal = null)}
					class="btn btn-sm btn-ghost rounded-xl text-slate-300 hover:text-white"
				>
					닫기
				</button>
			</div>
		</div>
	{/if}

</div>
