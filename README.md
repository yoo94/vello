# VELLO API HTTP Client

의미: 빠르게, 민첩하게 (velox = 빠른 → vello는 부드러운 변형)

fetch API의 한계점들을 개선한 사용하기 쉬운 HTTP 클라이언트 라이브러리입니다.

## 주요 기능

- ✅ **자동 HTTP 오류 처리**: response.ok 체크 및 오류 상태 코드 자동 throw
- ✅ **자동 JSON 변환**: 요청/응답 body의 자동 JSON 직렬화/역직렬화
- ✅ **타임아웃 지원**: AbortController를 사용한 요청 타임아웃 구현
- ✅ **인터셉터**: 요청/응답/에러 인터셉터 지원
- ✅ **TypeScript 완전 지원**: 타입 안전성과 IntelliSense 지원
- ✅ **다양한 응답 타입**: json, text, blob, arrayBuffer 지원
- ✅ **Retry 지원**: 자동 재시도 및 커스텀 재시도 로직
- ✅ **에러코드에 대한 안내**: 더 상세한 안내 제공
- ✅ **캐싱 지원**: 메모리, localStorage, 커스텀 스토리지 캐싱

## 응답 객체 구조

```ts
interface VelloResponse<T> {
  data: T;              // 파싱된 응답 데이터
  status: number;       // HTTP 상태 코드
  statusText: string;   // HTTP 상태 텍스트
  headers: Headers;     // 응답 헤더
  config: RequestConfig; // 요청 설정
}
```

## 설치

```bash
npm install vello
```

## 기본 사용법

### 간단한 초기화

```typescript
import { vello } from 'vello';

// 간단한 초기화
const api = new vello('https://api.example.com');

// 또는 설정 객체로 초기화
const api = new vello({
  baseUrl: 'https://api.example.com',
  timeout: 15000,
  defaultHeaders: {
    'Authorization': 'Bearer your-token',
    'X-API-Key': 'your-api-key'
  }
});
```

### HTTP 메서드 사용

```typescript
// GET 요청
const users = await api.get<User[]>('/users');
console.log(users.data); // 타입: User[]

// POST 요청
const newUser = await api.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT 요청
const updatedUser = await api.put<User>('/users/1', userData);

// PATCH 요청
const patchedUser = await api.patch<User>('/users/1', { name: 'Jane Doe' });

// DELETE 요청
await api.delete('/users/1');
```

## 고급 기능

### 타임아웃 설정

```typescript
// 전역 타임아웃 설정 (기본: 10초)
const api = new vello({
  baseUrl: 'https://api.example.com',
  timeout: 30000 // 30초
});

// 개별 요청 타임아웃
const response = await api.get('/slow-endpoint', {
  timeout: 60000 // 60초
});
```

### 인터셉터 사용

```typescript
// 요청 인터셉터 - 모든 요청에 인증 토큰 추가
api.setRequestInterceptor((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return config;
});

// 응답 인터셉터 - 응답 데이터 변환
api.setResponseInterceptor((response) => {
  // 응답 데이터에 타임스탬프 추가
  response.data = {
    ...response.data,
    receivedAt: new Date().toISOString()
  };
  return response;
});

// 에러 인터셉터 - 전역 에러 처리
api.setErrorInterceptor((error) => {
  if (error.response?.status === 401) {
    // 인증 오류 시 로그인 페이지로 리다이렉트
    window.location.href = '/login';
  }
  
  // 에러 로깅
  console.error('API Error:', {
    message: error.message,
    status: error.response?.status,
    config: error.config
  });
});
```

### 기본 헤더 관리

```typescript
// 기본 헤더 설정
api.setDefaultHeader('X-Client-Version', '1.0.0');
api.setDefaultHeader('Accept-Language', 'ko-KR');

// 기본 헤더 제거
api.removeDefaultHeader('X-Client-Version');
```

### 다양한 응답 타입

```typescript
// JSON 응답 (기본)
const jsonData = await api.get<any>('/data');

// 텍스트 응답
const textData = await api.get('/text', { responseType: 'text' });

// Blob 응답 (파일 다운로드)
const fileBlob = await api.get('/download/file.pdf', { responseType: 'blob' });

// ArrayBuffer 응답
const buffer = await api.get('/binary-data', { responseType: 'arrayBuffer' });
```

### Retry 기능

vello는 네트워크 오류나 서버 오류 시 자동으로 요청을 재시도하는 기능을 제공합니다.

```typescript
// 전역 retry 설정
const api = new vello({
  baseUrl: 'https://api.example.com',
  retry: {
    retries: 3,           // 최대 3번 재시도
    retryDelay: 1000,     // 1초 지연
    retryCondition: (error) => {
      // 네트워크 오류, 타임아웃, 5xx 서버 오류에 대해서만 재시도
      return error.code === 'NETWORK_ERROR' || 
             error.code === 'TIMEOUT' || 
             (error.response?.status !== undefined && error.response.status >= 500);
    },
    retryDelayFunction: (retryCount, error) => {
      // 지수 백오프: 1초, 2초, 4초, 8초...
      return 1000 * Math.pow(2, retryCount);
    }
  }
});

// 개별 요청에 retry 설정
const response = await api.get('/unstable-endpoint', {
  retry: {
    retries: 5,
    retryDelay: 2000
  }
});

// Retry 설정 메서드들
api.setRetries(3);                    // 최대 재시도 횟수 설정
api.setRetryDelay(1500);              // 재시도 지연 시간 설정
api.setRetryCondition((error) => {    // 재시도 조건 설정
  return error.response?.status === 503; // 503 에러에만 재시도
});
```

### 캐싱 기능

vello는 GET 요청에 대한 강력한 캐싱 기능을 제공합니다.

#### 기본 메모리 캐싱

```typescript
// 전역 캐싱 설정
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000,  // 5분간 캐시
    storage: 'memory'     // 메모리에 저장
  }
});

// 첫 번째 요청 - 서버에서 가져옴
const users1 = await api.get('/users');
console.log(users1.statusText); // "OK"

// 두 번째 요청 - 캐시에서 가져옴 (빠름!)
const users2 = await api.get('/users');
console.log(users2.statusText); // "OK (Cached)"
```

#### localStorage 캐싱

```typescript
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 30 * 60 * 1000,    // 30분간 캐시
    storage: 'localStorage'  // localStorage에 저장 (브라우저 재시작 후에도 유지)
  }
});
```

#### 개별 요청 캐싱

```typescript
// 기본적으로는 캐싱하지 않고, 특정 요청만 캐싱
const api = new vello('https://api.example.com');

// 이 요청만 캐싱됨
const importantData = await api.get('/expensive-data', {
  cache: {
    enabled: true,
    ttl: 60 * 60 * 1000,  // 1시간
    key: 'custom-cache-key'  // 커스텀 캐시 키
  }
});
```

#### 커스텀 캐시 키

```typescript
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 10 * 60 * 1000,
    key: (url, config) => {
      // 사용자 ID를 포함한 캐시 키 생성
      const userId = getCurrentUserId();
      return `user-${userId}-${url}`;
    }
  }
});
```

#### 커스텀 스토리지

```typescript
// Redis나 다른 저장소 사용
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    storage: 'custom',
    customStorage: {
      get: async (key) => {
        return await redis.get(key);
      },
      set: async (key, value, ttl) => {
        await redis.setex(key, ttl / 1000, JSON.stringify(value));
      },
      delete: async (key) => {
        await redis.del(key);
      },
      clear: async () => {
        await redis.flushall();
      }
    }
  }
});
```

#### 캐시 관리

```typescript
// 캐시 통계 확인
const stats = api.getCacheStats();
console.log(stats); // { size: 3, keys: ['key1', 'key2', 'key3'] }

// 특정 캐시 항목 삭제
api.deleteCacheItem('specific-cache-key');

// 전체 캐시 지우기
api.clearCache();

// 캐시 설정 변경
api.setCacheConfig({
  enabled: true,
  ttl: 15 * 60 * 1000,  // 15분으로 변경
  storage: 'sessionStorage'
});
```

#### POST 요청 캐싱

vello는 조회성 POST 요청에 대해서도 캐싱을 지원합니다.

##### 특정 HTTP 메서드 캐싱

```typescript
// GET과 POST만 캐시
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    methods: ['GET', 'POST'],  // 캐시할 메서드 지정
    ttl: 5 * 60 * 1000
  }
});

// 복잡한 검색 요청 (POST로 캐시됨)
const searchResult = await api.post('/search', {
  query: 'complex search',
  filters: { category: 'tech', date: '2024' },
  pagination: { page: 1, size: 20 }
});
```

##### 안전한 POST 경로 지정

```typescript
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    safePaths: ['/search', '/query', '/filter'],  // 이 경로들의 POST는 캐시
    ttl: 10 * 60 * 1000
  }
});

// /search 경로의 POST는 자동으로 캐시됨
const results = await api.post('/search', searchData);
```

##### GraphQL 요청 자동 캐싱

```typescript
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000
  }
});

// GraphQL 요청은 자동으로 감지되어 캐시됨
const data = await api.post('/graphql', {
  query: `
    query GetUsers {
      users { id name email }
    }
  `
}, {
  headers: {
    'Content-Type': 'application/graphql'
  }
});
```

##### Unsafe 메서드 전면 허용

```typescript
// 주의: 모든 HTTP 메서드 캐시 허용 (개발/테스트용)
const api = new vello({
  baseUrl: 'https://api.example.com',
  cache: {
    enabled: true,
    allowUnsafeMethods: true,  // POST, PUT, PATCH, DELETE 모두 캐시
    ttl: 30000  // 짧은 TTL 권장
  }
});

// POST, PUT, PATCH 모두 캐시됨
await api.post('/data', postData);
await api.put('/data/1', putData);
await api.patch('/data/1', patchData);
```

##### 개별 요청 캐시 제어

```typescript
const api = new vello('https://api.example.com');

// 특정 POST 요청만 캐시
const expensiveData = await api.post('/expensive-search', searchQuery, {
  cache: {
    enabled: true,
    allowUnsafeMethods: true,  // 이 요청만 POST 캐시 허용
    ttl: 10 * 60 * 1000,
    key: 'expensive-search-cache'  // 커스텀 캐시 키
  }
});
```
  ttl: 15 * 60 * 1000,  // 15분으로 변경
  storage: 'sessionStorage'
});
```
api.setRetryCondition((error) => {    // 재시도 조건 설정
  return error.response?.status === 503; // Service Unavailable일 때만 재시도
});

// 전체 retry 설정 한번에 변경
api.setRetryConfig({
  retries: 5,
  retryDelay: 1000,
  retryDelayFunction: (retryCount) => 1000 + (retryCount * 500) // 선형 증가
});
```

## 에러 처리

vello는 발생한 HTTP 에러 코드에 대해 친숙한 한국어 설명을 제공합니다.

```typescript
```typescript
try {
  const response = await api.get('/users');
  console.log(response.data);
} catch (error) {
  if (error instanceof VelloError) {
    // 기본 에러 정보
    console.error('Status:', error.response?.status);
    console.error('원본 메시지:', error.message);
    console.error('재시도 횟수:', error.retryCount);
    
    // 친숙한 에러 메시지 (새로운 기능!)
    console.error('에러 제목:', error.velloMessage.title);
    console.error('에러 설명:', error.velloMessage.description);
    console.error('해결 방법:');
    error.velloMessage.suggestions.forEach((suggestion, index) => {
      console.error(`  ${index + 1}. ${suggestion}`);
    });
    
    switch (error.code) {
      case 'TIMEOUT':
        console.error('요청 시간이 초과되었습니다.');
        break;
      case 'NETWORK_ERROR':
        console.error('네트워크 오류가 발생했습니다.');
        break;
      default:
        console.error('HTTP 오류:', error.message);
    }
  }
}
```
```

### 지원하는 에러 코드와 메시지

vello는 다음과 같은 HTTP 상태 코드와 커스텀 에러 코드에 대해 친숙한 설명을 제공합니다:

**HTTP 상태 코드:**
- `400` - 잘못된 요청
- `401` - 인증 실패  
- `403` - 접근 권한 없음
- `404` - 리소스를 찾을 수 없음
- `405` - 허용되지 않는 HTTP 메서드
- `408` - 요청 시간 초과
- `409` - 충돌
- `422` - 처리할 수 없는 엔터티
- `429` - 너무 많은 요청
- `500` - 내부 서버 오류
- `502` - 잘못된 게이트웨이
- `503` - 서비스 이용 불가
- `504` - 게이트웨이 시간 초과

**커스텀 에러 코드:**
- `NETWORK_ERROR` - 네트워크 오류
- `TIMEOUT` - 요청 시간 초과
- `UNKNOWN` - 알 수 없는 오류

각 에러 코드는 다음 정보를 포함합니다:
- **title**: 에러의 간단한 제목
- **description**: 에러에 대한 자세한 설명
- **suggestions**: 문제 해결을 위한 제안사항들

## 응답 객체 구조

```typescript
interface velloResponse<T> {
  data: T;              // 파싱된 응답 데이터
  status: number;       // HTTP 상태 코드
  statusText: string;   // HTTP 상태 텍스트
  headers: Headers;     // 응답 헤더
  config: RequestConfig; // 요청 설정
}
```

## TypeScript 지원

이 라이브러리는 완전한 TypeScript 지원을 제공합니다:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

// 타입 안전한 API 호출
const users = await api.get<User[]>('/users');
const newUser = await api.post<User, CreateUserRequest>('/users', {
  name: 'John',
  email: 'john@example.com'
});
```

## 라이센스

MIT License