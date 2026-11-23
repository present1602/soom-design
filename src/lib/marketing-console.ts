/* 마케팅 콘솔 주소 — next.config(이미지 허용 목록)와 marketing-models.ts 가 같이 쓴다.

   next/image 는 허용 목록 밖 주소를 받으면 페이지 전체를 500 으로 떨어뜨린다. 환경 변수로 목록을 만들면
   빌드 때 값과 실행 때 값이 다를 경우 그대로 500 이 난다. 그래서 허용 목록은 여기 적은 주소로만 정하고, marketing-models.ts 는
   MARKETING_CONSOLE_URL 이 이 목록에 들 때만 콘솔 사진을 쓴다(아니면 코드에 넣어 둔 사진).
   콘솔 주소가 바뀌면 여기에 더한다. */

export const MARKETING_CONSOLE_ORIGINS = ['https://console.soom.it', 'http://localhost:3100']

export function marketingConsoleBase() {
  return process.env.MARKETING_CONSOLE_URL?.trim().replace(/\/$/, '') || null
}

/** 이 콘솔 주소의 사진을 next/image 에 넘겨도 되는지 */
export function photoAllowed(base: string) {
  try {
    return MARKETING_CONSOLE_ORIGINS.includes(new URL(base).origin)
  } catch {
    return false
  }
}

/** next.config images.remotePatterns — 콘솔의 공개 사진 경로만 허락한다.
    new URL(…) 로 넘기면 search 가 '' 로 잡혀 쿼리 없는 주소만 맞는다 — 사진 주소에는 ?v= 가 붙으므로 객체로 쓴다. */
export function marketingPhotoPatterns() {
  return MARKETING_CONSOLE_ORIGINS.map((o) => {
    const u = new URL(o)
    return {
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      port: u.port,
      pathname: '/api/public/models/*/photo',
    }
  })
}
