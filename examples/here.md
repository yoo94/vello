# vello 핵심 기능 동작 가이드

아래는 vello의 주요 기능이 요청 수명주기에서 어떻게 동작하는지와, 코드 레벨에서 어떤 지점에서 구현되어 있는지 정리한 문서입니다. 파일/심볼 이름은 `src/index.ts` 기준입니다.

---

## 1) 자동 HTTP 오류 처리

- 동작 흐름
  - `request()` → 실제 호출은 `executeRequestWithRetry()`가 수행
  - `fetch()` 응답 수신 후 `response.ok` 검사
  - 실패(`!ok`) 시 `handleErrorResponse()`로 위임하여 `VelloError` 생성 및 throw
  - 상위에서 `shouldRetryRequest()` 판단에 따라 재시도 또는 최종 에러 처리(`handleError()` 및 `errorInterceptor` 호출)

- 구현 포인트
  - `executeRequestWithRetry()` 내 `if (!response.ok) { ... }` 분기에서 `handleErrorResponse()` 호출
  - `handleErrorResponse()`는 `VelloError`를 구성하기 위해 응답 본문을 가능한 타입으로 파싱(try-catch) 후, `VelloResponse` 형태로 래핑해 에러에 첨부
  - 최종적으로 `throw`되어 호출부에서 재시도/에러 인터셉터 흐름으로 연결

- 커스터마이즈
  - `setErrorInterceptor((error) => { ... })`로 공통 에러 로깅/토스트/리다이렉트 등을 중앙집중 처리

---

## 2) 자동 JSON 변환

- 동작 흐름
  - `post|put|patch()` 계열에서 전달된 `body`는 `serializeBody()`로 직렬화 후 `request()`에 전달
  - 기본 헤더는 `Content-Type: application/json`
  - 응답은 `parseResponse()`가 `responseType`에 따라 자동 역직렬화

- 구현 포인트
  - `serializeBody(body)`
    - `null/undefined` → `null`
    - `FormData` → 그대로 통과(헤더 자동 조정 가능)
    - `string` → 그대로 통과
    - 그 외 객체 → `JSON.stringify`
  - `parseResponse(response, responseType)`
    - `json | text | blob | arrayBuffer` 분기 처리

- 커스터마이즈
  - 요청 시 `headers`로 `Content-Type` 교체 가능
  - 응답 타입은 `options.responseType` 혹은 인스턴스 기본값으로 제어

---

## 3) 타임아웃 지원

- 동작 흐름
  - `executeRequestWithRetry()`에서 `AbortController` 생성
  - `setTimeout(() => controller.abort(), timeout)`으로 타임아웃 구성
  - 타임아웃 발생 시 `AbortError` → `handleError()`에서 `VelloError(code: 'TIMEOUT')`로 변환

- 구현 포인트
  - `request()`에서 `timeout` 기본값(10초)을 구성해 내려보냄
  - `executeRequestWithRetry()`에서 `signal`에 컨트롤러 연결 후 fetch 실행

- 커스터마이즈
  - 인스턴스/요청 단위로 `timeout` 지정 가능

---

## 4) 인터셉터 (요청/응답/에러)

- 동작 흐름
  - 요청 전: `request()`에서 `config.requestInterceptor` 호출해 최종 `RequestConfig` 확정
  - 응답 후: 정상 응답을 조립한 뒤 `config.responseInterceptor`가 있으면 후처리 후 반환
  - 에러 시: `handleError()`에서 `config.errorInterceptor` 호출(로깅, 사용자 알림 등)

- 구현 포인트
  - 설정자
    - `setRequestInterceptor(fn)`
    - `setResponseInterceptor(fn)`
    - `setErrorInterceptor(fn)`
  - 적용 지점
    - 요청 전: `request()` 내부
    - 응답 후: 캐시 히트 시와 네트워크 요청 성공 시 모두 인터셉터 경유
    - 에러 시: 재시도 종료 후 혹은 즉시 실패 시 `handleError()`에서 실행

---

## 5) TypeScript 완전 지원

- 동작 흐름/특징
  - 제네릭 기반 응답 타입: `get<T>()`, `post<T>()` 등에서 `VelloResponse<T>` 반환
  - `VelloError`, `VelloConfig`, `RequestConfig`, `RetryConfig`, `CacheConfig` 등 풍부한 타입 정의(`src/types`)
  - IDE에서 자동 완성/타입 추론 호환

- 구현 포인트
  - 메서드 시그니처 제네릭과 내부 `VelloResponse<T>` 구조 유지
  - `export * from './types'`로 타입 재노출

---

## 6) 다양한 응답 타입 지원 (json, text, blob, arrayBuffer)

- 동작 흐름
  - 호출부에서 `responseType` 지정 → `request()`가 `parseResponse()`를 호출해 알맞은 reader로 파싱

- 구현 포인트
  - `parseResponse<T>(response, responseType)` 스위치 구문으로 타입별 처리
    - `json`: `response.json()`
    - `text`: `response.text()`
    - `blob`: `response.blob()`
    - `arrayBuffer`: `response.arrayBuffer()`
  - `VelloResponse<T>`의 `data`에 적재

---

## 7) Retry 지원 (자동 재시도/커스텀 로직)

- 동작 흐름
  - 요청 실패 시 `shouldRetryRequest(error, config, retryCount)`로 재시도 여부 판단
  - 재시도 시 `calculateRetryDelay()`로 대기 시간 산출(기본 지수 백오프)
  - 한도 초과 또는 재시도 불가 조건 → 최종 `handleError()`로 이동

- 구현 포인트
  - `request()`가 `retry` 기본값을 구성하고, 인스턴스/요청 단위 `retry` 설정을 머지
  - 기본 조건(`defaultRetryCondition`)
    - `NETWORK_ERROR` 또는 `TIMEOUT`은 재시도 대상
    - `5xx` 서버 오류는 재시도 대상
  - 딜레이 계산
    - 기본: `baseDelay * 2^retryCount`
    - `retryDelayFunction` 제공 시 해당 함수로 대체 가능

- 커스터마이즈
  - `setRetryConfig`, `setRetries`, `setRetryDelay`, `setRetryCondition` 등으로 전역 조정
  - 개별 요청의 `options.retry`로 오버라이드

---

## 8) 에러 코드에 대한 안내 (에러 모델)

- 에러 형태: `VelloError`
  - 주요 속성
    - `message`: 사람이 읽을 수 있는 메시지(HTTP 상태 포함 가능)
    - `code`: `'NETWORK_ERROR' | 'TIMEOUT' | string(HTTP 상태코드 문자열 등)`
    - `response?`: 서버 응답(`VelloResponse`)이 있으면 포함
    - `config`: 요청 당시 `RequestConfig`
    - `retryCount`: 현재까지 시도 횟수

- 부여 로직
  - 네트워크 오류(`TypeError(fetch)`) → `code: 'NETWORK_ERROR'`
  - 타임아웃(`AbortError`) → `code: 'TIMEOUT'`
  - HTTP 오류 → `code: response.status.toString()` 형태(예: `'404'`, `'500'`)

- 활용
  - `errorInterceptor`에서 `code`를 기준으로 사용자 메시지/재로그인/리다이렉트 분기 등 구성

---

## 9) 캐싱 지원 (메모리, localStorage, 커스텀 스토리지)

- 동작 흐름
  - 요청 전(`request()`): 캐시가 켜져 있고 `isCacheableRequest()`가 참이면 키 생성 후 조회
  - 유효 캐시 히트 시: 네트워크 호출 생략, 캐시 데이터를 `VelloResponse`로 재구성해 반환(헤더 복원, `statusText`에 `(Cached)` 표시)
  - 네트워크 성공 시: 동일 조건에서 응답을 캐시에 저장(`setToCache()`)

- 구현 포인트
  - 저장소
    - 메모리: 클래스 내부 `Map<string, CachedResponse>`
    - 브라우저 스토리지: `localStorage`/`sessionStorage` (삭제/전체 클리어 지원)
    - 커스텀: `cache.customStorage` 인터페이스(`get/set/delete/clear` 등) 구현체 주입
  - 키/정책
    - `generateCacheKey(url, config)`로 키 생성(메서드/URL/옵션 조합 기반)
    - `isCacheableRequest(endpoint, config)`
      - 기본: `GET`/`HEAD`는 안전(safe) → 캐시 대상
      - `cache.methods`에 지정된 메서드는 명시 허용
    - `ttl` 만료 검사: `isCacheValid(cached, ttl)`
  - 관리 API
    - `setCacheConfig()`, `clearCache()`, `getCacheStats()`, `deleteCacheItem(key)`

- 커스터마이즈
  - 스토리지 종류: `'memory' | 'localStorage' | 'sessionStorage' | 'custom'`
  - `methods`, `ttl`, 사용자 정의 저장소 드라이버로 세밀 제어

---

## 요청 수명주기 한눈에 보기

1) 옵션 병합 및 기본값 설정 → 2) 요청 인터셉터 → 3) 캐시 조회(가능 시) → 4) 네트워크 호출(fetch + 타임아웃)
→ 5) HTTP ok 검사(실패 시 에러 래핑) → 6) 응답 파싱(responseType) → 7) 응답 인터셉터 → 8) 캐시 저장(옵션/성공 시) → 9) 최종 반환

에러 경로: A) 실패 발생 → B) 재시도 판단/대기 → C) 재시도 한도 초과 시 `handleError()` → D) 에러 인터셉터 → E) throw

---

## 팁

- 개별 요청으로 모든 전역 설정을 오버라이드할 수 있습니다. 예: `responseType`, `timeout`, `retry`, `cache` 등
- 제네릭을 사용해 응답 데이터 타입을 정확히 지정하면 IDE에서 완전한 자동완성을 받을 수 있습니다.
- 캐시는 디버깅을 위해 `getCacheStats()`로 현재 키/용량을 확인할 수 있습니다.
