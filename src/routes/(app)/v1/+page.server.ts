import type { PageServerLoad } from './$types';

// svelte5/src/routes/(app)/v1/+page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
	// Assuming 'locals.user' contains user information, including a username
	// This needs to align with how user data is set in hooks.server.ts
	return {
		username: locals.user?.username || null
	};
};
