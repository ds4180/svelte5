/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * ============================================================================
 * [SvelteKit 공식 표준 서비스 워커 (src/service-worker.ts)]
 * ============================================================================
 * 💡 아키텍처 (SvelteKit Official Standard):
 * 1. `$service-worker` 모듈 연동:
 *    - `build`: Vite 프로덕션 빌드 시 생성되는 전사 모든 페이지/라우트의 JS·CSS 번들 목록
 *    - `files`: `static/` 폴더 내 정적 자산(아이콘, manifest.json 등) 목록
 *    - `version`: 빌드 시점 고유 해시 (배포 시 구버전 캐시 자동 파기 보장)
 * 2. 정석 캐싱 전략:
 *    - `ASSETS` (`build` + `files`): 설치(install) 시점에 100% 사전 캐싱 후 Cache-First 즉시 제공
 *    - 일반 페이지/문서 요청: Network-First 수행 후 오프라인 시 캐시 복원
 * 3. 웹 푸시(Push) 및 백그라운드 동기화(Background Sync `jeju-outbox-sync`) 통합 전담
 */

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `jeju-cache-${version}`;
const DB_NAME = 'jeju_offline_sync_db';
const DB_VERSION = 2;
const STORE_OUTBOX = 'outbox_queue';

interface OutboxFormEntry {
	key: string;
	value: any;
	fileName?: string;
	fileType?: string;
	buffer?: ArrayBuffer;
}

interface OutboxTask {
	id: string | number;
	method: string;
	url: string;
	isFormData?: boolean;
	formEntries?: OutboxFormEntry[];
	jsonBody?: Record<string, any>;
}

// 사전 캐싱할 전체 자산 목록 (레거시 수동 sw.js 및 SSR 리다이렉트 루트 '/' 제외 + 오프라인 폴백 포함)
const ASSETS = Array.from(
	new Set(['/offline.html', ...build, ...files.filter((f) => !f.endsWith('/sw.js'))])
);
const ASSET_SET = new Set(ASSETS);

// 1. 설치(Install): 빌드된 모든 페이지 청크와 정적 자산을 캐시에 일괄 적재 (dev 환경에서는 캐싱 생략)
sw.addEventListener('install', (event: ExtendableEvent) => {
	async function addFilesToCache() {
		if (build.length === 0) return;
		const cache = await caches.open(CACHE);
		if (ASSETS.length > 0) {
			await cache.addAll(ASSETS);
		}
	}

	event.waitUntil(addFilesToCache().then(() => sw.skipWaiting()));
});

// 2. 활성화(Activate): 이전 빌드 버전의 낡은 캐시를 전수 삭제하고 즉시 제어권 획득
sw.addEventListener('activate', (event: ExtendableEvent) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			// 개발 환경(build.length === 0)이거나 이전 버전 캐시인 경우 모두 삭제
			if (build.length === 0 || key !== CACHE) {
				await caches.delete(key);
			}
		}
	}

	event.waitUntil(deleteOldCaches().then(() => sw.clients.claim()));
});

// 3. 네트워크 요청 제어(Fetch): SvelteKit 공식 표준 전략
// 💡 [정석 아키텍처] Vite 개발 서버(dev) 환경에서는 build 배열이 비어 있으므로,
// fetch 이벤트 리스너 자체를 등록하지 않아 브라우저가 일반 네트워크/HMR 요청 시 서비스 워커를 아예 거치지 않도록 보장합니다.
if (build.length > 0) {
	sw.addEventListener('fetch', (event: FetchEvent) => {
		if (event.request.method !== 'GET') return;

		const url = new URL(event.request.url);

		// 동일 출처가 아니거나, 백엔드 API(/api) 및 실시간 웹소켓(/ws)은 서비스 워커 캐시에서 제외
		if (
			url.origin !== sw.location.origin ||
			url.pathname.startsWith('/api') ||
			url.pathname.startsWith('/ws')
		) {
			return;
		}

		async function respond(): Promise<Response> {
			const cache = await caches.open(CACHE);

			// [A] 빌드된 정적 자산(build + files)은 설치 시 이미 캐싱되었으므로 Cache-First로 즉시 반환
			if (ASSET_SET.has(url.pathname)) {
				const cachedAsset = await cache.match(url.pathname);
				if (cachedAsset) {
					return cachedAsset;
				}
			}

			// [B] SSR HTML 문서(navigate) / version.json / __data.json 은 절대 캐시하지 않고 네트워크 직통 처리
			//     (오프라인 navigate 실패 시에만 정적 /offline.html 폴백 -> HTML-JS 버전 스큐/하이드레이션 불일치 방지)
			if (
				event.request.mode === 'navigate' ||
				url.pathname === '/_app/version.json' ||
				url.pathname.endsWith('/__data.json')
			) {
				try {
					return await fetch(event.request);
				} catch (err) {
					if (event.request.mode === 'navigate') {
						const offlinePage = await cache.match('/offline.html');
						if (offlinePage) {
							return offlinePage;
						}
					}
					throw err;
				}
			}

			// [C] 그 외 정적/공개 GET 요청은 Network-First 수행 (HTML 응답은 캐시 오염 방지를 위해 제외)
			try {
				const response = await fetch(event.request);

				if (!(response instanceof Response)) {
					throw new Error('Invalid response from fetch');
				}

				const contentType = response.headers.get('content-type') || '';
				if (response.status === 200 && !contentType.includes('text/html')) {
					cache.put(event.request, response.clone());
				}

				return response;
			} catch (err) {
				const cachedResponse =
					(await cache.match(event.request)) ||
					(await cache.match(event.request, { ignoreSearch: true }));

				if (cachedResponse) {
					return cachedResponse;
				}

				throw err;
			}
		}

		event.respondWith(respond());
	});
}

// 3-1. 클라이언트 메시지 처리
// - CLEAR_USER_CACHE: 로그아웃 시 정적 자산 외 런타임 캐시 삭제
const STATIC_ASSET_SET = new Set(['/offline.html', ...build, ...files]);

sw.addEventListener('message', (event: ExtendableMessageEvent) => {
	if (event.data?.type !== 'CLEAR_USER_CACHE') return;

	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			for (const request of await cache.keys()) {
				if (!STATIC_ASSET_SET.has(new URL(request.url).pathname)) {
					await cache.delete(request);
				}
			}
		})()
	);
});

// 4. 웹 푸시 알림 수신 (Web Push Notification)
sw.addEventListener('push', (event: PushEvent) => {
	let title = '📢 jeju.live';
	const options: NotificationOptions & { vibrate?: number[] } = {
		body: '새로운 알림이 도착했습니다.',
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-192.png',
		data: { url: '/' },
		vibrate: [200, 100, 200]
	};

	try {
		if (event.data) {
			const payload = event.data.json();
			title = payload.title || title;
			options.body = payload.body || options.body;
			options.icon = payload.icon || options.icon;
			options.badge = payload.badge || options.badge;
			if (payload.url) options.data.url = payload.url;
		}
	} catch {
		options.body = event.data ? event.data.text() : options.body;
	}

	event.waitUntil(sw.registration.showNotification(title, options));
});

// 5. 푸시 알림 클릭 시 해당 페이지로 포커스/이동
sw.addEventListener('notificationclick', (event: NotificationEvent) => {
	const clickedNotification = event.notification;
	clickedNotification.close();

	const targetUrl =
		clickedNotification.data && clickedNotification.data.url ? clickedNotification.data.url : '/';

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === targetUrl && 'focus' in client) {
					return client.focus();
				}
			}
			if (sw.clients.openWindow) {
				return sw.clients.openWindow(targetUrl);
			}
		})
	);
});

// 6. OS 레벨 백그라운드 동기화 (Background Sync API - `jeju-outbox-sync`)
sw.addEventListener('sync', (event: any) => {
	if (event.tag === 'jeju-outbox-sync') {
		console.log('🤖 [SW Background Sync] 네트워크 복구 감지 -> 임시 우체통 백그라운드 동기화 시작');
		event.waitUntil(processBackgroundOutbox());
	}
});

/**
 * 서비스 워커가 백그라운드에서 직접 IndexedDB 우체통을 열어 서버로 전송하거나,
 * 열려 있는 클라이언트 탭에 동기화 신호를 전달합니다.
 */
async function processBackgroundOutbox(): Promise<void> {
	const clientList = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
	if (clientList && clientList.length > 0) {
		for (const client of clientList) {
			client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
		}
		return;
	}

	return new Promise((resolve) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => resolve(undefined);
		req.onsuccess = async (event: Event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
				resolve(undefined);
				return;
			}

			const tasks: OutboxTask[] = await new Promise((res) => {
				const tx = db.transaction(STORE_OUTBOX, 'readonly');
				const getAllReq = tx.objectStore(STORE_OUTBOX).getAll();
				getAllReq.onsuccess = () => res(getAllReq.result || []);
				getAllReq.onerror = () => res([]);
			});

			if (tasks.length === 0) {
				resolve(undefined);
				return;
			}

			let sentCount = 0;
			for (const task of tasks) {
				try {
					const fetchOptions: RequestInit = {
						method: task.method,
						credentials: 'include',
						headers: {}
					};

					if (task.isFormData && Array.isArray(task.formEntries)) {
						const form = new FormData();
						for (const entry of task.formEntries) {
							if (entry.buffer && entry.fileName) {
								const fileObj = new File([entry.buffer], entry.fileName, {
									type: entry.fileType || 'image/jpeg'
								});
								form.append(entry.key, fileObj);
							} else if (entry.value instanceof Blob && entry.fileName) {
								const fileObj = new File([entry.value], entry.fileName, {
									type: entry.fileType || entry.value.type || 'image/jpeg'
								});
								form.append(entry.key, fileObj);
							} else {
								form.append(entry.key, entry.value);
							}
						}
						fetchOptions.body = form;
					} else {
						fetchOptions.headers = { 'Content-Type': 'application/json' };
						fetchOptions.body = JSON.stringify(task.jsonBody || {});
					}

					const response = await fetch(task.url, fetchOptions);
					if (response.ok) {
						await new Promise((delRes) => {
							const delTx = db.transaction(STORE_OUTBOX, 'readwrite');
							const delReq = delTx.objectStore(STORE_OUTBOX).delete(task.id);
							delReq.onsuccess = () => delRes(undefined);
							delReq.onerror = () => delRes(undefined);
						});
						sentCount++;
					}
				} catch {
					break;
				}
			}

			if (sentCount > 0 && sw.registration && sw.registration.showNotification) {
				await sw.registration.showNotification('📮 오프라인 동기화 완료', {
					body: `임시 우체통에 보관 중이던 ${sentCount}건의 작업이 서버에 안전하게 등록되었습니다.`,
					icon: '/icons/icon-192.png',
					badge: '/icons/icon-192.png'
				});
			}
			resolve(undefined);
		};
	});
}
