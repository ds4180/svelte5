import { browser } from '$app/environment';
import { toast } from '$lib/runes/toast.svelte';
import { websocket } from '$lib/runes/websocket.svelte';

/**
 * ============================================================================
 * [전사 통합 오프라인 동기화 & 임시 우체통 엔진 (src/lib/runes/offlineSync.svelte.ts)]
 * ============================================================================
 *
 * 💡 핵심 역할 (3단계 Offline-First 아키텍처 코어):
 * 1. [임시 우체통 (Outbox Queue - IndexedDB)]:
 *    - 인터넷이 끊긴 상태에서 사용자가 촬영한 웹카메라 사진(File/Blob), 게시글 작성,
 *      댓글 등록, 미니앱 입력 등 모든 쓰기(POST/PUT/DELETE) 작업을 폰 내부 금고(IndexedDB)에
 *      수 기가바이트까지 유실 없이 영구 보관합니다.
 * 2. [읽기 기억 장치 (GET Response Cache - IndexedDB)]:
 *    - 온라인일 때 조회했던 게시판 목록·본문·프로필 데이터를 기억해 두었다가,
 *      오프라인 상태에서 화면 진입 시 마지막으로 확인한 화면을 0.1초 만에 그대로 복원합니다.
 * 3. [듀얼 하이브리드 자동 동기화 (Auto Replay)]:
 *    - 안드로이드(Background Sync API) + 아이폰/공통(online 이벤트 & 화면 복귀 감지)
 *      2중 트리거를 통해, 인터넷이 다시 연결되는 순간 대기 중이던 작업들을
 *      순서대로(FIFO) 서버로 자동 전송하고 완료 알림을 띄웁니다.
 */

const DB_NAME = 'jeju_offline_sync_db';
const DB_VERSION = 2;
const STORE_OUTBOX = 'outbox_queue';
const STORE_CACHE = 'get_api_cache';

export interface OutboxPendingItem {
	id: number;
	method: string;
	url: string;
	label: string;
	createdAt: string;
	retryCount: number;
}

interface SerializedFormEntry {
	key: string;
	value?: any;
	buffer?: ArrayBuffer;
	fileName?: string;
	fileType?: string;
}

interface OutboxRecord {
	id?: number;
	method: string;
	url: string;
	isFormData: boolean;
	formEntries: SerializedFormEntry[] | null;
	jsonBody: any;
	label: string;
	createdAt: string;
	timestamp: number;
	retryCount: number;
}

function buildDefaultLabel(method: string, url: string, params: any): string {
	if (typeof FormData !== 'undefined' && params instanceof FormData) {
		const file = [...params.values()].find((v) => typeof v === 'object' && v && 'name' in v);
		return `📎 파일 업로드 (${file ? (file as File).name : '첨부파일'})`;
	}
	return `📮 데이터 전송 (${method.toUpperCase()} ${url.split('?')[0]})`;
}

class OfflineSyncManager {
	/** 현재 네트워크 온라인 여부 */
	isOnline = $state<boolean>(true);

	/** 현재 우체통에 대기 중인 작업 수 */
	pendingCount = $state<number>(0);

	/** 우체통 대기 항목 목록 (UI 표시용) */
	pendingItems = $state<OutboxPendingItem[]>([]);

	/** 현재 서버로 자동 재전송(동기화) 진행 중인지 여부 */
	isSyncing = $state<boolean>(false);

	/** 마지막 동기화 완료 시각 */
	lastSyncedAt = $state<string | null>(null);

	/** 내부 초기화 완료 플래그 */
	#initialized = false;

	#db: IDBDatabase | null = null;

	/** IndexedDB 제한 환경(시크릿 모드 등) 대비 인메모리 보조 우체통 */
	#memoryOutbox: OutboxRecord[] = [];

	/**
	 * 1. IndexedDB 데이터베이스 열기 (초기 테이블 자동 생성)
	 */
	async #openDB(): Promise<IDBDatabase | null> {
		if (!browser || typeof indexedDB === 'undefined') return null;
		if (this.#db) {
			if (
				this.#db.objectStoreNames.contains(STORE_OUTBOX) &&
				this.#db.objectStoreNames.contains(STORE_CACHE)
			) {
				return this.#db;
			}
			this.#db.close();
			this.#db = null;
		}

		return new Promise((resolve) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
					const outboxStore = db.createObjectStore(STORE_OUTBOX, {
						keyPath: 'id',
						autoIncrement: true
					});
					outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
				}

				if (!db.objectStoreNames.contains(STORE_CACHE)) {
					db.createObjectStore(STORE_CACHE, { keyPath: 'url' });
				}
			};

			request.onsuccess = (event) => {
				this.#db = (event.target as IDBOpenDBRequest).result;
				resolve(this.#db);
			};

			request.onerror = (event) => {
				console.error('❌ [OfflineSync] IndexedDB 오픈 실패:', event);
				resolve(null);
			};
		});
	}

	/**
	 * 2. 전역 오프라인 동기화 감시자 초기화 (+layout.svelte 에서 1회 호출)
	 */
	async init(): Promise<void> {
		if (!browser || this.#initialized) return;
		this.#initialized = true;

		this.isOnline = navigator.onLine;
		await this.refreshPendingList();

		window.addEventListener('online', () => {
			this.isOnline = true;
			websocket.init();
			console.log('🌐 [OfflineSync] 온라인 복구 감지 -> 우체통 자동 동기화 가동');
			if (this.pendingCount > 0) {
				toast.info(
					`🌐 인터넷이 연결되었습니다. 대기 중인 ${this.pendingCount}건의 작업을 전송합니다...`,
					3000
				);
				this.syncAll();
			} else {
				toast.success('네트워크가 복구되었습니다. 실시간 동기화를 재개합니다.');
			}
		});

		window.addEventListener('offline', () => {
			this.isOnline = false;
			console.log('📴 [OfflineSync] 오프라인 전환 감지 -> 임시 우체통 모드 활성화');
			toast.warning(
				'📴 오프라인 상태입니다. 작성하는 글과 사진은 임시 우체통에 안전하게 보관됩니다.',
				4000
			);
		});

		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && navigator.onLine) {
				this.isOnline = true;
				if (this.pendingCount > 0 && !this.isSyncing) {
					this.syncAll();
				}
			}
		});

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data && event.data.type === 'TRIGGER_OFFLINE_SYNC') {
					console.log('🤖 [OfflineSync] 서비스 워커 동기화 신호 수신');
					this.syncAll();
				}
			});
		}

		if (this.isOnline && this.pendingCount > 0) {
			setTimeout(() => {
				this.syncAll();
			}, 1200);
		}
	}

	/**
	 * 3. 우체통 대기 목록 및 건수 새로고침
	 */
	async refreshPendingList(): Promise<OutboxPendingItem[]> {
		const db = await this.#openDB();
		if (!db) {
			this.pendingCount = this.#memoryOutbox.length;
			this.pendingItems = this.#memoryOutbox.map((r) => ({
				id: r.id || 0,
				method: r.method,
				url: r.url,
				label: r.label,
				createdAt: r.createdAt,
				retryCount: r.retryCount || 0
			}));
			return this.pendingItems;
		}

		return new Promise((resolve) => {
			try {
				const tx = db.transaction(STORE_OUTBOX, 'readonly');
				const store = tx.objectStore(STORE_OUTBOX);
				const req = store.getAll();

				req.onsuccess = () => {
					const rows = [...(req.result || []), ...this.#memoryOutbox];
					this.pendingCount = rows.length;
					this.pendingItems = rows.map((r: any) => ({
						id: r.id,
						method: r.method,
						url: r.url,
						label: r.label,
						createdAt: r.createdAt,
						retryCount: r.retryCount || 0
					}));
					resolve(this.pendingItems);
				};

				req.onerror = () => {
					resolve([]);
				};
			} catch {
				resolve([]);
			}
		});
	}

	/**
	 * 4. 📮 [핵심] 오프라인 쓰기 작업을 임시 우체통(IndexedDB)에 안전하게 보관
	 */
	async enqueue(method: string, url: string, params: any, label?: string): Promise<boolean> {
		this.isOnline = false;
		const isFormData = typeof FormData !== 'undefined' && params instanceof FormData;
		const serializedEntries: SerializedFormEntry[] = [];

		if (isFormData) {
			for (const [key, value] of (params as FormData).entries()) {
				if (typeof Blob !== 'undefined' && value instanceof Blob) {
					const buffer = await value.arrayBuffer();
					const fileName =
						'name' in value && typeof (value as File).name === 'string'
							? (value as File).name
							: `camera_${Date.now()}.jpg`;
					serializedEntries.push({
						key,
						buffer,
						fileName,
						fileType: value.type || 'image/jpeg'
					});
				} else {
					serializedEntries.push({ key, value: String(value) });
				}
			}
		}

		const record: OutboxRecord = {
			method: method.toUpperCase(),
			url,
			isFormData,
			formEntries: isFormData ? serializedEntries : null,
			jsonBody: isFormData ? null : JSON.parse(JSON.stringify(params || {})),
			label: label || buildDefaultLabel(method, url, params),
			createdAt: new Date().toLocaleTimeString('ko-KR'),
			timestamp: Date.now(),
			retryCount: 0
		};

		const db = await this.#openDB();
		if (!db) {
			record.id = Date.now();
			this.#memoryOutbox.push(record);
			await this.refreshPendingList();
			return true;
		}

		return new Promise((resolve) => {
			try {
				const tx = db.transaction(STORE_OUTBOX, 'readwrite');
				const store = tx.objectStore(STORE_OUTBOX);
				const req = store.add(record);

				req.onsuccess = async () => {
					await this.refreshPendingList();

					if ('serviceWorker' in navigator) {
						navigator.serviceWorker.ready
							.then((reg: any) => {
								if ('sync' in reg) {
									reg.sync.register('jeju-outbox-sync').catch(() => {});
								}
							})
							.catch(() => {});
					}

					resolve(true);
				};

				req.onerror = async (err) => {
					console.warn('⚠️ [OfflineSync] IndexedDB 저장 폴백(메모리 우체통 가동):', err);
					record.id = Date.now();
					this.#memoryOutbox.push(record);
					await this.refreshPendingList();
					resolve(true);
				};
			} catch (err) {
				console.warn('⚠️ [OfflineSync] 트랜잭션 폴백(메모리 우체통 가동):', err);
				record.id = Date.now();
				this.#memoryOutbox.push(record);
				this.refreshPendingList().then(() => resolve(true));
			}
		});
	}

	/**
	 * 5. 🚀 [핵심] 우체통에 쌓인 모든 대기 작업을 순서대로(FIFO) 서버로 일괄 전송
	 */
	async syncAll(): Promise<void> {
		if (!browser || this.isSyncing || !navigator.onLine) return;

		const db = await this.#openDB();

		let dbTasks: any[] = [];
		if (db) {
			dbTasks = await new Promise((resolve) => {
				try {
					const tx = db.transaction(STORE_OUTBOX, 'readonly');
					const req = tx.objectStore(STORE_OUTBOX).getAll();
					req.onsuccess = () => resolve(req.result || []);
					req.onerror = () => resolve([]);
				} catch {
					resolve([]);
				}
			});
		}

		const allTasks = [...dbTasks, ...this.#memoryOutbox];

		if (allTasks.length === 0) {
			this.pendingCount = 0;
			this.pendingItems = [];
			return;
		}

		this.isSyncing = true;
		let successCount = 0;
		let failCount = 0;

		for (const task of allTasks) {
			if (!navigator.onLine) {
				this.isOnline = false;
				break;
			}

			try {
				const fetchOptions: RequestInit = {
					method: task.method,
					credentials: 'include',
					headers: {}
				};

				if (task.isFormData && Array.isArray(task.formEntries)) {
					const reconstructedForm = new FormData();
					for (const entry of task.formEntries) {
						if (entry.buffer && entry.fileName) {
							const fileObj = new File([entry.buffer], entry.fileName, {
								type: entry.fileType || 'image/jpeg'
							});
							reconstructedForm.append(entry.key, fileObj);
						} else if (entry.value instanceof Blob && entry.fileName) {
							const fileObj = new File([entry.value], entry.fileName, {
								type: entry.fileType || entry.value.type || 'image/jpeg'
							});
							reconstructedForm.append(entry.key, fileObj);
						} else {
							reconstructedForm.append(entry.key, entry.value);
						}
					}
					fetchOptions.body = reconstructedForm;
				} else {
					fetchOptions.headers = { 'Content-Type': 'application/json' };
					fetchOptions.body = JSON.stringify(task.jsonBody || {});
				}

				const response = await fetch(task.url, fetchOptions);

				if (response.ok) {
					await this.removeItem(task.id);
					successCount++;
				} else if (
					response.status >= 400 &&
					response.status < 500 &&
					response.status !== 408 &&
					response.status !== 429
				) {
					console.warn(`⚠️ [OfflineSync] 작업 영구 거부 (HTTP ${response.status}):`, task.label);
					await this.removeItem(task.id);
					failCount++;
				} else {
					failCount++;
				}
			} catch (networkErr) {
				console.warn('⚠️ [OfflineSync] 전송 중 네트워크 순단:', networkErr);
				failCount++;
				break;
			}
		}

		await this.refreshPendingList();
		this.isSyncing = false;

		if (successCount > 0) {
			this.lastSyncedAt = new Date().toLocaleTimeString('ko-KR');
			toast.success(
				`✅ 오프라인 우체통에 대기 중이던 ${successCount}건의 작업이 서버에 모두 반영되었습니다!`,
				5000
			);
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('jeju:offline-synced', { detail: { successCount } }));
			}
		}

		if (failCount > 0 && navigator.onLine) {
			toast.warning(`⚠️ 일부 작업(${failCount}건) 처리 중 오류가 발생했습니다.`);
		}
	}

	/**
	 * 6. 특정 대기 항목 삭제
	 */
	async removeItem(id: number): Promise<boolean> {
		this.#memoryOutbox = this.#memoryOutbox.filter((item) => item.id !== id);
		const db = await this.#openDB();
		if (!db) {
			await this.refreshPendingList();
			return true;
		}

		return new Promise((resolve) => {
			try {
				const tx = db.transaction(STORE_OUTBOX, 'readwrite');
				const req = tx.objectStore(STORE_OUTBOX).delete(id);
				req.onsuccess = async () => {
					await this.refreshPendingList();
					resolve(true);
				};
				req.onerror = () => resolve(false);
			} catch {
				resolve(false);
			}
		});
	}

	/**
	 * 7. 우체통 전체 비우기
	 */
	async clearOutbox(): Promise<boolean> {
		this.#memoryOutbox = [];
		const db = await this.#openDB();
		if (!db) {
			await this.refreshPendingList();
			toast.info('🧹 임시 우체통 대기열을 모두 비웠습니다.');
			return true;
		}

		return new Promise((resolve) => {
			try {
				const tx = db.transaction(STORE_OUTBOX, 'readwrite');
				const req = tx.objectStore(STORE_OUTBOX).clear();
				req.onsuccess = async () => {
					await this.refreshPendingList();
					toast.info('🧹 임시 우체통 대기열을 모두 비웠습니다.');
					resolve(true);
				};
				req.onerror = () => resolve(false);
			} catch {
				resolve(false);
			}
		});
	}

	/**
	 * 8. 💾 [읽기 기억 장치] 온라인 GET 조회 성공 시 결과 캐싱
	 */
	async saveGetCache(url: string, data: any): Promise<void> {
		if (!browser) return;
		const db = await this.#openDB();
		if (!db) return;

		try {
			const clonedData = JSON.parse(JSON.stringify(data));
			const tx = db.transaction(STORE_CACHE, 'readwrite');
			tx.objectStore(STORE_CACHE).put({
				url,
				data: clonedData,
				updatedAt: Date.now()
			});
		} catch {
			// 직렬화 불가능한 응답은 무시
		}
	}

	/**
	 * 9. 📂 [읽기 기억 장치] 오프라인 시 마지막으로 기억된 GET 결과 꺼내기
	 */
	async loadGetCache(url: string): Promise<any | null> {
		if (!browser) return null;
		const db = await this.#openDB();
		if (!db) return null;

		return new Promise((resolve) => {
			const tx = db.transaction(STORE_CACHE, 'readonly');
			const req = tx.objectStore(STORE_CACHE).get(url);
			req.onsuccess = () => {
				resolve(req.result ? req.result.data : null);
			};
			req.onerror = () => resolve(null);
		});
	}

	/**
	 * 10. 🔒 [비로그인/세션만료 정리] 기기에 남은 이전 사용자의 읽기 캐시(GET 응답)만 조용히 삭제
	 */
	async clearUserData({ includeOutbox = false }: { includeOutbox?: boolean } = {}): Promise<void> {
		if (!browser) return;
		if (includeOutbox) {
			this.#memoryOutbox = [];
		}
		const db = await this.#openDB();
		if (db) {
			const stores = includeOutbox ? [STORE_OUTBOX, STORE_CACHE] : [STORE_CACHE];
			await new Promise<void>((resolve) => {
				try {
					const tx = db.transaction(stores, 'readwrite');
					for (const name of stores) {
						tx.objectStore(name).clear();
					}
					tx.oncomplete = () => resolve();
					tx.onerror = () => resolve();
					tx.onabort = () => resolve();
				} catch {
					resolve();
				}
			});
		}
		if (includeOutbox) {
			await this.refreshPendingList();
		}
	}
}

export const offlineSync = new OfflineSyncManager();
