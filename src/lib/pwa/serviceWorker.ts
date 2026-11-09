/**
 * ============================================================================
 * [PWA 서비스 워커 클라이언트 유틸 (lib/pwa/serviceWorker.ts)]
 * ============================================================================
 * 💡 역할: 서비스 워커 등록/조회 및 사용자 데이터 정리 로직을 한 곳에서 관리합니다.
 *
 * - SW 스크립트: SvelteKit 공식 `src/service-worker.ts` → 빌드 시 `/service-worker.js` 로 배포
 * - dev 서버: `$service-worker` 의 build 목록이 비어 있어 캐싱이 무의미하고 HMR 과 충돌하므로
 *   등록하지 않고 기존 등록을 정리합니다. (SvelteKit 문서 권장: dev 에서는 type 'module' 필요)
 */
import { browser, dev } from '$app/environment';

export const SW_URL = '/service-worker.js';

export const VAPID_PUBLIC_KEY =
	'BFo_ZVqvUj1h1Z-wRRsHn9-uJecPXcPqGnDNfEuy6-H16ax9-H_-JTyAH_9gEyLQTD_yxv5dB3cupfG2SCSk62A';

/** 브라우저가 서비스 워커를 지원하는지 여부 */
export const isSwSupported = (): boolean => browser && 'serviceWorker' in navigator;

/**
 * Base64URL 형식의 VAPID 공개키를 PushManager 표준 Uint8Array로 변환
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
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
 */
export async function getActiveRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (!isSwSupported()) return null;
	const existing = await navigator.serviceWorker.getRegistration();
	if (!existing) await registerServiceWorker();
	return navigator.serviceWorker.ready;
}

/**
 * SW 런타임 캐시에서 사용자별 데이터(페이지 HTML, __data.json 등)를 제거하도록 요청
 */
export async function clearSwUserCache(): Promise<void> {
	if (!isSwSupported()) return;
	const reg = await navigator.serviceWorker.getRegistration();
	reg?.active?.postMessage({ type: 'CLEAR_USER_CACHE' });
}

/**
 * 수동 "강력 새로고침": SW 캐시 전체 삭제 + SW 등록 해제 후 새로고침
 */
export async function hardReset(): Promise<void> {
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

export interface SyncPushOptions {
	forcePrompt?: boolean;
	userId?: number | string;
}

/**
 * 🔔 [로그인 시 자동 푸시 구독 동기화 및 수동 즉시 구독]
 */
export async function syncPushSubscription(options: SyncPushOptions = {}): Promise<boolean> {
	if (!browser || !isSwSupported() || !('PushManager' in window) || !('Notification' in window)) {
		return false;
	}

	const performSubscribe = async (): Promise<boolean> => {
		try {
			const reg = await getActiveRegistration();
			if (!reg || !reg.pushManager) return false;

			let subscription = await reg.pushManager.getSubscription();
			if (!subscription) {
				const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
				subscription = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: convertedVapidKey as BufferSource
				});
			}

			if (subscription) {
				const userKey = options.userId ? String(options.userId) : 'auth';
				const fingerprint = `${userKey}:${subscription.endpoint}`;

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
 * 🔕 [로그아웃 시 자동 푸시 구독 해제]
 */
export async function unsubscribePushOnLogout(): Promise<void> {
	if (!browser || !isSwSupported() || !('PushManager' in window)) {
		return;
	}
	try {
		sessionStorage.removeItem(PUSH_SYNC_SESSION_KEY);

		const reg = await navigator.serviceWorker.getRegistration();
		const subscription = await reg?.pushManager?.getSubscription();
		if (subscription && subscription.endpoint) {
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
