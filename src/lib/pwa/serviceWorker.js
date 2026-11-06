/**
 * ============================================================================
 * [PWA 서비스 워커 클라이언트 유틸 (lib/pwa/serviceWorker.js)]
 * ============================================================================
 * 💡 역할: 서비스 워커 등록/조회 및 사용자 데이터 정리 로직을 한 곳에서 관리합니다.
 *
 * - SW 스크립트: SvelteKit 공식 `src/service-worker.js` → 빌드 시 `/service-worker.js` 로 배포
 * - dev 서버: `$service-worker` 의 build 목록이 비어 있어 캐싱이 무의미하고 HMR 과 충돌하므로
 *   등록하지 않고 기존 등록을 정리합니다. (SvelteKit 문서 권장: dev 에서는 type 'module' 필요)
 */
import { browser, dev } from '$app/environment';

export const SW_URL = '/service-worker.js';

export const VAPID_PUBLIC_KEY =
	'BFo_ZVqvUj1h1Z-wRRsHn9-uJecPXcPqGnDNfEuy6-H16ax9-H_-JTyAH_9gEyLQTD_yxv5dB3cupfG2SCSk62A';

/** 브라우저가 서비스 워커를 지원하는지 여부 */
export const isSwSupported = () => browser && 'serviceWorker' in navigator;

/**
 * Base64URL 형식의 VAPID 공개키를 PushManager 표준 Uint8Array로 변환
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * 앱 기동 시 1회 호출: 서비스 워커 등록
 * - 운영 빌드: classic 모드로 등록 및 전체 오프라인 캐싱 가동
 * - dev 서버: SvelteKit 표준 `{ type: 'module' }`로 등록하여 HMR 충돌 없이 Web Push 구독/수신 지원
 *   (src/service-worker.js 내부에서 build.length === 0 일 때 fetch 캐싱을 자동 우회함)
 * @returns {Promise<ServiceWorkerRegistration | undefined>}
 */
export async function registerServiceWorker() {
	if (!isSwSupported()) return undefined;

	if (dev && 'caches' in window) {
		const keys = await caches.keys();
		await Promise.all(keys.map((k) => caches.delete(k)));
	}

	try {
		return await navigator.serviceWorker.register(SW_URL, {
			type: dev ? 'module' : 'classic'
		});
	} catch (err) {
		console.warn('⚠️ [PWA] Service Worker 등록 실패:', err);
		return undefined;
	}
}

/**
 * 현재 활성화된 SW 등록 정보를 반환 (푸시 구독 등에서 사용)
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function getActiveRegistration() {
	if (!isSwSupported()) return null;
	const existing = await navigator.serviceWorker.getRegistration();
	if (!existing) await registerServiceWorker();
	return navigator.serviceWorker.ready;
}

/**
 * SW 런타임 캐시에서 사용자별 데이터(페이지 HTML, __data.json 등)를 제거하도록 요청
 * (빌드 정적 자산은 유지 → 로그아웃 후에도 앱 셸 오프라인 동작 보장)
 */
export async function clearSwUserCache() {
	if (!isSwSupported()) return;
	const reg = await navigator.serviceWorker.getRegistration();
	reg?.active?.postMessage({ type: 'CLEAR_USER_CACHE' });
}

/**
 * 수동 "강력 새로고침": SW 캐시 전체 삭제 + SW 등록 해제 후 새로고침
 * (빌드 파일명이 해시 기반이므로 HTTP 디스크 캐시를 별도로 건드릴 필요 없음)
 */
export async function hardReset() {
	if (browser && 'caches' in window) {
		const keys = await caches.keys();
		await Promise.all(keys.map((k) => caches.delete(k)));
	}
	if (isSwSupported()) {
		const regs = await navigator.serviceWorker.getRegistrations();
		await Promise.all(regs.map((r) => r.unregister()));
	}
}

const PUSH_SYNC_SESSION_KEY = 'jeju_push_synced_fingerprint';
const PUSH_UNSUB_SESSION_KEY = 'jeju_push_unsubscribed_endpoint';

/**
 * 🔔 [로그인 시 자동 푸시 구독 동기화 및 수동 즉시 구독 (자원 최적화 버전)]
 * - sessionStorage 지문(userId + endpoint) 캐싱을 통해, 이미 현재 세션에서 동기화된 기기는
 *   F5(새로고침)나 탭 이동 시 불필요한 백엔드 API 호출을 100% 생략합니다.
 * - forcePrompt=true(관리자 수동 등록 버튼 등)인 경우에만 캐시를 무시하고 즉시 서버에 재등록합니다.
 * @param {{ forcePrompt?: boolean, userId?: number | string }} [options]
 */
export async function syncPushSubscription(options = {}) {
	if (!browser || !isSwSupported() || !('PushManager' in window) || !('Notification' in window)) {
		return false;
	}

	const performSubscribe = async () => {
		try {
			const reg = await getActiveRegistration();
			if (!reg || !reg.pushManager) return false;

			let subscription = await reg.pushManager.getSubscription();
			if (!subscription) {
				const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
				subscription = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: /** @type {BufferSource} */ (convertedVapidKey)
				});
			}

			if (subscription) {
				const userKey = options.userId ? String(options.userId) : 'auth';
				const fingerprint = `${userKey}:${subscription.endpoint}`;

				// ⚡ [자원 최적화] 수동 강제 등록(forcePrompt)이 아니고, 현재 브라우저 세션에서 이미 동일 계정+기기로 동기화 완료된 경우 네트워크 요청 생략
				if (!options.forcePrompt && sessionStorage.getItem(PUSH_SYNC_SESSION_KEY) === fingerprint) {
					return true;
				}

				const res = await fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(subscription)
				});
				if (res.ok) {
					sessionStorage.setItem(PUSH_SYNC_SESSION_KEY, fingerprint);
					sessionStorage.removeItem(PUSH_UNSUB_SESSION_KEY);
					return true;
				}
			}
		} catch (err) {
			console.warn('⚠️ [PWA Push] 자동 구독 동기화 실패:', err);
		}
		return false;
	};

	if (Notification.permission === 'granted') {
		return await performSubscribe();
	}

	if (Notification.permission === 'default') {
		if (options.forcePrompt) {
			try {
				const perm = await Notification.requestPermission();
				if (perm === 'granted') {
					return await performSubscribe();
				}
			} catch {
				return false;
			}
			return false;
		}

		// 사용자 클릭 이벤트 안에서만 requestPermission()이 허용되므로, 다음 1회 클릭에 자동 연결
		const askOnFirstClick = async () => {
			window.removeEventListener('pointerdown', askOnFirstClick, true);
			try {
				const perm = await Notification.requestPermission();
				if (perm === 'granted') {
					await performSubscribe();
				}
			} catch {
				// ignore
			}
		};
		window.addEventListener('pointerdown', askOnFirstClick, { capture: true, once: true });
	}

	return false;
}

/**
 * 🔕 [로그아웃 시 자동 푸시 구독 해제 (자원 최적화 버전)]
 * - 브라우저의 알림 허용 권한('granted') 자체는 유지하되(재로그인 시 팝업 방지),
 *   백엔드 DB 발송 명단에서 이 기기의 endpoint를 1회 즉시 삭제합니다.
 * - 비로그인 상태에서 페이지를 새로고침할 때 중복 해제 API가 호출되지 않도록 sessionStorage 락으로 방어합니다.
 */
export async function unsubscribePushOnLogout() {
	if (!browser || !isSwSupported() || !('PushManager' in window)) {
		return;
	}
	try {
		// 로그인 동기화 도장 즉시 파기 (다음 로그인 시 다시 1회 등록되도록 보장)
		sessionStorage.removeItem(PUSH_SYNC_SESSION_KEY);

		const reg = await navigator.serviceWorker.getRegistration();
		const subscription = await reg?.pushManager?.getSubscription();
		if (subscription && subscription.endpoint) {
			// ⚡ 이미 비로그인 상태에서 해제 완료된 엔드포인트라면 중복 API 호출 생략
			if (sessionStorage.getItem(PUSH_UNSUB_SESSION_KEY) === subscription.endpoint) {
				return;
			}
			await fetch('/api/push/unsubscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: subscription.endpoint }),
				keepalive: true
			});
			sessionStorage.setItem(PUSH_UNSUB_SESSION_KEY, subscription.endpoint);
		}
	} catch (err) {
		console.warn('⚠️ [PWA Push] 로그아웃 구독 해제 중 예외:', err);
	}
}
