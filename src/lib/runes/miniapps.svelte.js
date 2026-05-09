/**
 * @file miniapps.svelte.js
 * @description 미니앱(메모, 지시사항, 메시징, 알림) 전역 상태 및 CRUD 로직 (Svelte 5 Runes)
 */
import { websocket } from './websocket.svelte.js';

class MiniappStore {
    items = $state([
        { id: 0, type: 'NOTIFICATION', content: '시스템 정기 점검이 예정되어 있습니다 (22:00)', status: 'PENDING', created_at: new Date().toISOString() },
        { id: 1, type: 'INSTRUCTION', content: '서버 재배포 작업 수행', status: 'ONGOING', created_at: new Date().toISOString() },
        { id: 2, type: 'MESSAGE', sender: '관리자', content: '시스템 배포 완료되었습니다.', created_at: new Date().toISOString() },
        { id: 3, type: 'MEMO', content: '오늘 마감인 리포트 작성', is_done: false, created_at: new Date().toISOString() },
        { id: 4, type: 'MEMO', content: '비타민 챙겨먹기', is_done: true, created_at: new Date().toISOString() },
    ]);

    constructor() {
        // WebSocket 리스너 등록
        if (typeof window !== 'undefined') {
            websocket.addMessageListener((msg) => {
                if (msg.type === 'MINIAPP_UPDATE') {
                    this.handleServerUpdate(msg.payload);
                }
            });
        }
    }

    // --- CRUD Actions ---

    addItem(type, content, extra = {}) {
        const newItem = {
            id: Date.now(),
            type,
            content,
            created_at: new Date().toISOString(),
            ...extra
        };
        this.items = [newItem, ...this.items];
        this.syncWithServer('CREATE', newItem);
    }

    updateItem(id, data) {
        const index = this.items.findIndex(i => i.id === id);
        if (index !== -1) {
            this.items[index] = { ...this.items[index], ...data };
            this.syncWithServer('UPDATE', this.items[index]);
        }
    }

    deleteItem(id) {
        const itemToDelete = this.items.find(i => i.id === id);
        this.items = this.items.filter(i => i.id !== id);
        if (itemToDelete) {
            this.syncWithServer('DELETE', { id });
        }
    }

    // --- 실시간 동기화 ---

    syncWithServer(action, payload) {
        websocket.send({
            type: 'MINIAPP_ACTION',
            payload: { action, ...payload }
        });
    }

    handleServerUpdate(payload) {
        const { action, id, ...data } = payload;
        if (action === 'CREATE') {
            if (!this.items.find(i => i.id === id)) {
                this.items = [payload, ...this.items];
            }
        } else if (action === 'UPDATE') {
            const index = this.items.findIndex(i => i.id === id);
            if (index !== -1) this.items[index] = { ...this.items[index], ...data };
        } else if (action === 'DELETE') {
            this.items = this.items.filter(i => i.id !== id);
        }
    }

    // --- 뱃지용 계산 속성 ---

    get counts() {
        return {
            NOTIFICATION: this.items.filter(i => i.type === 'NOTIFICATION').length,
            INSTRUCTION: this.items.filter(i => i.type === 'INSTRUCTION' && i.status !== 'COMPLETED').length,
            MESSAGE: this.items.filter(i => i.type === 'MESSAGE').length,
            MEMO: this.items.filter(i => i.type === 'MEMO' && !i.is_done).length,
            TOTAL: this.items.length
        };
    }
}

export const miniappStore = new MiniappStore();
