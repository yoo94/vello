import { VelloConfig, RequestConfig, VelloResponse, VelloError, HttpMethod, RetryConfig, CacheConfig, CachedResponse } from './types';

export class vello {
    private config: VelloConfig;
    private cache: Map<string, CachedResponse> = new Map(); // 메모리 캐시

    constructor(config: VelloConfig | string) {
        if (typeof config === 'string') {
            this.config = { baseUrl: config };
        } else {
            this.config = config;
        }
    }

    // HTTP 메서드들
    async get<T = any>(endpoint: string, options?: RequestConfig): Promise<VelloResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    async post<T = any>(endpoint: string, body?: any, options?: RequestConfig): Promise<VelloResponse<T>> {
        const config: RequestConfig = { ...options, method: 'POST' };
        if (body !== undefined) {
            config.body = this.serializeBody(body);
        }
        return this.request<T>(endpoint, config);
    }

    async patch<T = any>(endpoint: string, body?: any, options?: RequestConfig): Promise<VelloResponse<T>> {
        const config: RequestConfig = { ...options, method: 'PATCH' };
        if (body !== undefined) {
            config.body = this.serializeBody(body);
        }
        return this.request<T>(endpoint, config);
    }

    async delete<T = any>(endpoint: string, options?: RequestConfig): Promise<VelloResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }

    async put<T = any>(endpoint: string, body?: any, options?: RequestConfig): Promise<VelloResponse<T>> {
        const config: RequestConfig = { ...options, method: 'PUT' };
        if (body !== undefined) {
            config.body = this.serializeBody(body);
        }
        return this.request<T>(endpoint, config);
    }

    // 인터셉터 설정 메서드들
    setRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>): void {
        this.config.requestInterceptor = interceptor;
    }

    setResponseInterceptor(interceptor: (response: VelloResponse<any>) => VelloResponse<any> | Promise<VelloResponse<any>>): void {
        this.config.responseInterceptor = interceptor;
    }

    setErrorInterceptor(interceptor: (error: VelloError) => void | Promise<void>): void {
        this.config.errorInterceptor = interceptor;
    }

    // 기본 헤더 설정
    setDefaultHeader(key: string, value: string): void {
        if (!this.config.defaultHeaders) {
            this.config.defaultHeaders = {};
        }
        this.config.defaultHeaders[key] = value;
    }

    removeDefaultHeader(key: string): void {
        if (this.config.defaultHeaders) {
            delete this.config.defaultHeaders[key];
        }
    }

    // Retry 설정 메서드들
    setRetryConfig(retryConfig: RetryConfig): void {
        this.config.retry = retryConfig;
    }

    setRetries(retries: number): void {
        if (!this.config.retry) {
            this.config.retry = {};
        }
        this.config.retry.retries = retries;
    }

    setRetryDelay(delay: number): void {
        if (!this.config.retry) {
            this.config.retry = {};
        }
        this.config.retry.retryDelay = delay;
    }

    setRetryCondition(condition: (error: VelloError) => boolean): void {
        if (!this.config.retry) {
            this.config.retry = {};
        }
        this.config.retry.retryCondition = condition;
    }

    // 캐시 관련 메서드들
    setCacheConfig(cacheConfig: CacheConfig): void {
        this.config.cache = cacheConfig;
    }

    clearCache(): void {
        this.cache.clear();
        if (this.config.cache?.storage === 'localStorage') {
            this.clearStorageCache('localStorage');
        } else if (this.config.cache?.storage === 'sessionStorage') {
            this.clearStorageCache('sessionStorage');
        } else if (this.config.cache?.storage === 'custom' && this.config.cache.customStorage?.clear) {
            this.config.cache.customStorage.clear();
        }
    }

    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    deleteCacheItem(key: string): void {
        this.cache.delete(key);
        if (this.config.cache?.storage === 'localStorage') {
            localStorage.removeItem(key);
        } else if (this.config.cache?.storage === 'sessionStorage') {
            sessionStorage.removeItem(key);
        } else if (this.config.cache?.storage === 'custom' && this.config.cache.customStorage?.delete) {
            this.config.cache.customStorage.delete(key);
        }
    }

    private async request<T = any>(endpoint: string, options: RequestConfig): Promise<VelloResponse<T>> {
        let requestConfig: RequestConfig = {
            timeout: this.config.timeout || 10000,
            responseType: 'json',
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this.config.defaultHeaders,
                ...options.headers,
            },
            retry: {
                retries: 0,
                retryDelay: 1000,
                retryCondition: (error: VelloError) => this.defaultRetryCondition(error),
                ...this.config.retry,
                ...options.retry,
            },
            cache: {
                enabled: false,
                ttl: 5 * 60 * 1000, // 기본 5분
                storage: 'memory',
                ...this.config.cache,
                ...options.cache,
            }
        };

        if (this.config.requestInterceptor) {
            requestConfig = await Promise.resolve(this.config.requestInterceptor(requestConfig));
        }

        // 캐시 확인 (캐시 가능한 요청)
        if (requestConfig.cache?.enabled && this.isCacheableRequest(endpoint, requestConfig)) {
            const url = `${requestConfig.baseUrl || this.config.baseUrl}${endpoint}`;
            const cacheKey = this.generateCacheKey(url, requestConfig);
            const cachedResponse = await this.getFromCache<T>(cacheKey, requestConfig.cache);
            
            if (cachedResponse && this.isCacheValid(cachedResponse, requestConfig.cache.ttl || 5 * 60 * 1000)) {
                console.log('🎯 캐시에서 응답 반환:', cacheKey);
                
                const response: VelloResponse<T> = {
                    data: cachedResponse.data,
                    status: cachedResponse.status,
                    statusText: cachedResponse.statusText + ' (Cached)',
                    headers: new Headers(cachedResponse.headers),
                    config: requestConfig,
                };

                if (this.config.responseInterceptor) {
                    return await Promise.resolve(this.config.responseInterceptor(response));
                }

                return response;
            }
        }

        // 실제 요청 수행
        const response = await this.executeRequestWithRetry<T>(endpoint, requestConfig);

        // 성공적인 응답 캐싱
        if (requestConfig.cache?.enabled && 
            this.isCacheableRequest(endpoint, requestConfig) && 
            response.status >= 200 && response.status < 300) {
            
            const url = `${requestConfig.baseUrl || this.config.baseUrl}${endpoint}`;
            const cacheKey = this.generateCacheKey(url, requestConfig);
            
            const headersObj: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headersObj[key] = value;
            });

            const cachedData: CachedResponse<T> = {
                data: response.data,
                timestamp: Date.now(),
                ttl: requestConfig.cache.ttl || 5 * 60 * 1000,
                headers: headersObj,
                status: response.status,
                statusText: response.statusText,
            };

            await this.setToCache(cacheKey, cachedData, requestConfig.cache);
            console.log('💾 응답을 캐시에 저장:', cacheKey);
        }

        return response;
    }

    private async executeRequestWithRetry<T = any>(endpoint: string, requestConfig: RequestConfig, retryCount: number = 0): Promise<VelloResponse<T>> {
        const url = `${requestConfig.baseUrl || this.config.baseUrl}${endpoint}`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

            const fetchOptions: RequestInit = {
                method: requestConfig.method || 'GET',
                headers: requestConfig.headers,
                body: requestConfig.body,
                signal: controller.signal,
            };

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            if (!response.ok) {
                await this.handleErrorResponse(response, requestConfig, retryCount);
            }

            const data = await this.parseResponse<T>(response, requestConfig.responseType || 'json');
            
            const velloResponse: VelloResponse<T> = {
                data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                config: requestConfig,
            };

            if (this.config.responseInterceptor) {
                return await Promise.resolve(this.config.responseInterceptor(velloResponse));
            }

            return velloResponse;

        } catch (error) {
            const shouldRetry = await this.shouldRetryRequest(error, requestConfig, retryCount);
            
            if (shouldRetry) {
                const delay = this.calculateRetryDelay(retryCount, error, requestConfig);
                await this.sleep(delay);
                return this.executeRequestWithRetry<T>(endpoint, requestConfig, retryCount + 1);
            }

            await this.handleError(error, requestConfig, retryCount);
            throw error;
        }
    }

    private async shouldRetryRequest(error: any, config: RequestConfig, retryCount: number): Promise<boolean> {
        const maxRetries = config.retry?.retries || 0;
        
        if (retryCount >= maxRetries) {
            return false;
        }

        const retryCondition = config.retry?.retryCondition || this.defaultRetryCondition;
        
        let velloError: VelloError;
        if (error instanceof VelloError) {
            velloError = error;
        } else if (error.name === 'AbortError') {
            velloError = new VelloError('Request timeout', config, undefined, 'TIMEOUT', retryCount);
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
            velloError = new VelloError('Network error', config, undefined, 'NETWORK_ERROR', retryCount);
        } else {
            velloError = new VelloError(error.message || 'Unknown error', config, undefined, 'UNKNOWN', retryCount);
        }

        return retryCondition(velloError);
    }

    private calculateRetryDelay(retryCount: number, error: any, config: RequestConfig): number {
        const retryConfig = config.retry;
        
        if (retryConfig?.retryDelayFunction) {
            const velloError = error instanceof VelloError ? error : 
                new VelloError(error.message || 'Unknown error', config, undefined, 'UNKNOWN', retryCount);
            return retryConfig.retryDelayFunction(retryCount, velloError);
        }
        
        const baseDelay = retryConfig?.retryDelay || 1000;
        return baseDelay * Math.pow(2, retryCount);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private defaultRetryCondition = (error: VelloError): boolean => {
        if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
            return true;
        }
        
        if (error.response?.status && error.response.status >= 500) {
            return true;
        }
        
        return false;
    };

    private serializeBody(body: any): string | FormData | null {
        if (body === null || body === undefined) {
            return null;
        }
        
        if (body instanceof FormData) {
            return body;
        }
        
        if (typeof body === 'string') {
            return body;
        }
        
        return JSON.stringify(body);
    }

    private async parseResponse<T>(response: Response, responseType: string): Promise<T> {
        switch (responseType) {
            case 'json':
                try {
                    return await response.json() as T;
                } catch {
                    return await response.text() as unknown as T;
                }
            case 'text':
                return await response.text() as unknown as T;
            case 'blob':
                return await response.blob() as unknown as T;
            case 'arrayBuffer':
                return await response.arrayBuffer() as unknown as T;
            default:
                return await response.json() as T;
        }
    }

    private async handleErrorResponse(response: Response, config: RequestConfig, retryCount: number = 0): Promise<never> {
        let errorData: any;
        try {
            errorData = await response.json();
        } catch {
            errorData = await response.text();
        }

        const errorResponse: VelloResponse = {
            data: errorData,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config,
        };

        const error = new VelloError(
            `HTTP Error ${response.status}: ${response.statusText}`,
            config,
            errorResponse,
            response.status.toString(),
            retryCount
        );

        throw error;
    }

    private async handleError(error: any, config: RequestConfig, retryCount: number = 0): Promise<void> {
        let velloError: VelloError;

        if (error instanceof VelloError) {
            velloError = error;
        } else if (error.name === 'AbortError') {
            velloError = new VelloError('Request timeout', config, undefined, 'TIMEOUT', retryCount);
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
            velloError = new VelloError('Network error', config, undefined, 'NETWORK_ERROR', retryCount);
        } else {
            velloError = new VelloError(error.message || 'Unknown error', config, undefined, 'UNKNOWN', retryCount);
        }

        if (this.config.errorInterceptor) {
            await Promise.resolve(this.config.errorInterceptor(velloError));
        }
    }

    // 캐시 관련 private 메서드들
    private isCacheableRequest(endpoint: string, config: RequestConfig): boolean {
        const cacheConfig = { ...this.config.cache, ...config.cache };
        const method = config.method || 'GET';
        
        // 메서드가 명시적으로 허용된 경우
        if (cacheConfig.methods && cacheConfig.methods.includes(method as HttpMethod)) {
            return true;
        }
        
        // GET 요청은 기본적으로 안전
        if (method === 'GET' || method === 'HEAD') {
            return true;
        }
        
        // unsafe 메서드가 명시적으로 허용된 경우
        if (cacheConfig.allowUnsafeMethods === true) {
            return true;
        }
        
        // POST 요청의 경우 추가 검증
        if (method === 'POST') {
            // 안전한 경로 패턴 확인
            if (cacheConfig.safePaths) {
                return cacheConfig.safePaths.some(path => endpoint.includes(path));
            }
            
            // GraphQL 요청 확인
            const headers = config.headers as Record<string, string> || {};
            const contentType = headers['Content-Type'] || '';
            if (contentType.includes('application/graphql')) {
                return true;
            }
            
            // 일반적인 조회성 엔드포인트 패턴
            if (/\/(search|query|filter|list|find|get)/.test(endpoint)) {
                return true;
            }
        }
        
        return false;
    }

    private generateCacheKey(url: string, config: RequestConfig): string {
        const cacheConfig = { ...this.config.cache, ...config.cache };
        
        if (typeof cacheConfig.key === 'function') {
            return cacheConfig.key(url, config);
        }
        
        if (typeof cacheConfig.key === 'string') {
            return cacheConfig.key;
        }
        
        // 기본 캐시 키 생성 (URL + 메서드 + 헤더 + 바디)
        const method = config.method || 'GET';
        const headers = JSON.stringify(config.headers || {});
        const body = config.body || '';
        const baseKey = `${method}:${url}:${headers}:${body}`;
        
        // 안전한 키 생성을 위해 해시 대신 간단한 인코딩 사용
        return `vello:${btoa(unescape(encodeURIComponent(baseKey))).replace(/[+/=]/g, '_')}`;
    }

    private async getFromCache<T>(key: string, cacheConfig: CacheConfig): Promise<CachedResponse<T> | null> {
        try {
            switch (cacheConfig.storage) {
                case 'memory':
                default:
                    return this.cache.get(key) as CachedResponse<T> || null;
                
                case 'localStorage':
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const localData = localStorage.getItem(key);
                        return localData ? JSON.parse(localData) : null;
                    }
                    return null;
                
                case 'sessionStorage':
                    if (typeof window !== 'undefined' && window.sessionStorage) {
                        const sessionData = sessionStorage.getItem(key);
                        return sessionData ? JSON.parse(sessionData) : null;
                    }
                    return null;
                
                case 'custom':
                    if (cacheConfig.customStorage?.get) {
                        return await cacheConfig.customStorage.get(key);
                    }
                    return null;
            }
        } catch (error) {
            console.warn('캐시에서 데이터 읽기 실패:', error);
            return null;
        }
    }

    private async setToCache<T>(key: string, data: CachedResponse<T>, cacheConfig: CacheConfig): Promise<void> {
        try {
            switch (cacheConfig.storage) {
                case 'memory':
                default:
                    this.cache.set(key, data);
                    break;
                
                case 'localStorage':
                    if (typeof window !== 'undefined' && window.localStorage) {
                        localStorage.setItem(key, JSON.stringify(data));
                    }
                    break;
                
                case 'sessionStorage':
                    if (typeof window !== 'undefined' && window.sessionStorage) {
                        sessionStorage.setItem(key, JSON.stringify(data));
                    }
                    break;
                
                case 'custom':
                    if (cacheConfig.customStorage?.set) {
                        await cacheConfig.customStorage.set(key, data, cacheConfig.ttl);
                    }
                    break;
            }
        } catch (error) {
            console.warn('캐시에 데이터 저장 실패:', error);
        }
    }

    private isCacheValid(cachedResponse: CachedResponse, ttl: number): boolean {
        const now = Date.now();
        return (now - cachedResponse.timestamp) < ttl;
    }

    private clearStorageCache(storageType: 'localStorage' | 'sessionStorage'): void {
        if (typeof window === 'undefined') return;
        
        const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key?.startsWith('vello:')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => storage.removeItem(key));
    }
}

export * from './types';