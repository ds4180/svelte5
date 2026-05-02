<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/runes/auth.svelte.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Alert from '$lib/components/Alert.svelte'; // Import Alert component
	import { websocket } from '$lib/runes/websocket.svelte.js'; // Import global websocket service
	import './layout.css'; // Import global css

	// This is the true root layout. Its only job is to initialize
	// global stores on the client side after hydration.
	onMount(() => {
		auth.init();
		alertState.init();
		websocket.init(); // 🌐 하이드레이션 이후 웹소켓 연결 시작
	});

	let { children } = $props();
</script>

<!-- 🔔 전역 알림 레이어 -->
<Alert positionFilter="top" />
<Alert positionFilter="modal" />

{@render children()}
