export interface RetryConfig {
  retries?: number;
  retryDelay?: number;
  retryCondition?: (error: VelloError) => boolean;
  retryDelayFunction?: (retryCount: number, error: VelloError) => number;
}

export interface VelloConfig {
  baseUrl: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  retry?: RetryConfig;
  requestInterceptor?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  responseInterceptor?: (response: VelloResponse<any>) => VelloResponse<any> | Promise<VelloResponse<any>>;
  errorInterceptor?: (error: VelloError) => void | Promise<void>;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  baseUrl?: string;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';
  retry?: RetryConfig;
}

export interface VelloResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestConfig;
}

export interface ErrorMessageInfo {
  title: string;
  description: string;
  suggestions: string[];
}

export class VelloError extends Error {
  public velloMessage: ErrorMessageInfo;
  
  constructor(
    message: string,
    public config?: RequestConfig,
    public response?: VelloResponse,
    public code?: string,
    public retryCount?: number
  ) {
    super(message);
    this.name = 'VelloError';
    this.velloMessage = this.getVelloMessage();
  }

  private getVelloMessage(): ErrorMessageInfo {
    const statusCode = this.response?.status?.toString() || this.code || 'UNKNOWN';
    
    // errorMessages.json에서 가져올 기본 메시지들
    const errorMessages: Record<string, ErrorMessageInfo> = {
      '400': {
        title: '잘못된 요청',
        description: '요청 형식이 올바르지 않습니다. 요청 데이터를 확인해주세요.',
        suggestions: ['요청 파라미터나 본문 데이터의 형식을 확인하세요', '필수 필드가 누락되지 않았는지 확인하세요', '데이터 타입이 올바른지 확인하세요']
      },
      '401': {
        title: '인증 실패',
        description: '인증이 필요하거나 제공된 인증 정보가 올바르지 않습니다.',
        suggestions: ['로그인 상태를 확인하세요', '인증 토큰이 만료되지 않았는지 확인하세요', 'API 키나 인증 헤더가 올바른지 확인하세요']
      },
      '403': {
        title: '접근 권한 없음',
        description: '해당 리소스에 접근할 권한이 없습니다.',
        suggestions: ['계정의 권한을 확인하세요', '관리자에게 접근 권한을 요청하세요', '올바른 역할이나 그룹에 속해있는지 확인하세요']
      },
      '404': {
        title: '리소스를 찾을 수 없음',
        description: '요청한 API 엔드포인트나 리소스가 존재하지 않습니다.',
        suggestions: ['URL 경로가 올바른지 확인하세요', 'API 문서를 참조하여 올바른 엔드포인트를 사용하세요', '리소스 ID가 정확한지 확인하세요']
      },
      '405': {
        title: '허용되지 않는 HTTP 메서드',
        description: '해당 엔드포인트에서 사용한 HTTP 메서드가 지원되지 않습니다.',
        suggestions: ['API 문서에서 지원되는 HTTP 메서드를 확인하세요', 'GET, POST, PUT, PATCH, DELETE 중 올바른 메서드를 사용하세요']
      },
      '408': {
        title: '요청 시간 초과',
        description: '서버가 요청을 기다리는 시간이 초과되었습니다.',
        suggestions: ['네트워크 연결 상태를 확인하세요', '요청 타임아웃 설정을 늘려보세요', '잠시 후 다시 시도해보세요']
      },
      '409': {
        title: '충돌',
        description: '요청이 현재 리소스 상태와 충돌합니다.',
        suggestions: ['리소스의 현재 상태를 확인하세요', '중복된 데이터를 생성하려고 하지 않았는지 확인하세요', '다른 사용자가 동시에 같은 리소스를 수정하지 않았는지 확인하세요']
      },
      '422': {
        title: '처리할 수 없는 엔터티',
        description: '요청 형식은 올바르지만 내용을 처리할 수 없습니다.',
        suggestions: ['입력 데이터의 유효성을 확인하세요', '필수 필드가 모두 포함되어 있는지 확인하세요', '데이터 형식과 제약 조건을 확인하세요']
      },
      '429': {
        title: '너무 많은 요청',
        description: '요청 속도 제한에 걸렸습니다.',
        suggestions: ['잠시 후 다시 시도해주세요', '요청 간격을 늘려주세요', 'API 사용량 제한을 확인하세요']
      },
      '500': {
        title: '내부 서버 오류',
        description: '서버에서 예상치 못한 오류가 발생했습니다.',
        suggestions: ['잠시 후 다시 시도해주세요', '문제가 지속되면 관리자에게 문의하세요', '서버 상태를 확인해주세요']
      },
      '502': {
        title: '잘못된 게이트웨이',
        description: '게이트웨이나 프록시 서버에서 잘못된 응답을 받았습니다.',
        suggestions: ['네트워크 연결을 확인하세요', '잠시 후 다시 시도해주세요', '서버 인프라 상태를 확인하세요']
      },
      '503': {
        title: '서비스 이용 불가',
        description: '서버가 일시적으로 이용할 수 없는 상태입니다.',
        suggestions: ['서버 점검 중일 수 있습니다', '잠시 후 다시 시도해주세요', '서비스 상태 페이지를 확인하세요']
      },
      '504': {
        title: '게이트웨이 시간 초과',
        description: '게이트웨이나 프록시 서버에서 응답 시간이 초과되었습니다.',
        suggestions: ['네트워크 연결을 확인하세요', '요청 타임아웃을 늘려보세요', '잠시 후 다시 시도해주세요']
      },
      'NETWORK_ERROR': {
        title: '네트워크 오류',
        description: '네트워크 연결에 문제가 발생했습니다.',
        suggestions: ['인터넷 연결 상태를 확인하세요', '방화벽이나 프록시 설정을 확인하세요', '서버 주소가 올바른지 확인하세요']
      },
      'TIMEOUT': {
        title: '요청 시간 초과',
        description: '설정된 시간 내에 응답을 받지 못했습니다.',
        suggestions: ['네트워크 속도를 확인하세요', '타임아웃 설정을 늘려보세요', '서버 응답 속도를 확인하세요']
      },
      'UNKNOWN': {
        title: '알 수 없는 오류',
        description: '예상치 못한 오류가 발생했습니다.',
        suggestions: ['요청을 다시 시도해보세요', '브라우저 콘솔에서 자세한 오류를 확인하세요', '개발자에게 문의하세요']
      }
    };

    return errorMessages[statusCode] || errorMessages['UNKNOWN'];
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';