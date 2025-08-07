import { vello, VelloError } from '../src';

// 캐싱 기능 사용 예제

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

// 1. 기본 메모리 캐싱 예제
console.log('=== 1. 기본 메모리 캐싱 예제 ===');

const memoryApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5분
    storage: 'memory'
  }
});

async function memorySpeedTest() {
  console.log('첫 번째 요청 (서버에서 가져옴)...');
  const start1 = Date.now();
  const users1 = await memoryApi.get<User[]>('/users?_limit=3');
  const end1 = Date.now();
  console.log(`✅ 첫 번째 요청 완료: ${end1 - start1}ms`);
  console.log('사용자 수:', users1.data.length);
  
  console.log('\n두 번째 요청 (캐시에서 가져옴)...');
  const start2 = Date.now();
  const users2 = await memoryApi.get<User[]>('/users?_limit=3');
  const end2 = Date.now();
  console.log(`⚡ 두 번째 요청 완료: ${end2 - start2}ms (캐시)`);
  console.log('사용자 수:', users2.data.length);
  console.log('statusText:', users2.statusText); // "OK (Cached)" 확인
  
  // 캐시 통계 확인
  const stats = memoryApi.getCacheStats();
  console.log('캐시 통계:', stats);
}

// 2. localStorage 캐싱 예제
console.log('\n=== 2. localStorage 캐싱 예제 ===');

const localStorageApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 10 * 60 * 1000, // 10분
    storage: 'localStorage'
  }
});

async function localStorageTest() {
  try {
    console.log('localStorage 캐싱 테스트...');
    const posts = await localStorageApi.get<Post[]>('/posts?_limit=5');
    console.log('✅ 게시물 가져오기 완료:', posts.data.length);
    
    // 두 번째 요청은 localStorage에서 가져옴
    const cachedPosts = await localStorageApi.get<Post[]>('/posts?_limit=5');
    console.log('⚡ 캐시된 게시물:', cachedPosts.data.length);
    console.log('statusText:', cachedPosts.statusText);
  } catch (error) {
    console.log('localStorage 사용 불가 (서버 환경)');
  }
}

// 3. 개별 요청 캐싱 설정 예제
console.log('\n=== 3. 개별 요청 캐싱 설정 예제 ===');

const selectiveApi = new vello('https://jsonplaceholder.typicode.com');

async function selectiveCaching() {
  // 이 요청만 캐싱됨
  console.log('중요한 데이터 요청 (30분 캐싱)...');
  const importantData = await selectiveApi.get<User>('/users/1', {
    cache: {
      enabled: true,
      ttl: 30 * 60 * 1000, // 30분
      storage: 'memory',
      key: 'important-user-1' // 커스텀 캐시 키
    }
  });
  console.log('✅ 중요한 데이터:', importantData.data.name);
  
  // 이 요청은 캐싱되지 않음
  console.log('실시간 데이터 요청 (캐싱 없음)...');
  const realtimeData = await selectiveApi.get<Post[]>('/posts?_limit=2');
  console.log('✅ 실시간 데이터:', realtimeData.data.length);
  
  // 같은 중요한 데이터 다시 요청 (캐시에서 가져옴)
  console.log('중요한 데이터 재요청 (캐시에서)...');
  const cachedImportantData = await selectiveApi.get<User>('/users/1', {
    cache: {
      enabled: true,
      ttl: 30 * 60 * 1000,
      storage: 'memory',
      key: 'important-user-1'
    }
  });
  console.log('⚡ 캐시된 중요한 데이터:', cachedImportantData.data.name);
  console.log('statusText:', cachedImportantData.statusText);
}

// 4. 커스텀 캐시 키 생성 예제
console.log('\n=== 4. 커스텀 캐시 키 생성 예제 ===');

const customKeyApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000,
    storage: 'memory',
    key: (url, config) => {
      // URL과 사용자 ID를 기반으로 캐시 키 생성
      const userId = 'user123'; // 실제로는 인증된 사용자 ID
      return `${userId}-${url.split('/').pop()}-${config.method}`;
    }
  }
});

async function customKeyTest() {
  console.log('커스텀 캐시 키로 요청...');
  const userData = await customKeyApi.get<User>('/users/1');
  console.log('✅ 사용자 데이터:', userData.data.name);
  
  // 캐시 통계로 커스텀 키 확인
  const stats = customKeyApi.getCacheStats();
  console.log('커스텀 캐시 키들:', stats.keys);
}

// 5. 커스텀 스토리지 예제 (간단한 메모리 스토리지)
console.log('\n=== 5. 커스텀 스토리지 예제 ===');

// 간단한 커스텀 스토리지 구현
class SimpleCustomStorage {
  private storage = new Map<string, any>();
  
  async get(key: string) {
    const item = this.storage.get(key);
    if (item && Date.now() - item.timestamp < item.ttl) {
      return item.data;
    }
    this.storage.delete(key);
    return null;
  }
  
  async set(key: string, value: any, ttl: number = 5 * 60 * 1000) {
    this.storage.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl
    });
  }
  
  async delete(key: string) {
    this.storage.delete(key);
  }
  
  async clear() {
    this.storage.clear();
  }
  
  getStats() {
    return {
      size: this.storage.size,
      keys: Array.from(this.storage.keys())
    };
  }
}

const customStorage = new SimpleCustomStorage();

const customStorageApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 3 * 60 * 1000, // 3분
    storage: 'custom',
    customStorage: {
      get: (key) => customStorage.get(key),
      set: (key, value, ttl) => customStorage.set(key, value, ttl),
      delete: (key) => customStorage.delete(key),
      clear: () => customStorage.clear()
    }
  }
});

async function customStorageTest() {
  console.log('커스텀 스토리지로 요청...');
  const albums = await customStorageApi.get('/albums?_limit=3');
  console.log('✅ 앨범 데이터:', albums.data.length);
  
  console.log('커스텀 스토리지 통계:', customStorage.getStats());
  
  // 캐시된 데이터 다시 요청
  console.log('캐시된 앨범 데이터 요청...');
  const cachedAlbums = await customStorageApi.get('/albums?_limit=3');
  console.log('⚡ 캐시된 앨범:', cachedAlbums.data.length);
  console.log('statusText:', cachedAlbums.statusText);
}

// 6. 캐시 관리 예제
console.log('\n=== 6. 캐시 관리 예제 ===');

const managedApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 2 * 60 * 1000, // 2분
    storage: 'memory'
  }
});

async function cacheManagementTest() {
  // 여러 요청으로 캐시 채우기
  console.log('캐시 채우기...');
  await managedApi.get<User[]>('/users?_limit=2');
  await managedApi.get<Post[]>('/posts?_limit=2');
  await managedApi.get('/comments?_limit=2');
  
  console.log('캐시 통계:', managedApi.getCacheStats());
  
  // 특정 캐시 항목 삭제
  const stats = managedApi.getCacheStats();
  if (stats.keys.length > 0) {
    console.log('첫 번째 캐시 항목 삭제...');
    managedApi.deleteCacheItem(stats.keys[0]);
    console.log('삭제 후 캐시 통계:', managedApi.getCacheStats());
  }
  
  // 전체 캐시 지우기
  console.log('전체 캐시 지우기...');
  managedApi.clearCache();
  console.log('지운 후 캐시 통계:', managedApi.getCacheStats());
}

// 7. TTL(Time To Live) 테스트
console.log('\n=== 7. TTL 테스트 예제 ===');

const ttlApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 2000, // 2초만 캐시
    storage: 'memory'
  }
});

async function ttlTest() {
  console.log('짧은 TTL로 요청...');
  const data1 = await ttlApi.get<User>('/users/1');
  console.log('✅ 첫 번째 요청:', data1.data.name);
  
  console.log('즉시 재요청 (캐시에서)...');
  const data2 = await ttlApi.get<User>('/users/1');
  console.log('⚡ 즉시 재요청:', data2.statusText);
  
  console.log('3초 대기 후 재요청...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const data3 = await ttlApi.get<User>('/users/1');
  console.log('🔄 3초 후 요청:', data3.statusText); // 캐시 만료로 새로 요청
}

// 8. 에러 상황에서의 캐시 동작
console.log('\n=== 8. 에러 상황 캐시 동작 ===');

const errorApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000,
    storage: 'memory'
  }
});

async function errorCacheTest() {
  try {
    // 성공 요청 (캐시됨)
    console.log('성공 요청...');
    const validData = await errorApi.get<User>('/users/1');
    console.log('✅ 성공:', validData.data.name);
    
    // 에러 요청 (캐시되지 않음)
    console.log('에러 요청...');
    try {
      await errorApi.get('/nonexistent');
    } catch (error) {
      console.log('❌ 에러 발생 (예상됨)');
    }
    
    // 성공 요청 재시도 (캐시에서)
    console.log('성공 요청 재시도...');
    const cachedData = await errorApi.get<User>('/users/1');
    console.log('⚡ 캐시에서:', cachedData.statusText);
    
    console.log('캐시 통계:', errorApi.getCacheStats());
    
  } catch (error) {
    console.error('예상치 못한 오류:', error);
  }
}

// 모든 테스트 실행
export async function demonstrateCaching() {
  console.log('=== vello 캐싱 기능 종합 시연 ===\n');
  
  try {
    await memorySpeedTest();
    await localStorageTest();
    await selectiveCaching();
    await customKeyTest();
    await customStorageTest();
    await cacheManagementTest();
    await ttlTest();
    await errorCacheTest();
    
    console.log('\n✅ 모든 캐싱 기능 시연 완료!');
    
  } catch (error) {
    console.error('❌ 캐싱 시연 중 오류:', error);
  }
}

// 개별 테스트 함수들도 export
export {
  memorySpeedTest,
  localStorageTest,
  selectiveCaching,
  customKeyTest,
  customStorageTest,
  cacheManagementTest,
  ttlTest,
  errorCacheTest,
  SimpleCustomStorage
};

// 실행하려면 주석 해제
// demonstrateCaching();
