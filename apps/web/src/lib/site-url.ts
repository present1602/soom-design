/* 사이트 주소 한 곳 — robots.ts·sitemap.ts·layout.tsx 가 같이 본다.

   검색 쪽에 내보내는 주소는 반드시 절대 URL 이어야 한다(sitemap 의 <loc>,
   robots 의 Sitemap:, og:image). 그래서 기본값을 운영 주소로 둔다 —
   환경 변수가 빠진 채 배포돼도 상대 주소가 나가지는 않게 한다.

   끝의 '/' 는 떼어 둔다. 붙은 채로 `${SITE_URL}/explore` 를 만들면
   '//explore' 가 되어 구글에게는 다른 주소로 보인다(중복 색인). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://design.soom.it').replace(/\/+$/, '')

/* 운영 주소 목록 — 2026-11-21 부터 운영은 design.soom.it 이고 soom.it 는 에이전시로
   리다이렉트한다. 나중에 soom.it 로 되돌릴 수 있어 둘 다 둔다. 되돌릴 때는 코드는 그대로 두고
   Vercel 의 NEXT_PUBLIC_SITE_URL 과 Domains 만 바꾸면 된다. pre-launch.ts 도 이 목록을 본다. */
const PRODUCTION_HOSTS = ['design.soom.it', 'soom.it', 'www.soom.it']

export function isProductionHost(siteUrl: string | undefined): boolean {
  try {
    return PRODUCTION_HOSTS.includes(new URL(siteUrl ?? '').hostname)
  } catch {
    return false
  }
}

/* 검색에 내보내도 되는 곳인가 — 운영(PRODUCTION_HOSTS)만 참이다.

   dev.soom.it·미리보기 배포·로컬은 운영과 내용이 같다. 그대로 열어 두면
   같은 사이트가 두 벌 색인되고, 구글이 어느 쪽을 올릴지 흐려진다(중복 콘텐츠).
   심하면 검색 결과에 dev 주소가 뜬다.

   판별을 호스트로 하는 것은 pre-launch.ts 와 같은 방식이다 — 환경 변수를
   하나 더 두면 새 환경에서 그것을 깜빡했을 때 조용히 열린 채로 배포된다.
   호스트로 보면 기본값이 "막는 쪽"이라 깜빡해도 안전하다.

   www 도 함께 참으로 둔다 — 운영 도메인의 다른 표기일 뿐이다. */
export const INDEXABLE = isProductionHost(SITE_URL)
