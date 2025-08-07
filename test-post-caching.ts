import { demonstratePostCaching } from './examples/post-caching-example';

// POST 캐싱 기능 테스트 실행
console.log('vello POST 캐싱 기능 테스트를 시작합니다...\n');

demonstratePostCaching().then(() => {
  console.log('\nPOST 캐싱 기능 테스트가 완료되었습니다!');
}).catch((error) => {
  console.error('테스트 중 오류가 발생했습니다:', error);
});
