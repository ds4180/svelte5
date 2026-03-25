/**
 * @file nav.svelte.js
 * @description DB 연동형 동적 메뉴 상태 관리 RUNE (Svelte 5)
 */

class NavState {
    // 📌 전역 메뉴 리스트 상태
    menus = $state([]);
    isLoading = $state(false);

    /**
     * @function fetchMenus
     * @description API(v1/admin/menu/public)를 통해 권한별 메뉴 목록 로드
     */
    async fetchMenus(fetchFunc) {
        this.isLoading = true;
        try {
            const response = await fetchFunc('/v1/admin/menu/public');
            if (response.ok) {
                this.menus = await response.json();
                console.log("🌐 Dynamic Menus Loaded:", this.menus.length);
            } else {
                console.error("❌ Failed to fetch menus");
            }
        } catch (error) {
            console.error("❌ Menu fetch error:", error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @function setMenus
     * @description 외부(server.js 등)에서 데이터를 직접 주입할 때 사용
     */
    setMenus(menuData) {
        this.menus = menuData;
    }
}

export const navState = new NavState();
