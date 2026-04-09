// svelte5/src/routes/(app)/v1/+page.server.js
export async function load({ locals }) {
	// Assuming 'locals.user' contains user information, including a username
	// This needs to align with how user data is set in hooks.server.js
	return {
		username: locals.user?.username || null
	};
}
