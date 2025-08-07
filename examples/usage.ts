import { vello, VelloError } from '../src';

// 사용자 인터페이스 정의
interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

// API 클라이언트 초기화 - retry 및 캐싱 기능 포함
const api = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 15000,
  defaultHeaders: {
    'X-Client-Version': '1.0.0'
  },
  retry: {
    retries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      // 네트워크 오류, 타임아웃, 5xx 서버 오류에 대해서만 재시도
      return error.code === 'NETWORK_ERROR' || 
             error.code === 'TIMEOUT' || 
             (error.response?.status !== undefined && error.response.status >= 500);
    }
  },
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5분 캐시
    storage: 'memory',
    methods: ['GET', 'POST'], // GET과 POST 요청 캐시
    safePaths: ['/search', '/query'] // 안전한 POST 경로
  }
});

// 인터셉터 설정 예제
api.setRequestInterceptor((config) => {
  console.log(`🔄 요청: ${config.method}`);
  
  // 인증 토큰 추가 (실제 환경에서는 localStorage나 다른 저장소에서 가져옴)
  const token = 'your-auth-token';
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  
  return config;
});

api.setResponseInterceptor((response) => {
  console.log(`✅ 응답: ${response.status} ${response.statusText}`);
  return response;
});

api.setErrorInterceptor((error) => {
  console.error(`❌ 에러 발생:`, {
    message: error.message,
    status: error.response?.status,
    code: error.code
  });
});

async function demonstrateFeatures() {
  try {
    console.log('=== EasyPeasy HTTP Client 기능 시연 ===\n');

    // 1. GET 요청 - 자동 JSON 변환 및 타입 지원
    console.log('1. GET 요청 (사용자 목록 조회)');
    const usersResponse = await api.get<User[]>('/users?_limit=3');
    console.log('사용자 수:', usersResponse.data.length);
    console.log('첫 번째 사용자:', usersResponse.data[0]);
    console.log('응답 상태:', usersResponse.status);
    console.log();

    // 2. POST 요청 - 자동 JSON 직렬화
    console.log('2. POST 요청 (새 게시물 생성)');
    const newPost = await api.post('/posts', {
      title: 'EasyPeasy를 사용한 새 게시물',
      body: 'fetch API의 한계를 극복한 HTTP 클라이언트입니다.',
      userId: 1
    });
    console.log('생성된 게시물 ID:', newPost.data.id);
    console.log();

    // 3. 다양한 응답 타입 처리
    console.log('3. 텍스트 응답 처리');
    const textResponse = await api.get('/posts/1', { responseType: 'text' });
    console.log('텍스트 응답 길이:', textResponse.data.length);
    console.log();

    // 4. 커스텀 헤더가 있는 요청
    console.log('4. 커스텀 헤더가 있는 요청');
    const customHeaderResponse = await api.get('/users/1', {
      headers: {
        'X-Custom-Header': 'test-value'
      }
    });
    console.log('사용자 이름:', customHeaderResponse.data.name);
    console.log();

    // 5. 타임아웃 테스트 (시뮬레이션)
    console.log('5. 타임아웃 기능 (짧은 타임아웃으로 테스트)');
    try {
      await api.get('/users', { timeout: 1 }); // 1ms 타임아웃 (실패하도록)
    } catch (error) {
      if (error instanceof VelloError && error.code === 'TIMEOUT') {
        console.log('✅ 타임아웃이 정상적으로 작동했습니다.');
      }
    }
    console.log();

    // 6. 404 에러 처리
    console.log('6. HTTP 오류 상태 코드 자동 처리 (404 에러)');
    try {
      await api.get('/nonexistent-endpoint');
    } catch (error) {
      if (error instanceof VelloError) {
        console.log(`✅ HTTP 오류가 자동으로 감지되었습니다: ${error.message}`);
        console.log(`상태 코드: ${error.response?.status}`);
        console.log(`친숙한 에러 메시지:`);
        console.log(`  제목: ${error.velloMessage.title}`);
        console.log(`  설명: ${error.velloMessage.description}`);
        console.log(`  해결 방법:`);
        error.velloMessage.suggestions.forEach((suggestion, index) => {
          console.log(`    ${index + 1}. ${suggestion}`);
        });
      }
    }
    console.log();

    // 7. 다양한 HTTP 에러 코드 테스트
    console.log('7. 다양한 HTTP 에러 코드의 친숙한 메시지');
    
    // 인위적으로 에러 생성하여 메시지 확인
    const testErrors = [
      { status: 400, code: '400' },
      { status: 401, code: '401' },
      { status: 403, code: '403' },
      { status: 500, code: '500' },
      { code: 'NETWORK_ERROR' },
      { code: 'TIMEOUT' }
    ];

    testErrors.forEach(({ status, code }) => {
      const mockResponse = status ? { 
        status, 
        statusText: 'Test Error',
        data: {},
        headers: new Headers(),
        config: {}
      } : undefined;
      
      const testError = new VelloError(
        `Test error ${code}`,
        {},
        mockResponse as any,
        code
      );
      
      console.log(`${code} 에러:`);
      console.log(`  ${testError.velloMessage.title}: ${testError.velloMessage.description}`);
    });
    console.log();

    // 7. PUT 요청
    console.log('7. PUT 요청 (사용자 정보 업데이트)');
    const updatedUser = await api.put<User>('/users/1', {
      id: 1,
      name: 'Updated Name',
      email: 'updated@example.com',
      username: 'updated_user'
    });
    console.log('업데이트된 사용자:', updatedUser.data.name);
    console.log();

    // 8. PATCH 요청
    console.log('8. PATCH 요청 (부분 업데이트)');
    const patchedUser = await api.patch('/users/1', {
      name: 'Patched Name'
    });
    console.log('부분 업데이트된 이름:', patchedUser.data.name);
    console.log();

    // 9. DELETE 요청
    console.log('9. DELETE 요청');
    const deleteResponse = await api.delete('/posts/1');
    console.log('삭제 응답 상태:', deleteResponse.status);
    console.log();

    // 10. Retry 기능 시연
    console.log('10. Retry 기능 시연');
    
    // 개별 요청에 retry 설정
    try {
      const retryResponse = await api.get('/posts/1', {
        retry: {
          retries: 2,
          retryDelay: 500,
          retryDelayFunction: (retryCount) => 500 * Math.pow(2, retryCount) // 지수 백오프
        }
      });
      console.log('✅ Retry 설정이 적용된 요청 성공');
    } catch (error) {
      console.log('Retry 후에도 실패한 요청');
    }
    console.log();

    // 11. 고급 Retry 설정
    console.log('11. 고급 Retry 설정');
    
    // 전역 retry 설정 변경
    api.setRetries(5);
    api.setRetryDelay(2000);
    api.setRetryCondition((error) => {
      // 404는 재시도하지 않고, 5xx 오류만 재시도
      return error.response?.status !== undefined && error.response.status >= 500;
    });
    
    console.log('✅ 고급 retry 설정이 적용되었습니다');
    console.log();

    console.log('✅ 모든 기능 시연이 완료되었습니다!');

  } catch (error) {
    console.error('예상치 못한 오류가 발생했습니다:', error);
  }
}

// 기능 시연 실행
// demonstrateFeatures();

// 더 간단한 사용 예제
async function simpleExample() {
  console.log('=== 간단한 사용 예제 ===\n');

  // 기본 사용법
  const simpleApi = new vello('https://jsonplaceholder.typicode.com');
  
  try {
    // 사용자 목록 가져오기
    const users = await simpleApi.get<User[]>('/users?_limit=2');
    console.log('사용자 목록:', users.data.map(u => u.name));

    // 새 게시물 작성
    const newPost = await simpleApi.post('/posts', {
      title: '간단한 예제 게시물',
      body: 'EasyPeasy로 쉽게 만든 게시물입니다!',
      userId: 1
    });
    console.log('새 게시물 생성됨, ID:', newPost.data.id);

  } catch (error) {
    if (error instanceof VelloError) {
      console.error('API 오류:', error.message);
    } else {
      console.error('알 수 없는 오류:', error);
    }
  }
}

// 실행하려면 주석을 해제하세요
// simpleExample();

export { demonstrateFeatures, simpleExample };
