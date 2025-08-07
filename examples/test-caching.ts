import { demonstrateCaching } from './caching-example';

// 캐싱 기능 테스트 실행
console.log('vello 캐싱 기능 테스트를 시작합니다...\n');

demonstrateCaching().then(() => {
  console.log('\n캐싱 기능 테스트가 완료되었습니다!');
}).catch((error) => {
  console.error('테스트 중 오류가 발생했습니다:', error);
});
