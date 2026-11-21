/**
 * ============================================================================
 * [미니앱 통합 액션 피드 전역 룬 스토어 (src/lib/runes/miniapps.svelte.ts)]
 * ============================================================================
 * 💡 경량·보장 설계:
 * - 실시간 WebSocket 브로드캐스트마다 전 클라이언트가 동시 폴링하는 부하(Thundering Herd)를 제거했습니다.
 * - /api/v1/miniapps/summary 단일 통합 API + 2분(120초) TTL 캐시로 페이지 이동 시 중복 호출을 막습니다.
 * - countsLoaded / itemsLoaded / error 상태 머신을 제공해 미로딩 시 가짜 100% 표시를 차단하고,
 *   인증 컨텍스트와 독립적으로 안전 재시도(1회)를 통해 로딩 완료를 보장합니다.
 */

import { auth } from './auth.svelte';
import { websocket } from './websocket.svelte';
import * as api from '$lib/api/miniapp';
import type { MiniappCounts, MiniappItem, MiniappQueryParams, MiniappSummary } from '$lib/api/miniapp';
import { formatApiError } from '$lib/utils/error';

export interface MiniappFeedItem extends MiniappItem {
	type?: string;
	is_done?: boolean;
}

const EMPTY_COUNTS: MiniappCounts = {
	NOTIFICATION: 0,
	INSTRUCTION: 0,
	MESSAGE: 0,
	MEMO: 0,
	ALARM: 0,
	TOTAL: 0
};

const CACHE_TTL_MS = 120_000; // 2분 TTL (비실시간 운영 기준 부하 절감)

function mapItems(rawItems: MiniappItem[]): MiniappFeedItem[] {
	return (rawItems || []).map((item) => ({
		...item,
		type: item.category,
		is_done: item.status === 'COMPLETED'
	}));
}

class MiniappStore {
	items = $state<MiniappFeedItem[]>([]);
	loading = $state<boolean>(false);
	countsLoaded = $state<boolean>(false);
	itemsLoaded = $state<boolean>(false);
	error = $state<string | null>(null);

	serverCounts = $state<MiniappCounts>({ ...EMPTY_COUNTS });

	private lastCountsAt = 0;
	private lastItemsAt = 0;
	private dirty = false;
	private wsSyncTimer: ReturnType<typeof setTimeout> | null = null;
	private countsInFlight: Promise<void> | null = null;
	private itemsInFlight: Promise<void> | null = null;
	private summaryInFlight: Promise<void> | null = null;

	constructor() {
		if (typeof window !== 'undefined') {
			// 1. WS 신호 수신 시:
			//    - 비활성 탭이면 dirty=true만 마킹 (백그라운드 API 호출 0건)
			//    - 현재 보고 있는 활성 탭이면 1.5~4초 랜덤 지터 디바운스로 1회 자동 동기화 (동시 폭주 분산)
			websocket.addMessageListener((msg: any) => {
				if (msg?.type === 'MINIAPP_UPDATE' || msg?.type === 'ALERT_BROADCAST') {
					this.dirty = true;
					if (document.visibilityState === 'visible') {
						this.scheduleDirtySync();
					}
				}
			});

			// 2. 다른 탭/앱에서 복귀 시 dirty이거나 TTL 만료면 즉시 자동 동기화 (F5 불필요)
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && auth.isAuthenticated) {
					this.syncIfStale();
				}
			});
		}
	}

	private scheduleDirtySync(): void {
		if (this.wsSyncTimer) {
			clearTimeout(this.wsSyncTimer);
		}
		const jitterMs = 1500 + Math.floor(Math.random() * 2500);
		this.wsSyncTimer = setTimeout(() => {
			this.wsSyncTimer = null;
			if (!auth.isAuthenticated || !this.dirty) return;
			if (this.itemsLoaded) {
				this.ensureSummaryLoaded(true);
			} else {
				this.ensureCountsLoaded(true);
			}
		}, jitterMs);
	}

	syncIfStale(authenticated = auth.isAuthenticated): void {
		if (!authenticated) return;
		if (this.itemsLoaded) {
			this.ensureSummaryLoaded(true);
		} else {
			this.ensureCountsLoaded(true);
		}
	}

	/**
	 * 🧹 미인증/로그아웃 시 스토어 상태 초기화
	 */
	reset(): void {
		if (this.wsSyncTimer) {
			clearTimeout(this.wsSyncTimer);
			this.wsSyncTimer = null;
		}
		this.items = [];
		this.loading = false;
		this.countsLoaded = false;
		this.itemsLoaded = false;
		this.error = null;
		this.lastCountsAt = 0;
		this.lastItemsAt = 0;
		this.dirty = false;
		this.countsInFlight = null;
		this.itemsInFlight = null;
		this.summaryInFlight = null;
		this.serverCounts = { ...EMPTY_COUNTS };
	}

	/**
	 * 💧 SSR 선조회 데이터를 스토어에 즉시 주입 (초기 깜빡임·지연 제거)
	 */
	hydrateSummary(summary: MiniappSummary | null | undefined): void {
		if (!summary || !summary.counts || !Array.isArray(summary.items)) return;
		this.serverCounts = summary.counts;
		this.items = mapItems(summary.items);
		this.countsLoaded = true;
		this.itemsLoaded = true;
		this.error = null;
		const now = Date.now();
		this.lastCountsAt = now;
		this.lastItemsAt = now;
		this.dirty = false;
	}

	/**
	 * 🛡️ 뱃지 카운트만 보장 로드 (레이아웃에서 TTL 이내 중복 호출 생략)
	 */
	async ensureCountsLoaded(authenticated = auth.isAuthenticated): Promise<void> {
		if (!authenticated) {
			this.reset();
			return;
		}
		const fresh = !this.dirty && this.countsLoaded && Date.now() - this.lastCountsAt < CACHE_TTL_MS;
		if (fresh) return;
		await this.loadCounts(authenticated);
	}

	/**
	 * 🛡️ 카운트 + 피드 목록 단일 통합 보장 로드 (랜딩·대시보드·피드 전용, 실패 시 1회 안전 재시도)
	 */
	async ensureSummaryLoaded(authenticated = auth.isAuthenticated, force = false): Promise<void> {
		if (!authenticated) {
			this.reset();
			return;
		}
		const fresh =
			!force &&
			!this.dirty &&
			this.itemsLoaded &&
			Date.now() - this.lastItemsAt < CACHE_TTL_MS;
		if (fresh) return;

		if (this.summaryInFlight) return this.summaryInFlight;

		this.summaryInFlight = (async () => {
			this.loading = true;
			this.error = null;
			let lastErr: any = null;
			for (let attempt = 0; attempt < 2; attempt++) {
				try {
					const res = await api.getMiniappSummary();
					if (res && res.counts && Array.isArray(res.items)) {
						this.serverCounts = res.counts;
						this.items = mapItems(res.items);
						this.countsLoaded = true;
						this.itemsLoaded = true;
						this.error = null;
						const now = Date.now();
						this.lastCountsAt = now;
						this.lastItemsAt = now;
						this.dirty = false;
						lastErr = null;
						break;
					}
				} catch (e) {
					lastErr = e;
					if (attempt === 0) {
						await new Promise((r) => setTimeout(r, 1200));
					}
				}
			}
			if (lastErr) {
				this.error = formatApiError(lastErr, '요청 현황을 불러오지 못했습니다.');
			}
			this.loading = false;
			this.summaryInFlight = null;
		})();

		return this.summaryInFlight;
	}

	/**
	 * 🔄 명시적 강제 새로고침 (사용자 [새로고침] 버튼 및 변경 후 호출)
	 */
	async refresh(): Promise<void> {
		await this.ensureSummaryLoaded(true, true);
	}

	/**
	 * 📊 뱃지용 미결 건수 로드 (중복 동시 호출 병합)
	 */
	async loadCounts(authenticated = auth.isAuthenticated): Promise<void> {
		if (!authenticated) return;
		if (this.countsInFlight) return this.countsInFlight;
		if (this.summaryInFlight) return this.summaryInFlight;

		this.countsInFlight = (async () => {
			try {
				const res = await api.getMiniappCounts();
				if (res) {
					this.serverCounts = res;
					this.countsLoaded = true;
					this.lastCountsAt = Date.now();
					this.dirty = false;
				}
			} catch {
				// 뱃지 로드 실패 시 기존 값 유지
			} finally {
				this.countsInFlight = null;
			}
		})();

		return this.countsInFlight;
	}

	/**
	 * 📋 미니앱 액션 피드 목록 로드 (파라미터 필터 조회 호환용)
	 */
	async loadItems(params: MiniappQueryParams = {}): Promise<void> {
		const isDefaultQuery = Object.keys(params).length === 0;
		if (isDefaultQuery) {
			await this.ensureSummaryLoaded(true, true);
			return;
		}
		if (this.itemsInFlight) return this.itemsInFlight;

		const task = (async () => {
			this.loading = true;
			this.error = null;
			try {
				const res = await api.getMiniappItems(params);
				if (Array.isArray(res)) {
					this.items = mapItems(res);
					this.itemsLoaded = true;
					this.lastItemsAt = Date.now();
				}
			} catch (e) {
				this.error = formatApiError(e, '피드를 불러오지 못했습니다.');
			} finally {
				this.loading = false;
				this.itemsInFlight = null;
			}
		})();

		this.itemsInFlight = task;
		return task;
	}

	/**
	 * 새 메모, 알람, 메시지, 지시사항 등록
	 */
	async addItem(
		category: string,
		content: string,
		extra: Record<string, any> = {}
	): Promise<MiniappItem> {
		try {
			const payload = {
				category,
				content,
				title: extra.title || null,
				receiver_id: extra.receiver_id || null,
				target_time: extra.target_time || null,
				link: extra.link || null,
				extra_payload: extra.extra_payload || {}
			};
			const created = await api.createMiniappItem(payload);
			await this.refresh();
			return created;
		} catch (e) {
			console.error('❌ [MiniappStore] 아이템 생성 실패:', e);
			throw e;
		}
	}

	/**
	 * 상태 변경 (지시사항 완료, 메모 완료 등)
	 */
	async updateItem(id: number, data: Record<string, any>): Promise<void> {
		try {
			let status = data.status;
			if (data.is_done !== undefined) {
				status = data.is_done ? 'COMPLETED' : 'PENDING';
			}

			await api.updateMiniappItem(id, {
				status,
				title: data.title,
				content: data.content,
				target_time: data.target_time,
				extra_payload: data.extra_payload
			});

			const idx = this.items.findIndex((i) => i.id === id);
			if (idx !== -1) {
				this.items[idx] = {
					...this.items[idx],
					...data,
					status: status || this.items[idx].status,
					is_done: status === 'COMPLETED'
				};
			}
			await this.loadCounts(true);
		} catch (e) {
			console.error('❌ [MiniappStore] 아이템 갱신 실패:', e);
			await this.refresh();
		}
	}

	/**
	 * 아이템 삭제 (Soft Delete 반영)
	 */
	async deleteItem(id: number): Promise<boolean> {
		try {
			await api.deleteMiniappItem(id);
			this.items = this.items.filter((i) => i.id !== id);
			await this.loadCounts(true);
			return true;
		} catch (e) {
			console.error('❌ [MiniappStore] 아이템 삭제 실패:', e);
			await this.refresh();
			throw e;
		}
	}

	/**
	 * 🔴 헤더 및 슬라이더용 미결 뱃지 카운트 게터
	 */
	get counts(): MiniappCounts {
		return this.serverCounts;
	}
}

export const miniappStore = new MiniappStore();
