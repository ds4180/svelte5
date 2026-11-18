/**
 * @file nav.svelte.ts
 * @description DB 연동형 동적 메뉴 및 페이지 맥락 상태 관리 RUNE (Svelte 5)
 */

export interface MenuOption {
	label: string;
	value: string | number;
}

export interface MenuItem {
	id?: number | string;
	title: string;
	description?: string;
	badge?: string;
	type?: 'link' | 'button' | 'toggle' | 'slider' | 'select' | 'text';
	path?: string;
	url?: string;
	icon?: string;
	icon_name?: string;
	value?: any;
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	options?: MenuOption[];
	onClick?: () => void | Promise<void>;
	onChange?: (value: any) => void | Promise<void>;
	order?: number;
	rank_level?: number;
	category?: string;
	children?: MenuItem[];
	[key: string]: any;
}

export class NavState {
	// 📌 1. 전역 레이아웃 메뉴 리스트 (중간 레이어)
	menus = $state<MenuItem[]>([]);

	// 📌 2. 본문 페이지별 동적 폼/맥락 컨트롤 리스트 (우측 사이드바 상단)
	pageMenus = $state<MenuItem[]>([]);

	isLoading = $state<boolean>(false);

	/**
	 * API를 통해 권한별 메뉴 목록 로드 (레이아웃용)
	 */
	async fetchMenus(fetchFunc: (url: string) => Promise<Response>): Promise<void> {
		this.isLoading = true;
		try {
			const response = await fetchFunc('/v1/admin/menu/public');
			if (response.ok) {
				this.menus = await response.json();
			}
		} catch (error) {
			console.error('❌ Menu fetch error:', error);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 레이아웃 메뉴 직접 주입
	 */
	setMenus(menuData: MenuItem[] | null | undefined): void {
		this.menus = menuData || [];
	}

	/**
	 * 현재 페이지의 맥락 메뉴 주입 (최상단 레이어)
	 */
	setPageMenus(menuData: MenuItem[] | null | undefined): void {
		this.pageMenus = menuData || [];
	}

	/**
	 * 페이지 이동 시 맥락 메뉴 초기화
	 */
	clearPageMenus(): void {
		this.pageMenus = [];
	}
}

export const navState = new NavState();
export default navState;
