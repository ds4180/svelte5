<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { clearTokens, authStore } from '$lib/stores/authStore.js'; // authStore 및 clearTokens import

	let loggingOut = true;
	let errorMessage = '';

	async function performLogout() {
		loggingOut = true;
		errorMessage = '';

		try {
			// API에서 access_token을 가져오는 방식에 따라 달라집니다.
			// 여기서는 localStorage에 저장되었다고 가정합니다.
			const accessToken = localStorage.getItem('accessToken');

			// API 서버의 기본 URL을 명시합니다. (Docker ps 결과에서 확인된 8000번 포트 사용)
			const apiBaseUrl = '/api';

			const response = await fetch(`${apiBaseUrl}/users/logout`, {
				method: 'POST',
				headers: {
					// API에서 Bearer 토큰을 기대하므로 Authorization 헤더에 포함
					...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				let errorDetail = '로그아웃 API 호출에 실패했습니다.';
				try {
					const errorData = await response.json();
					errorDetail = errorData.detail || `로그아웃 실패 (상태 코드: ${response.status})`;
				} catch (e) {
					const htmlError = await response.text();
					console.error('API returned non-JSON response during logout:', htmlError);
					errorDetail = '로그아웃 중 서버 오류가 발생했습니다.';
				}
				errorMessage = errorDetail;
				console.error('Logout API error:', errorDetail);
			} else {
				console.log('Logout successful from API');
			}

		} catch (error) {
			console.error('Logout network error:', error);
			errorMessage = '로그아웃 처리 중 네트워크 오류가 발생했습니다.';
		} finally {
			// API 호출 결과와 관계없이 로컬에서 세션 정보 제거 및 store 초기화
			clearTokens(); // authStore 및 localStorage에서 토큰 제거
			
			// 로그아웃 처리 후 로그인 페이지로 이동
			goto('/login');
		}
		loggingOut = false;
	}

	// 컴포넌트 마운트 시 로그아웃 함수 자동 실행
	onMount(() => {
		performLogout();
	});
</script>

<div class="logout-container">
	{#if loggingOut}
		<p>로그아웃 중입니다...</p>
	{:else if errorMessage}
		<p class="error-message">{errorMessage}</p>
		<p>로그인 페이지로 이동합니다.</p>
	{:else}
		<p>로그아웃되었습니다. 로그인 페이지로 이동합니다.</p>
	{/if}
</div>

<style>
	.logout-container {
		text-align: center;
		margin-top: 2rem;
	}
	.error-message {
		color: #d9534f;
	}
</style>
