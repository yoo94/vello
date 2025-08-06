import { vello, VelloError } from '../src';

// Next.js 15 App Router 환경에서의 vello 사용 예제
// app/ 디렉토리 구조와 Server Components, Client Components에서의 사용법

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

// Server Components용 API 클라이언트
const serverApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  defaultHeaders: {
    'User-Agent': 'vello-nextjs15-server/1.0.0',
  },
  retry: {
    retries: 1, // Server Components에서는 빠른 실패 권장
    retryDelay: 300,
    retryCondition: (error) => {
      return error.response?.status !== undefined && error.response.status >= 500;
    }
  }
});

// Client Components용 API 클라이언트
const clientApi = new vello({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 15000,
  defaultHeaders: {
    'X-Client-Type': 'nextjs15-client',
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
 * Server Component에서 데이터 가져오기 (app/users/[id]/page.tsx)
 * Next.js 15에서는 async Server Components 사용
 */
export async function getServerComponentData(userId: string) {
  console.log('🖥️ Server Component에서 데이터 가져오는 중...');
  
  try {
    // Next.js 15에서는 자동으로 fetch 요청이 캐시됨
    const userResponse = await serverApi.get<User>(`/users/${userId}`);
    
    return {
      user: userResponse.data,
      timestamp: new Date().toISOString(),
      type: 'server-component'
    };
  } catch (error) {
    console.error('❌ Server Component 데이터 로딩 실패:', error);
    
    if (error instanceof VelloError) {
      // Server Component에서는 notFound()나 에러 바운더리로 처리
      if (error.response?.status === 404) {
        // notFound() 호출을 시뮬레이션
        throw new Error('NOT_FOUND');
      }
      
      // 다른 에러는 에러 바운더리가 처리하도록
      throw new Error(`서버 오류: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Server Action 예제 (app/actions.ts)
 * Next.js 15에서 form 처리나 서버 측 로직에 사용
 */
export async function createUserAction(formData: FormData) {
  'use server'; // Next.js 15 Server Action 지시어
  
  console.log('🚀 Server Action 실행 중...');
  
  try {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    
    if (!name || !email) {
      return {
        success: false,
        error: '이름과 이메일이 필요합니다.'
      };
    }
    
    const response = await serverApi.post<User>('/users', {
      name,
      email,
      username: name.toLowerCase().replace(/\s+/g, '_')
    });
    
    return {
      success: true,
      data: response.data,
      message: '사용자가 성공적으로 생성되었습니다.'
    };
    
  } catch (error) {
    console.error('❌ Server Action 실행 실패:', error);
    
    if (error instanceof VelloError) {
      return {
        success: false,
        error: error.velloMessage.description,
        code: error.code
      };
    }
    
    return {
      success: false,
      error: '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * Route Handler 예제 (app/api/users/[id]/route.ts)
 * Next.js 15의 새로운 Route Handler 형식
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log('🔗 Route Handler GET 요청 처리 중...');
  
  try {
    const { id } = params;
    
    if (!id) {
      return Response.json(
        { error: 'User ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const response = await serverApi.get<User>(`/users/${id}`);
    
    // Next.js 15에서는 Response.json() 사용 권장
    return Response.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
    
  } catch (error) {
    console.error('❌ Route Handler 오류:', error);
    
    if (error instanceof VelloError) {
      const status = error.response?.status || 500;
      
      return Response.json({
        success: false,
        error: error.velloMessage.description,
        code: error.code
      }, { status });
    }
    
    return Response.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('🔗 Route Handler POST 요청 처리 중...');
  
  try {
    const body = await request.json();
    
    const response = await serverApi.post<User>('/users', body);
    
    return Response.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    }, { status: 201 });
    
  } catch (error) {
    console.error('❌ Route Handler POST 오류:', error);
    
    if (error instanceof VelloError) {
      return Response.json({
        success: false,
        error: error.velloMessage.description
      }, { status: error.response?.status || 500 });
    }
    
    return Response.json({
      success: false,
      error: '사용자 생성에 실패했습니다.'
    }, { status: 500 });
  }
}

/**
 * Client Component에서 사용하는 hook 예제
 * "use client" 지시어가 있는 컴포넌트에서 사용
 */
export function useUserData(userId: string) {
  // 실제로는 React hooks 사용하지만, 여기서는 함수로 시뮬레이션
  
  const fetchUserData = async () => {
    console.log('🌐 Client Component에서 데이터 가져오는 중...');
    
    try {
      const response = await clientApi.get<User>(`/users/${userId}`);
      
      return {
        user: response.data,
        loading: false,
        error: null
      };
    } catch (error) {
      console.error('❌ Client Component 오류:', error);
      
      if (error instanceof VelloError) {
        return {
          user: null,
          loading: false,
          error: {
            message: error.velloMessage.description,
            suggestions: error.velloMessage.suggestions
          }
        };
      }
      
      return {
        user: null,
        loading: false,
        error: { message: '알 수 없는 오류가 발생했습니다.' }
      };
    }
  };
  
  return { fetchUserData };
}

/**
 * Middleware에서 사용하는 예제 (middleware.ts)
 * Next.js 15에서 요청 전처리나 인증에 사용
 */
export async function middlewareAuth(request: Request) {
  console.log('🔐 Middleware 인증 확인 중...');
  
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return {
        success: false,
        error: '인증 토큰이 필요합니다.',
        status: 401
      };
    }
    
    // 외부 인증 서비스에 토큰 검증 요청
    const authApi = new vello({
      baseUrl: 'https://api.auth-service.com',
      timeout: 3000, // Middleware에서는 빠른 응답 필요
      defaultHeaders: {
        'Authorization': authHeader
      }
    });
    
    const response = await authApi.get('/verify');
    
    return {
      success: true,
      user: response.data,
      status: 200
    };
    
  } catch (error) {
    console.error('❌ Middleware 인증 실패:', error);
    
    if (error instanceof VelloError) {
      return {
        success: false,
        error: '인증에 실패했습니다.',
        status: error.response?.status || 401
      };
    }
    
    return {
      success: false,
      error: '인증 서비스 오류',
      status: 500
    };
  }
}

/**
 * Next.js 15 App Router 환경별 사용법 시연
 */
export async function demonstrateNextJS15Usage() {
  console.log('=== Next.js 15 App Router에서의 vello 사용법 시연 ===\n');
  
  try {
    // 1. Server Component 데이터 가져오기
    console.log('1. Server Component 데이터 가져오기');
    const serverData = await getServerComponentData('1');
    console.log('Server Component 결과:', {
      user: serverData.user.name,
      type: serverData.type
    });
    console.log();
    
    // 2. Server Action 시뮬레이션
    console.log('2. Server Action 시뮬레이션');
    const formData = new FormData();
    formData.append('name', 'Next.js User');
    formData.append('email', 'nextjs@example.com');
    
    const actionResult = await createUserAction(formData);
    console.log('Server Action 결과:', {
      success: actionResult.success,
      message: actionResult.success ? actionResult.message : actionResult.error
    });
    console.log();
    
    // 3. Route Handler 시뮬레이션
    console.log('3. Route Handler 시뮬레이션');
    const mockRequest = new Request('http://localhost:3000/api/users/1');
    const routeResponse = await GET(mockRequest, { params: { id: '1' } });
    const routeData = await routeResponse.json();
    console.log('Route Handler 결과:', {
      success: routeData.success,
      userName: routeData.data?.name
    });
    console.log();
    
    console.log('✅ Next.js 15 기능 시연 완료!');
    
  } catch (error) {
    console.error('❌ Next.js 15 시연 중 오류:', error);
  }
}

/**
 * Next.js 15 특화 유틸리티들
 */

// 환경 감지 (Next.js 15 App Router)
export const isServerComponent = () => typeof window === 'undefined';
export const isClientComponent = () => typeof window !== 'undefined';

// Next.js 15 캐시 무효화 도우미
export function revalidateUserData(userId: string) {
  // 실제로는 revalidatePath나 revalidateTag 사용
  console.log(`🔄 사용자 ${userId} 데이터 캐시 무효화`);
}

// Next.js 15 스트리밍을 위한 청크 데이터
export async function* getStreamingUserData(userIds: string[]) {
  for (const userId of userIds) {
    try {
      const data = await serverApi.get<User>(`/users/${userId}`);
      yield {
        userId,
        user: data.data,
        success: true
      };
    } catch (error) {
      yield {
        userId,
        user: null,
        success: false,
        error: error instanceof VelloError ? error.message : '오류 발생'
      };
    }
  }
}

// 실행 (주석 해제하여 테스트)
// demonstrateNextJS15Usage();
