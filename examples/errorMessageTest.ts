import { vello, VelloError } from '../src';

async function testErrorMessages() {
  console.log('=== vello API 에러 메시지 기능 테스트 ===\n');

  const api = new vello('https://httpstat.us');

  // 다양한 HTTP 상태 코드 테스트
  const testCases = [
    { endpoint: '/400', expectedStatus: 400 },
    { endpoint: '/401', expectedStatus: 401 },
    { endpoint: '/403', expectedStatus: 403 },
    { endpoint: '/404', expectedStatus: 404 },
    { endpoint: '/429', expectedStatus: 429 },
    { endpoint: '/500', expectedStatus: 500 },
    { endpoint: '/502', expectedStatus: 502 },
    { endpoint: '/503', expectedStatus: 503 }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n📡 ${testCase.expectedStatus} 에러 테스트 중...`);
      await api.get(testCase.endpoint);
    } catch (error) {
      if (error instanceof VelloError) {
        console.log(`\n❌ HTTP ${testCase.expectedStatus} 에러 발생:`);
        console.log(`   원본 메시지: ${error.message}`);
        console.log(`   🔹 ${error.velloMessage.title}`);
        console.log(`   📝 ${error.velloMessage.description}`);
        console.log(`   💡 해결 방법:`);
        error.velloMessage.suggestions.forEach((suggestion, index) => {
          console.log(`      ${index + 1}. ${suggestion}`);
        });
      }
    }
  }

  // 네트워크 에러 시뮬레이션
  console.log(`\n📡 네트워크 에러 테스트 중...`);
  const networkApi = new vello('https://nonexistent-domain-12345.com');
  try {
    await networkApi.get('/test');
  } catch (error) {
    if (error instanceof VelloError) {
      console.log(`\n❌ 네트워크 에러 발생:`);
      console.log(`   에러 코드: ${error.code}`);
      console.log(`   🔹 ${error.velloMessage.title}`);
      console.log(`   📝 ${error.velloMessage.description}`);
      console.log(`   💡 해결 방법:`);
      error.velloMessage.suggestions.forEach((suggestion, index) => {
        console.log(`      ${index + 1}. ${suggestion}`);
      });
    }
  }

  // 타임아웃 에러 시뮬레이션
  console.log(`\n📡 타임아웃 에러 테스트 중...`);
  const timeoutApi = new vello('https://httpstat.us');
  try {
    // 10초 지연 요청을 1초 타임아웃으로 실행
    await timeoutApi.get('/200?sleep=10000', { timeout: 1000 });
  } catch (error) {
    if (error instanceof VelloError) {
      console.log(`\n❌ 타임아웃 에러 발생:`);
      console.log(`   에러 코드: ${error.code}`);
      console.log(`   🔹 ${error.velloMessage.title}`);
      console.log(`   📝 ${error.velloMessage.description}`);
      console.log(`   💡 해결 방법:`);
      error.velloMessage.suggestions.forEach((suggestion, index) => {
        console.log(`      ${index + 1}. ${suggestion}`);
      });
    }
  }

  console.log('\n✅ 에러 메시지 기능 테스트 완료!');
}

// 테스트 실행
// testErrorMessages().catch(console.error);

export { testErrorMessages };
