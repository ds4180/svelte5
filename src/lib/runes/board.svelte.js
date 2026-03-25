import { browser } from '$app/environment';

/**
 * 게시판 공통 상태 (페이지 번호, 검색어)를 관리하는 Svelte 5 Rune 클래스
 */
class BoardState {
    lastViewedPage = $state(0);
    keyword = $state('');

    constructor() {
        if (browser) {
            try {
                this.lastViewedPage = Number(sessionStorage.getItem('last_viewed_page')) || 0;
                this.keyword = sessionStorage.getItem('last_search_keyword') || '';
            } catch (e) {
                console.warn("⚠️ [BoardState] Storage Recovery Failed", e);
            }
        }
    }

    setPage(page) {
        this.lastViewedPage = page;
        if (browser) {
            sessionStorage.setItem('last_viewed_page', page);
        }
    }

    setKeyword(keyword) {
        this.keyword = keyword;
        if (browser) {
            sessionStorage.setItem('last_search_keyword', keyword);
        }
    }
}

export const boardState = new BoardState();
