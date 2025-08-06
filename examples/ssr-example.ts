import { vello, VelloError } from '../src';

// SSR 환경에서의 vello 사용 예제
// Next.js, Nuxt.js 등의 프레임워크에서 서버 사이드 렌더링 시 사용

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

// SSR용 API 클라이언트 - 서버에서만 실행
const ssrApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 5000, // SSR에서는 더 짧은 타임아웃 권장
  defaultHeaders: {
    'User-Agent': 'vello-ssr/1.0.0',
    'Accept': 'application/json'
  },
  retry: {
    retries: 2, // SSR에서는 적은 재시도 횟수 권장
    retryDelay: 500,
    retryCondition: (error) => {
      // 서버 오류만 재시도 (네트워크 오류는 SSR에서 치명적)
      return error.response?.status !== undefined && error.response.status >= 500;
    }
  }
});

// 클라이언트용 API 클라이언트 - 브라우저에서만 실행
const clientApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 15000, // 클라이언트에서는 더 긴 타임아웃 허용
  defaultHeaders: {
    'X-Client-Type': 'browser'
  },
  retry: {
    retries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      return error.code === 'NETWORK_ERROR' || 
             error.code === 'TIMEOUT' || 
             (error.response?.status !== undefined && error.response.status >= 500);
    }
  }
});

/**
 * SSR 함수 예제 - 서버에서 실행
 * Next.js의 getServerSideProps와 같은 함수에서 사용
 */
export async function getServerSideData(userId: string) {
  console.log('🖥️  서버에서 데이터 가져오는 중...');
  
  try {
    // 병렬로 사용자 정보와 게시물 정보 가져오기
    const [userResponse, postsResponse] = await Promise.all([
      ssrApi.get<User>(`/users/${userId}`),
      ssrApi.get<Post[]>(`/users/${userId}/posts`)
    ]);

    return {
      user: userResponse.data,
      posts: postsResponse.data,
      timestamp: new Date().toISOString(),
      source: 'server'
    };
  } catch (error) {
    console.error('❌ SSR 데이터 로딩 실패:', error);
    
    if (error instanceof VelloError) {
      // SSR에서는 에러를 기본값으로 처리하거나 에러 페이지로 리다이렉트
      return {
        user: null,
        posts: [],
        error: {
          message: error.message,
          code: error.code,
          status: error.response?.status
        },
        timestamp: new Date().toISOString(),
        source: 'server'
      };
    }
    
    throw error; // 예상치 못한 에러는 다시 throw
  }
}

/**
 * 클라이언트 사이드 데이터 가져오기 예제
 * React의 useEffect나 Vue의 mounted에서 사용
 */
export async function getClientSideData(userId: string) {
  console.log('🌐 클라이언트에서 데이터 가져오는 중...');
  
  try {
    const response = await clientApi.get<User>(`/users/${userId}`);
    
    return {
      user: response.data,
      timestamp: new Date().toISOString(),
      source: 'client'
    };
  } catch (error) {
    if (error instanceof VelloError) {
      // 클라이언트에서는 사용자에게 친숙한 에러 메시지 표시
      console.error('클라이언트 오류:', {
        title: error.velloMessage.title,
        description: error.velloMessage.description,
        suggestions: error.velloMessage.suggestions
      });
      
      throw new Error(`데이터를 불러올 수 없습니다: ${error.velloMessage.description}`);
    }
    
    throw error;
  }
}

/**
 * 하이브리드 함수 - 환경에 따라 다른 API 클라이언트 사용
 */
export async function getDataUniversal(userId: string) {
  // 환경 감지
  const isServer = typeof window === 'undefined';
  const api = isServer ? ssrApi : clientApi;
  const environment = isServer ? '🖥️  서버' : '🌐 클라이언트';
  
  console.log(`${environment}에서 데이터 가져오는 중...`);
  
  try {
    const response = await api.get<User>(`/users/${userId}`);
    
    return {
      user: response.data,
      timestamp: new Date().toISOString(),
      source: isServer ? 'server' : 'client',
      environment
    };
  } catch (error) {
    console.error(`${environment} 오류:`, error);
    throw error;
  }
}

/**
 * SSR에 최적화된 에러 처리 함수
 */
export function handleSSRError(error: any): {
  shouldRetry: boolean;
  fallbackData: any;
  statusCode: number;
} {
  if (error instanceof VelloError) {
    const status = error.response?.status || 500;
    
    // SSR에서는 특정 에러에 대해 fallback 데이터 제공
    switch (status) {
      case 404:
        return {
          shouldRetry: false,
          fallbackData: null,
          statusCode: 404
        };
      case 500:
      case 502:
      case 503:
        return {
          shouldRetry: true,
          fallbackData: { error: '서버 오류가 발생했습니다.' },
          statusCode: status
        };
      default:
        return {
          shouldRetry: false,
          fallbackData: { error: '알 수 없는 오류가 발생했습니다.' },
          statusCode: status
        };
    }
  }
  
  return {
    shouldRetry: false,
    fallbackData: { error: '예상치 못한 오류가 발생했습니다.' },
    statusCode: 500
  };
}

/**
 * Next.js API Route 예제
 */
export async function apiRouteHandler(req: any, res: any) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId가 필요합니다.' });
    }
    
    const data = await ssrApi.get<User>(`/users/${userId}`);
    
    // 캐시 헤더 설정
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    
    return res.status(200).json({
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const errorInfo = handleSSRError(error);
    
    return res.status(errorInfo.statusCode).json({
      success: false,
      error: errorInfo.fallbackData,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 실제 사용 예제들
 */
export async function demonstrateSSRUsage() {
  console.log('=== SSR 환경에서의 vello 사용법 시연 ===\n');
  
  try {
    // 1. 서버 사이드 데이터 가져오기 (getServerSideProps 스타일)
    console.log('1. 서버 사이드 데이터 가져오기');
    const ssrData = await getServerSideData('1');
    console.log('SSR 결과:', {
      user: ssrData.user?.name,
      postsCount: ssrData.posts.length,
      source: ssrData.source
    });
    console.log();
    
    // 2. 환경 독립적 데이터 가져오기
    console.log('2. 환경 독립적 데이터 가져오기');
    const universalData = await getDataUniversal('2');
    console.log('Universal 결과:', {
      user: universalData.user.name,
      environment: universalData.environment
    });
    console.log();
    
    console.log('✅ SSR 기능 시연 완료!');
    
  } catch (error) {
    console.error('❌ SSR 시연 중 오류:', error);
  }
}

// SSR 환경 감지 유틸리티
export const isServerSide = () => typeof window === 'undefined';
export const isClientSide = () => typeof window !== 'undefined';

// 환경별 API 인스턴스 가져오기
export const getApiInstance = () => isServerSide() ? ssrApi : clientApi;

// 실행 (주석 해제하여 테스트)
// demonstrateSSRUsage();
