// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: {
				id?: number | string;
				username?: string;
				email?: string;
				rank_level?: number;
				is_superuser?: boolean;
				primary_group?: string;
				secondary_groups?: string[];
				[key: string]: any;
			} | null;
			sessionId?: string | null;
			[key: string]: any;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
