/* 업로드 대상 플랫폼.
   api: 공식 업로드 API 가 있어서 워커가 올린다.
   video/image: 그 형식을 올릴 수 있는가 (유튜브는 쇼츠만, 이미지는 못 올린다).
   카카오는 업로드 API 가 없어서 매니저로 초대받은 직원이 직접 올리고 주소만 적는다. */
export const PLATFORMS = ['instagram', 'youtube', 'threads', 'kakao'] as const
export type Platform = (typeof PLATFORMS)[number]

export type PlatformInfo = {
  name: string
  short: string
  api: boolean
  video: boolean
  image: boolean
  /** 계정 이름 입력칸 예시 */
  handleHint: string
  /** 채널 관리 화면의 안내 문구 */
  note: string
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  instagram: {
    name: '인스타그램',
    short: 'IG',
    api: true,
    video: true,
    image: true,
    handleHint: '@계정',
    note: '프로페셔널(비즈니스·크리에이터) 계정만 연결할 수 있어요. 릴스와 피드 이미지를 올려요.',
  },
  youtube: {
    name: '유튜브',
    short: 'YT',
    api: true,
    video: true,
    image: false,
    handleHint: '채널 이름',
    note: '쇼츠(3분 이하 세로 영상)만 올려요. 이미지는 올릴 수 없어요.',
  },
  threads: {
    name: '스레드',
    short: 'TH',
    api: true,
    video: true,
    image: true,
    handleHint: '@계정',
    note: '영상과 이미지 모두 올려요. 비공개 계정은 90일마다 다시 허용해야 해요.',
  },
  kakao: {
    name: '카카오',
    short: 'KK',
    api: false,
    video: true,
    image: true,
    handleHint: '톡채널 이름',
    note: '업로드 API 가 없어요. 회사 공용 카카오계정을 톡채널 매니저로 초대받아 직접 올려요.',
  },
}

export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && (PLATFORMS as readonly string[]).includes(v)
}

/** 이 형식의 콘텐츠를 이 플랫폼에 올릴 수 있는가 */
export function supports(platform: Platform, type: 'short' | 'banner') {
  const info = PLATFORM_INFO[platform]
  return type === 'short' ? info.video : info.image
}
