import type { NextConfig } from 'next'

/* cacheComponents 는 켜지 않는다 — 직원 전용 화면이라 모든 화면이 로그인에 따라 달라지고,
   정적 셸로 얻는 것이 없다. 켜면 세션을 읽는 곳마다 Suspense 경계가 필요해진다. */
const nextConfig: NextConfig = {
  // core 는 TS 원본 그대로 가져다 쓴다(빌드 단계 없음)
  transpilePackages: ['@marketing/core'],
  // 크롤링 테스트(app/(console)/lab/crawl)가 헤드리스 크롬을 띄운다 — 번들하지 않고 node_modules 그대로 쓴다
  serverExternalPackages: ['playwright-core'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
