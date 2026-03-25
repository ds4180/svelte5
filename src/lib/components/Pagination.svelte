<script>
    /**
     * Pagination.svelte
     * @description 페이지네이션 컴포넌트 (DaisyUI 스타일 적용)
     * @prop {number} total       - 전체 데이터 수
     * @prop {number} currentPage - 현재 페이지 번호 (0-indexed)
     * @prop {number} [size=10]   - 페이지당 항목 수
     * @prop {string} [keyword]   - 검색어 (URL 파라미터에 유지)
     */

    // --- [Svelte 5 Props] ---
    let { total = 0, currentPage = 0, size = 10, keyword = "" } = $props();

    // 전체 페이지 수 자동 계산 ($derived 룬)
    const totalPages = $derived(Math.ceil(total / size));

    /**
     * 검색어를 포함한 페이지 URL 생성
     * @param {number} page
     * @returns {string}
     */
    const getUrl = (page) => {
        const params = new URLSearchParams({ page: page.toString() });
        if (keyword) params.set("keyword", keyword);
        return `?${params.toString()}`;
    };
</script>

<!-- ================================================================== -->
<!-- 페이지네이션 (DaisyUI join + btn 스타일) -->
<!-- ================================================================== -->
{#if totalPages > 1}
    <div class="flex justify-center mt-4">
        <div class="join">

            <!-- 이전 버튼 -->
            <a
                href={getUrl(currentPage - 1)}
                class="join-item btn btn-sm {currentPage <= 0 ? 'btn-disabled' : ''}"
                aria-label="이전 페이지">
                «
            </a>

            <!-- 페이지 번호 (현재 페이지 ±5 범위만 표시) -->
            {#each Array(totalPages) as _, i}
                {#if i >= currentPage - 5 && i <= currentPage + 5}
                    <a
                        href={getUrl(i)}
                        class="join-item btn btn-sm {i === currentPage ? 'btn-primary btn-active' : ''}">
                        {i + 1}
                    </a>
                {/if}
            {/each}

            <!-- 다음 버튼 -->
            <a
                href={getUrl(currentPage + 1)}
                class="join-item btn btn-sm {currentPage + 1 >= totalPages ? 'btn-disabled' : ''}"
                aria-label="다음 페이지">
                »
            </a>

        </div>
    </div>
{/if}
