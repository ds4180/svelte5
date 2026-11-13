/**
 * ============================================================================
 * [미니앱 통합 액션 피드 전역 룬 스토어 (src/lib/runes/miniapps.svelte.ts)]
 * ============================================================================
 * 💡 이 파일의 역할:
 * 메모, 알람, 지시사항, 메시징, 전사알림의 단일 DB(miniapp_items) 데이터를
 * 백엔드 REST API 및 WebSocket과 1:1 동기화하여 상단 헤더 뱃지와 슬라이더에 실시간 공급합니다.
 */

import { auth } from './auth.svelte';
import { websocket } from './websocket.svelte';
import * as api from '$lib/api/miniapp';
import type { MiniappCounts, MiniappItem, MiniappQueryParams } from '$lib/api/miniapp';

export interface MiniappFeedItem extends MiniappItem {
	type?: string;
	is_done?: boolean;
}

class MiniappStore {
	items = $state<MiniappFeedItem[]>([]);
	loading = $state<boolean>(false);

	serverCounts = $state<MiniappCounts>({
		NOTIFICATION: 0,
		INSTRUCTION: 0,
		MESSAGE: 0,
		MEMO: 0,
		ALARM: 0,
		TOTAL: 0
	});

	constructor() {
		if (typeof window !== 'undefined') {
			websocket.addMessageListener((msg: any) => {
				if (
					auth.isAuthenticated &&
					(msg?.type === 'MINIAPP_UPDATE' || msg?.type === 'ALERT_BROADCAST')
				) {
					console.log('🔔 [MiniappStore] 실시간 알림 신호 수신 -> 데이터 자동 동기화');
					this.refresh();
				}
			});
		}
	}

	/**
	 * 🧹 미인증/로그아웃 시 스토어 상태 초기화
	 */
	reset(): void {
		this.items = [];
		this.loading = false;
		this.serverCounts = {
			NOTIFICATION: 0,
			INSTRUCTION: 0,
			MESSAGE: 0,
			MEMO: 0,
			ALARM: 0,
			TOTAL: 0
		};
	}

	/**
	 * 🔄 카운트 및 피드 목록 전체 갱신 (인증된 경우에만 호출)
	 */
	async refresh(): Promise<void> {
		if (!auth.isAuthenticated) {
			this.reset();
			return;
		}
		await Promise.all([this.loadCounts(), this.loadItems()]);
	}

	/**
	 * 📊 뱃지용 실시간 미결 건수 로드
	 */
	async loadCounts(): Promise<void> {
		if (!auth.isAuthenticated) return;
		try {
			const res = await api.getMiniappCounts();
			if (res) this.serverCounts = res;
		} catch {
			// 비로그인 상태 등에서는 조용히 무시
		}
	}

	/**
	 * 📋 미니앱 액션 피드 목록 로드
	 */
	async loadItems(params: MiniappQueryParams = {}): Promise<void> {
		if (!auth.isAuthenticated) return;
		this.loading = true;
		try {
			const res = await api.getMiniappItems(params);
			if (Array.isArray(res)) {
				this.items = res.map((item) => ({
					...item,
					type: item.category,
					is_done: item.status === 'COMPLETED'
				}));
			}
		} catch (e) {
			console.error('❌ [MiniappStore] 피드 로딩 실패:', e);
		} finally {
			this.loading = false;
		}
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
			await this.loadCounts();
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
			await this.loadCounts();
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
