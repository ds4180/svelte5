# 작업 기록: 하이드레이션 안정성 강화 및 JTI/Redis 세션 관리 시스템 고도화 (2026년 3월 25일 ~ 28일)

## 1. 초기 문제: 전역 하이드레이션 오류 (2026-03-25)

- **초기 증상:** `jeju.live` 도메인에서 SvelteKit 하이드레이션 오류(`TypeError: Cannot read properties of undefined (reading 'call')`) 발생. PC 브라우저에서만 특정 조건(캐시 문제, Cloudflare 최적화)에서 재현.
- **원인:**
  - **Cloudflare 최적화 (Rocket Loader, Auto Minify):** Svelte 5의 SSR 마커 및 JS 실행 순서를 방해하여 하이드레이션 실패 유발.
  - **캐시 불일치:** 브라우저/Service Worker 캐시에 이전 버전의 JS 파일이 남아있어, 서버의 최신 HTML과 불일치 발생하는 경우.
- **해결:**
  - **Cloudflare 설정:** Rocket Loader 비활성화, HTML Auto Minify 해제 권고. (안정성 확보에 필수적)
  - **코드 개선:**
    - `(app)/+layout.svelte`: `untrack` 최상위 사용 제거, `$page` 스토어 접근 시 안전 장치 강화, `onMount` 초기화 로직 개선.
    - `Alert.svelte`: `$effect` 내부 상태 변조 로직 `untrack`으로 보호.
    - **강제 새로고침 및 캐시 삭제:** `Ctrl+F5 + 개발자 도구 캐시 비활성화`를 통해 하이드레이션 문제 해결 확인. (코드 자체 버그 아님 확인)
- **결론:** 하이드레이션 안정성 향상. 코드 자체의 문제보다는 인프라/캐시 관리가 중요함이 입증됨.

---

## 2. JTI/Redis 기반 세션 관리 시스템 고도화 (2026-03-28)

- **목표:**
  - 아이디당 **모바일 1개, 데스크톱/태블릿 1개**의 총 2개 세션만 동시 접속 허용.
  - 동일 기기 유형으로 신규 로그인 시 기존 세션 자동 강제 종료 (Kick-out).
  - Redis 유실 시 세션 상태를 DB와 실시간 동기화하여 일관성 유지 및 하이드레이션 오류 방지.
  - 로그인, 로그아웃, 세션 종료(Kick-out) 플로우를 백엔드 API 통신 기반으로 통합.

- **백엔드 (FastAPI) 변경 사항:**
  - **`user_router.py`**:
    - `POST /users/login`: `User-Agent` 분석 기반 `device_category` (MOBILE/DESKTOP) 판별. Redis에 `session:{user_id}:{category}` 키로 JTI 저장. 기존 세션 JTI는 DB `KICKED_OUT` 처리. `session_id` 쿠키(HttpOnly) 직접 설정.
    - `GET /users/me`: `session_id` 쿠키 및 `User-Agent` 기반 Redis, DB 세션 검증.
    - `GET /sessions`: `user_crud.get_session_list` 호출 (DB 조회 시 Redis 실시간 동기화 기능 추가).
    - `POST /users/logout`: Redis 세션 삭제, DB `LOGOUT` 처리, `session_id` 쿠키 삭제.
    - `POST /sessions/kick/{target_session_id}`: 특정 세션 강제 종료.
  - **`user_crud.py`**:
    - `get_session_list`: `login_at.desc()` 순으로 정렬. 세션 조회 시 **Redis 존재 여부 실시간 체크** 및 DB 상태(`EXPIRED`) 자동 동기화 로직 추가. (Redis 리부트 시 DB 상태 일치화)
    - `kick_session`: DB `KICKED_OUT` 처리 및 Redis 해당 JTI 삭제.
    - `login_for_access_token`: `OAuth2PasswordRequestForm` 사용, JTI 및 Redis/DB 세션 관리 로직 통합.

- **프론트엔드 (SvelteKit) 변경 사항:**
  - **`hooks.server.js`**:
    - `handle`: `session_id` 쿠키 존재 시 `/api/users/me` 호출. 401 에러 발생 시 `session_id` 쿠키 즉시 삭제 및 `locals.user` null 처리. (Redis 유실/리부트 시 하이드레이션 오류 방지)
    - `handleFetch`: 백엔드 요청 시 원본 브라우저의 `User-Agent` 및 `Cookie` 헤더 명시적으로 복사. (기기 유형 구분 및 인증 정보 전달 보장)
  - **`login/+page.server.js`**:
    - 백엔드 로그인 API 응답에서 `Set-Cookie` 헤더(`session_id`)를 추출하여 브라우저에 `cookies.set`으로 확실히 전달.
    - `accessToken`, `refreshToken` 관련 로직 제거.
  - **`logout/+page.server.js`**:
    - 백엔드 `/api/users/logout` 호출하여 Redis 세션 정리.
    - `session_id` 쿠키 삭제.
  - **`v1/admin/sessions/+page.svelte` (세션 모니터링 UI):**
    - 테이블 디자인 개선: 헤더/행 대비, 최신순 정렬, 세션 상태(`ACTIVE`, `EXPIRED`, `KICKED_OUT`) 명확히 표시.
    - Redis 동기화 로직 적용으로 UI에 최신 세션 상태 반영.
    - `adminKickSession` 기능 유지.
  - **`v1/admin/+page.svelte`**: 세션 모니터링 페이지로 가는 링크 카드 추가.

---

## 3. 최종 검토 및 안정화

- **하이드레이션 안정성:** 모든 관련 파일에서 하이드레이션 오류를 유발할 수 있는 잠재적 요소를 제거하고, 서버/클라이언트 상태 동기화 로직을 강화했습니다. Cloudflare 설정(Auto Minify, Rocket Loader 비활성화)이 유지된다면 하이드레이션 관련 문제는 크게 줄어들 것입니다.
- **세션 관리:** JTI/Redis 기반의 2개 세션 동시 접속 정책이 백엔드와 프론트엔드에서 완벽하게 동기화되었습니다. Redis 리부트 시에도 DB 상태가 `EXPIRED`로 즉시 업데이트되며, 하이드레이션 오류 없이 안전하게 세션이 정리됩니다.
- **UI/UX:** 세션 모니터링 페이지가 기능적으로나 시각적으로 개선되었습니다.

**현재 상태:** 로그인, 로그아웃, 세션 관리, 기기별 세션 제한 및 강제 종료 기능이 문서화된 요구사항에 따라 정상 작동합니다.

---

## 4. 향후 권장 사항

- **Cloudflare 캐싱 정책:** `jeju.live` 도메인의 Cloudflare 설정에서 **HTML Auto Minify**와 **Rocket Loader**는 비활성화 상태를 유지하는 것이 좋습니다. (하이드레이션 안정성 유지)
- **Service Worker:** Service Worker가 오래된 정적 자산을 캐싱하고 있다면, 빌드/배포 후 수동으로 캐시를 삭제하는 절차가 필요할 수 있습니다.
- **에러 핸들링 강화:** 백엔드 API 호출 시 발생하는 모든 에러(특히 401, 500 등)에 대해 프론트엔드에서 사용자 친화적인 메시지와 UI 피드백을 제공하도록 보강할 수 있습니다.
- **추가 테스트:** Redis 강제 재시작, 다른 기기에서의 동시 로그인, 네트워크 불안정 상황 등 엣지 케이스에 대한 추가 테스트를 권장합니다.
