// node-fetch import 제거 - 네이티브 fetch 사용
import { VelloConfig, RequestConfig, VelloResponse, VelloError, HttpMethod, RetryConfig } from './types';

export class vello {
    private config: VelloConfig;

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
            }
        };

        if (this.config.requestInterceptor) {
            requestConfig = await Promise.resolve(this.config.requestInterceptor(requestConfig));
        }

        return this.executeRequestWithRetry<T>(endpoint, requestConfig);
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
}

export * from './types';