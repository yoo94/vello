import { vello, VelloError } from '../src';

// POST 요청 캐싱을 포함한 고급 캐싱 예제

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface SearchRequest {
  query: string;
  filters: {
    category?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  pagination: {
    page: number;
    size: number;
  };
}

interface SearchResult {
  items: any[];
  total: number;
  page: number;
  hasMore: boolean;
}

// 1. 특정 메서드만 캐시하는 예제
console.log('=== 1. 특정 HTTP 메서드 캐시 예제 ===');

const methodSpecificApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5분
    methods: ['GET', 'POST'], // GET과 POST만 캐시
    storage: 'memory'
  }
});

async function methodSpecificCaching() {
  // GET 요청 (캐시됨)
  console.log('GET 요청 (캐시됨)...');
  const users1 = await methodSpecificApi.get<User[]>('/users?_limit=2');
  console.log('✅ GET 결과:', users1.data.length, '사용자');
  
  // POST 요청 (캐시됨)
  console.log('POST 요청 (캐시됨)...');
  const post1 = await methodSpecificApi.post('/posts', {
    title: 'Test Post',
    body: 'This is a test post',
    userId: 1
  });
  console.log('✅ POST 결과:', post1.data.id);
  
  // 같은 POST 요청 다시 (캐시에서)
  console.log('같은 POST 요청 재시도...');
  const post2 = await methodSpecificApi.post('/posts', {
    title: 'Test Post',
    body: 'This is a test post',
    userId: 1
  });
  console.log('⚡ POST 캐시:', post2.statusText); // "(Cached)" 포함
  
  // PUT 요청 (캐시되지 않음 - methods에 없음)
  console.log('PUT 요청 (캐시되지 않음)...');
  const put1 = await methodSpecificApi.put('/posts/1', {
    title: 'Updated Post',
    body: 'Updated content',
    userId: 1
  });
  console.log('✅ PUT 결과:', put1.statusText); // "(Cached)" 없음
}

// 2. 안전한 POST 경로 지정 예제
console.log('\n=== 2. 안전한 POST 경로 지정 예제 ===');

const safePathApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 3 * 60 * 1000, // 3분
    safePaths: ['/search', '/query', '/filter'], // 이 경로들의 POST는 캐시
    storage: 'memory'
  }
});

async function safePathCaching() {
  // '/search' 경로의 POST 요청 (캐시됨)
  console.log('안전한 POST 경로 요청...');
  
  // 실제로는 검색 API이지만 예제를 위해 일반 API 사용
  const mockSearchApi = new vello({
    baseUrl: 'https://jsonplaceholder.typicode.com',
    cache: {
      enabled: true,
      ttl: 60000,
      safePaths: ['/posts'], // posts 경로를 안전한 조회 경로로 가정
      storage: 'memory'
    }
  });
  
  const search1 = await mockSearchApi.post('/posts', {
    query: 'test search',
    filters: { category: 'tech' }
  });
  console.log('✅ 검색 결과:', search1.data.id);
  
  // 같은 검색 요청 (캐시에서)
  const search2 = await mockSearchApi.post('/posts', {
    query: 'test search',
    filters: { category: 'tech' }
  });
  console.log('⚡ 캐시된 검색:', search2.statusText);
}

// 3. GraphQL 요청 캐싱 예제
console.log('\n=== 3. GraphQL 요청 캐싱 예제 ===');

const graphqlApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 10 * 60 * 1000, // 10분
    storage: 'memory'
  }
});

async function graphqlCaching() {
  // GraphQL 쿼리 시뮬레이션 (실제로는 REST API이지만 예제용)
  console.log('GraphQL 스타일 POST 요청...');
  
  const query1 = await graphqlApi.post('/posts', {
    query: `
      query GetUsers {
        users {
          id
          name
          email
        }
      }
    `
  }, {
    headers: {
      'Content-Type': 'application/graphql'
    },
    cache: {
      enabled: true,
      ttl: 60000
    }
  });
  console.log('✅ GraphQL 쿼리 결과:', query1.data.id);
  
  // 같은 쿼리 재실행 (캐시에서)
  const query2 = await graphqlApi.post('/posts', {
    query: `
      query GetUsers {
        users {
          id
          name
          email
        }
      }
    `
  }, {
    headers: {
      'Content-Type': 'application/graphql'
    },
    cache: {
      enabled: true,
      ttl: 60000
    }
  });
  console.log('⚡ 캐시된 GraphQL:', query2.statusText);
}

// 4. Unsafe 메서드 전면 허용 예제
console.log('\n=== 4. Unsafe 메서드 전면 허용 예제 ===');

const unsafeAllowedApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 30000, // 30초 (짧은 캐시)
    allowUnsafeMethods: true, // 모든 메서드 캐시 허용
    storage: 'memory'
  }
});

async function unsafeMethodCaching() {
  console.log('⚠️  주의: 모든 메서드 캐시 허용 모드');
  
  // POST 요청 (캐시됨)
  const post = await unsafeAllowedApi.post('/posts', {
    title: 'Cached POST',
    body: 'This POST will be cached',
    userId: 1
  });
  console.log('✅ POST 캐시:', post.data.id);
  
  // PUT 요청 (캐시됨)
  const put = await unsafeAllowedApi.put('/posts/1', {
    title: 'Cached PUT',
    body: 'This PUT will be cached',
    userId: 1
  });
  console.log('✅ PUT 캐시:', put.data.id);
  
  // PATCH 요청 (캐시됨)
  const patch = await unsafeAllowedApi.patch('/posts/1', {
    title: 'Cached PATCH'
  });
  console.log('✅ PATCH 캐시:', patch.data.id);
  
  // 같은 요청들 재실행 (모두 캐시에서)
  console.log('캐시된 요청들 재실행...');
  const cachedPost = await unsafeAllowedApi.post('/posts', {
    title: 'Cached POST',
    body: 'This POST will be cached',
    userId: 1
  });
  console.log('⚡ 캐시된 POST:', cachedPost.statusText);
}

// 5. 개별 요청별 캐시 설정 예제
console.log('\n=== 5. 개별 요청별 캐시 설정 예제 ===');

const individualApi = new vello('https://jsonplaceholder.typicode.com');

async function individualRequestCaching() {
  // 전역적으로는 캐시하지 않지만, 특정 POST 요청만 캐시
  console.log('개별 POST 요청 캐시 설정...');
  
  const expensiveSearch = await individualApi.post('/posts', {
    query: 'expensive search',
    complexFilters: {
      nested: {
        data: 'complex'
      }
    }
  }, {
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5분
      key: 'expensive-search-cache', // 커스텀 키
      allowUnsafeMethods: true // 이 요청만 POST 캐시 허용
    }
  });
  console.log('✅ 비싼 검색:', expensiveSearch.data.id);
  
  // 같은 검색 재실행 (캐시에서)
  const cachedSearch = await individualApi.post('/posts', {
    query: 'expensive search',
    complexFilters: {
      nested: {
        data: 'complex'
      }
    }
  }, {
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000,
      key: 'expensive-search-cache',
      allowUnsafeMethods: true
    }
  });
  console.log('⚡ 캐시된 검색:', cachedSearch.statusText);
  
  // 다른 POST 요청 (캐시되지 않음)
  const normalPost = await individualApi.post('/posts', {
    title: 'Normal Post',
    body: 'This will not be cached'
  });
  console.log('✅ 일반 POST (캐시 없음):', normalPost.statusText);
}

// 6. 복잡한 캐시 키 생성 예제
console.log('\n=== 6. 복잡한 캐시 키 생성 예제 ===');

const complexKeyApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 60000,
    methods: ['GET', 'POST'],
    key: (url, config) => {
      // 사용자 ID와 요청 내용 기반 캐시 키
      const userId = 'user123'; // 실제로는 인증된 사용자 ID
      const method = config.method || 'GET';
      const bodyHash = config.body ? 
        btoa(JSON.stringify(config.body)).slice(0, 10) : 'nobody';
      
      return `${userId}-${method}-${url.split('/').pop()}-${bodyHash}`;
    },
    storage: 'memory'
  }
});

async function complexKeyCaching() {
  console.log('복잡한 캐시 키로 POST 요청...');
  
  const complexPost = await complexKeyApi.post('/posts', {
    userPreferences: {
      theme: 'dark',
      language: 'ko'
    },
    searchParams: {
      query: 'vello cache',
      filters: ['tech', 'javascript']
    }
  });
  console.log('✅ 복잡한 POST:', complexPost.data.id);
  
  // 캐시 통계로 생성된 키 확인
  const stats = complexKeyApi.getCacheStats();
  console.log('생성된 캐시 키들:', stats.keys);
  
  // 같은 요청 재실행
  const cachedComplexPost = await complexKeyApi.post('/posts', {
    userPreferences: {
      theme: 'dark',
      language: 'ko'
    },
    searchParams: {
      query: 'vello cache',
      filters: ['tech', 'javascript']
    }
  });
  console.log('⚡ 캐시된 복잡한 POST:', cachedComplexPost.statusText);
}

// 7. 캐시 무효화 및 관리 예제
console.log('\n=== 7. 캐시 무효화 및 관리 예제 ===');

const managedApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 60000,
    allowUnsafeMethods: true,
    storage: 'memory'
  }
});

async function cacheManagement() {
  console.log('캐시 관리 테스트...');
  
  // 여러 POST 요청으로 캐시 채우기
  await managedApi.post('/posts', { title: 'Post 1', userId: 1 });
  await managedApi.post('/posts', { title: 'Post 2', userId: 2 });
  await managedApi.get('/users/1');
  
  console.log('캐시 통계:', managedApi.getCacheStats());
  
  // 데이터 변경 후 관련 캐시 무효화
  console.log('데이터 변경 시뮬레이션...');
  await managedApi.put('/posts/1', { title: 'Updated Post 1' });
  
  // 관련 캐시 수동 삭제 (실제로는 더 정교한 로직 필요)
  const stats = managedApi.getCacheStats();
  const postCacheKeys = stats.keys.filter(key => key.includes('posts'));
  postCacheKeys.forEach(key => {
    managedApi.deleteCacheItem(key);
    console.log('🗑️  캐시 삭제:', key);
  });
  
  console.log('캐시 정리 후 통계:', managedApi.getCacheStats());
}

// 모든 테스트 실행
export async function demonstratePostCaching() {
  console.log('=== POST 요청 캐싱 기능 종합 시연 ===\n');
  
  try {
    await methodSpecificCaching();
    await safePathCaching();
    await graphqlCaching();
    await unsafeMethodCaching();
    await individualRequestCaching();
    await complexKeyCaching();
    await cacheManagement();
    
    console.log('\n✅ 모든 POST 캐싱 기능 시연 완료!');
    console.log('\n🎯 주요 특징:');
    console.log('- 특정 HTTP 메서드만 선택적 캐시');
    console.log('- 안전한 POST 경로 지정');
    console.log('- GraphQL 요청 자동 감지 및 캐시');
    console.log('- Unsafe 메서드 전면 허용 옵션');
    console.log('- 개별 요청별 세밀한 캐시 제어');
    console.log('- 복잡한 캐시 키 생성 로직');
    console.log('- 캐시 무효화 및 관리');
    
  } catch (error) {
    console.error('❌ POST 캐싱 시연 중 오류:', error);
  }
}

// 개별 테스트 함수들도 export
export {
  methodSpecificCaching,
  safePathCaching,
  graphqlCaching,
  unsafeMethodCaching,
  individualRequestCaching,
  complexKeyCaching,
  cacheManagement
};

// 실행하려면 주석 해제
// demonstratePostCaching();
