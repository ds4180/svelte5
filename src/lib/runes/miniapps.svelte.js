/**
 * ============================================================================
 * [미니앱 통합 액션 피드 전역 룬 스토어 (miniapps.svelte.js)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 메모, 알람, 지시사항, 메시징, 전사알림의 단일 DB(miniapp_items) 데이터를
 * 백엔드 REST API 및 WebSocket과 1:1 동기화하여 상단 헤더 뱃지와 슬라이더에 실시간 공급합니다.
 */

import { websocket } from './websocket.svelte.js';
import * as api from '$lib/api/miniapp.js';

class MiniappStore {
	/** @type {any[]} */
	items = $state([]);

	/** @type {boolean} */
	loading = $state(false);

	/** @type {{ NOTIFICATION: number, INSTRUCTION: number, MESSAGE: number, MEMO: number, ALARM: number, TOTAL: number }} */
	serverCounts = $state({
		NOTIFICATION: 0,
		INSTRUCTION: 0,
		MESSAGE: 0,
		MEMO: 0,
		ALARM: 0,
		TOTAL: 0
	});

	constructor() {
		if (typeof window !== 'undefined') {
			// 1. 초기 카운트 및 목록 비동기 로드
			this.refresh();

			// 2. WebSocket 실시간 알림 수신
			websocket.addMessageListener((msg) => {
				if (msg.type === 'MINIAPP_UPDATE' || msg.type === 'ALERT_BROADCAST') {
					console.log('🔔 [MiniappStore] 실시간 알림 신호 수신 -> 데이터 자동 동기화');
					this.refresh();
				}
			});
		}
	}

	/**
	 * 🔄 카운트 및 피드 목록 전체 갱신
	 */
	async refresh() {
		await Promise.all([this.loadCounts(), this.loadItems()]);
	}

	/**
	 * 📊 뱃지용 실시간 미결 건수 로드
	 */
	async loadCounts() {
		try {
			const res = await api.getMiniappCounts();
			if (res) this.serverCounts = res;
		} catch (e) {
			// 비로그인 상태 등에서는 조용히 무시
		}
	}

	/**
	 * 📋 미니앱 액션 피드 목록 로드
	 * @param {Object} [params]
	 */
	async loadItems(params = {}) {
		this.loading = true;
		try {
			const res = await api.getMiniappItems(params);
			if (Array.isArray(res)) {
				// FeedItem 컴포넌트 하위 호환성을 위해 category를 type으로 매핑
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

	// --- ✏️ CRUD Actions (백엔드 API 영속화) ---

	/**
	 * 새 메모, 알람, 메시지, 지시사항 등록
	 * @param {string} category - 'MEMO' | 'ALARM' | 'INSTRUCTION' | 'MESSAGE'
	 * @param {string} content
	 * @param {Object} [extra]
	 */
	async addItem(category, content, extra = {}) {
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
	 * @param {number} id
	 * @param {Object} data
	 */
	async updateItem(id, data) {
		try {
			// FeedItem 호환: is_done 토글 시 status를 'COMPLETED' 또는 'PENDING'으로 변환
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

			// 낙관적 UI 업데이트
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
	 * 아이템 삭제
	 * @param {number} id
	 */
	async deleteItem(id) {
		try {
			await api.deleteMiniappItem(id);
			this.items = this.items.filter((i) => i.id !== id);
			await this.loadCounts();
		} catch (e) {
			console.error('❌ [MiniappStore] 아이템 삭제 실패:', e);
			await this.refresh();
		}
	}

	/**
	 * 🔴 헤더 및 슬라이더용 미결 뱃지 카운트 게터
	 */
	get counts() {
		return this.serverCounts;
	}
}

export const miniappStore = new MiniappStore();
