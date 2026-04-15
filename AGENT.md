# 프로젝트 지휘 지침 (Project Instructions)

- 라이브러리는 데이지UI, tiptap, chart.js, iconify 설치되어 있고, 이를 적극 사용한다.

- docker 환경으로 svelte5 이름으로 작동 중이다.

- 기존 bootstrap 에서 데이지UI로 변경 중이다. bootstrap이 나오는 경우 데이UI로 변경함을 사용자에게 고지 하라.
 -그룹레이어기능 '()'을 사용하므로 터미널 명령시에 \하 ''를 정확히 사용할 것.
- 미디어 쿼리를 중심으로 디자인을 작성한다. 카드형식 등등

** 코드 생성 규칙 **
다음 규칙을 반드시 준수하여 프로덕션 수준의 코드를 작성 하라. 
[기본원칙]
- 단순 동작코드가 아니라 안정성 ux 고려한 코드 작성
- 모든 비동기 로직은 실패 가능성을 고려
[api / 비동기 처리]
- 모든 async 함수는 반드시 try/catch 포함
- fetch 요청 실패 시 사용자에게 에러 메세지 표시
- 가능하면, AbortController를 사용하여 요청 취소 처리
- 중복 요청 방지 로직 포함( loading 샅애 또는 guard)
[로딩 상태 / ux]
- 모든 api요청은 loading 상태를 포함
- loading 중에는 버튼 disabled 처리 
- 사용자에게 진행 상태를 명확히 표시 
[중복 클릭 방지]
- 버튼 클릭시 중복 실행 방지 
- loading 상태 활용하여 재클릭 차단 
[폼 처리]
- form submit 시 preventDefault 적용
- 기본적인 입력값 vailidation 포함
[에러 처리]
- 에러 상태를 ui에 표시 
- 네트워크/서버 오류를 구분 가능하면 구분
[반응성 규칙]
- 객체/배열 변경 시 반드시 재할당 사용(immutable 방식)
- 반응성 깾지지 않도록 주의
[리스트 렌더링]
- each 블록 사용시 반드시 key 사용
[컴포넌트 생명주기]
-필요 시 onDestroy 사용(timer,event)
[SSR/CSR환경 고려]
- window, document 사용시 브라우저 환경 체크
- hydration 오류 방지
[코드 품질]
- 의미 있는 변수 사용
- 재사용 가능한 구조로 작성
- 불필요한 중복 코드 제거 
[출력 요구 사항]
- svelte5 RUNE 문법 사용
- 즉시 실행 가능한 완성 코드 작성 
- ui/ux 포함된 형태로 작성 