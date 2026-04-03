/**
 * @file nav.svelte.js
 * @description DB 연동형 동적 메뉴 및 페이지 맥락 상태 관리 RUNE (Svelte 5)
 */

class NavState {
    // 📌 1. 전역 레이아웃 메뉴 리스트 (중간 레이어)
    menus = $state([]);
    
    // 📌 2. 본문 페이지별 동적 메뉴 리스트 (최상단 레이어)
    pageMenus = $state([]);

    isLoading = $state(false);

    /**
     * @function fetchMenus
     * @description API를 통해 권한별 메뉴 목록 로드 (레이아웃용)
     */
    async fetchMenus(fetchFunc) {
        this.isLoading = true;
        try {
            const response = await fetchFunc('/v1/admin/menu/public');
            if (response.ok) {
                this.menus = await response.json();
            }
        } catch (error) {
            console.error("❌ Menu fetch error:", error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @function setMenus
     * @description 레이아웃 메뉴 직접 주입
     */
    setMenus(menuData) {
        this.menus = menuData || [];
    }

    /**
     * @function setPageMenus
     * @description 현재 페이지의 맥락 메뉴 주입 (최상단 레이어)
     */
    setPageMenus(menuData) {
        this.pageMenus = menuData || [];
    }

    /**
     * @function clearPageMenus
     * @description 페이지 이동 시 맥락 메뉴 초기화
     */
    clearPageMenus() {
        this.pageMenus = [];
    }
}

export const navState = new NavState();
