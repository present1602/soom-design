import type { Metadata } from 'next'
import { MarketingLeadButton } from '@/components/marketing-lead'

export const metadata: Metadata = {
  title: '마케팅 대행 (준비 중)',
  description: 'AI 모델이 사장님 대신 홍보하는 숏폼·이미지 광고 마케팅 대행. 유튜브 쇼츠·인스타그램·스레드 운영까지, 곧 공개합니다.',
  alternates: { canonical: '/marketing' },
}

/* 마케팅 대행 — 출시 전 맛보기 페이지.

   서비스 본체는 apps/marketing 이고, 이 페이지는 그 서비스를 알리기만 한다(코드·DB 공유 없음).

   톤: 사이트의 아이보리 바탕·먹색은 그대로 두고, 이 페이지만 마케팅 서비스 시안(Claude 아티팩트)의
   인상을 입힌다 — 굵은 고딕 제목, 주황 포인트(ACCENT), 둥근 카드, 휴대폰 모형, 어두운 모델 구역.
   사이트의 장밋빛(plum)·세리프 이탤릭은 쓰지 않는다. 색은 이 파일의 상수로만 쓴다(globals.css 를 건드리지 않음).

   AI 모델은 두 명만 이름과 소개 앞부분을 보여 주고 나머지는 흐리게, 네 명은 사진·이름 없이
   "공개 예정"으로 둔다. 모델 사진이 준비되면 MODELS 의 photo 에 넣는다(src/assets/marketing/ 에 두고 import).
   흐린 글은 화면 읽기 프로그램에 읽히지 않게 aria-hidden 으로 감추고, 대신 "곧 전체 공개" 를 읽어 준다. */

const container = 'mx-auto max-w-[1200px] px-5 md:px-10'

// 시안의 주황 — 흰 글자와 대비 5:1 남짓(작은 글자도 읽힌다)
const ACCENT_BG = 'bg-[#C93A0C]'
const ACCENT_TEXT = 'text-[#C93A0C]'
const ACCENT_SOFT = 'bg-[#FBE7DF]'
const DARK = 'bg-[#15171C]'
const CARD_DARK = 'bg-[#1F232B] border-[#2E333D]'

type Model = {
  field: string
  open: boolean
  name?: string
  role?: string
  lead?: string
  hidden: { label: string; value: string }[]
  tint?: string
  initial?: string
  photo?: string
}

const MODELS: Model[] = [
  {
    field: '필라테스 · 요가 · PT',
    open: true,
    name: '서하린',
    role: '28세 · 필라테스 강사',
    lead: '자세 교정 수업만 6년째. 거북목·골반 교정처럼 손님이 실제로 찾는 고민을 짚어 줘요.',
    hidden: [
      { label: '성격', value: 'ENFJ · 차분함 · 응원형' },
      { label: '말투', value: '또박또박한 존댓말' },
      { label: '목소리', value: '부드러운 여성' },
    ],
    tint: 'bg-[#E9C8B8]',
    initial: '하',
  },
  {
    field: '음식점 · 고깃집 · 분식',
    open: true,
    name: '박도윤',
    role: '31세 · 동네 맛집 탐방러',
    lead: '한 입 먹고 바로 터지는 리액션이 무기. 메뉴 클로즈업으로 손님 발길을 끌어요.',
    hidden: [
      { label: '성격', value: 'ESFP · 유쾌함 · 친근함' },
      { label: '말투', value: '반말 섞인 친근한 말투' },
      { label: '목소리', value: '밝은 남성' },
    ],
    tint: 'bg-[#F2D3A0]',
    initial: '도',
  },
  { field: '카페 · 베이커리 · 디저트', open: false, hidden: [] },
  { field: '네일 · 헤어 · 피부관리', open: false, hidden: [] },
  { field: '학원 · 과외 · 교육', open: false, hidden: [] },
  { field: '인테리어 · 리모델링', open: false, hidden: [] },
]

const PREVIEW = [
  {
    title: 'AI 모델 숏폼',
    description: '업종에 맞는 AI 모델이 매장 상품을 들고 직접 소개하는 5~30초 숏폼 영상. 모델 목소리 내레이션과 자막까지.',
    icon: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2.5" />
        <path d="M10.5 9.5v5l4-2.5z" />
      </>
    ),
  },
  {
    title: 'AI 이미지 광고',
    description: '이벤트·신메뉴를 담은 피드·배너용 광고 이미지. 한 장으로 바로 쓸 수 있게 문구까지 넣어 드려요.',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="9" cy="10" r="2" />
        <path d="M21 16l-5-5-8 9" />
      </>
    ),
  },
  {
    title: '업로드 대행',
    description: '유튜브 쇼츠·인스타그램·스레드에 주기적으로 꾸준히 올려 드립니다. 비밀번호는 받지 않아요.',
    icon: (
      <>
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </>
    ),
  },
]

const CHANNELS = [
  { name: '유튜브 쇼츠', note: '검색과 추천으로 동네 밖 손님까지 닿아요.' },
  { name: '인스타그램', note: '릴스와 피드 이미지를 함께 운영해요.' },
  { name: '스레드', note: '국내 이용자 1년 새 약 30% 증가. 아직 가게 계정이 적은 지금이 기회예요.', hot: true },
]

export default function MarketingPage() {
  return (
    <main className="flex-1 bg-paper text-[#15171C]">
      {/* 머리말 — 왼쪽 글, 오른쪽 숏폼 휴대폰 모형 */}
      <section aria-labelledby="marketing-title">
        <div className={`${container} flex flex-wrap items-center gap-12 py-14 md:gap-16 md:py-20`}>
          <div className="flex min-w-0 flex-[999_1_480px] flex-col items-start gap-6">
            <p className={`inline-flex items-center gap-2 rounded-full ${ACCENT_SOFT} px-3.5 py-1.5 text-[13px] font-bold ${ACCENT_TEXT}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${ACCENT_BG} motion-safe:animate-pulse`} />
              AI 숏폼 마케팅 대행 · 준비 중
            </p>
            <h1 id="marketing-title" className="text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.2] font-extrabold tracking-[-0.035em]">
              사장님 대신,
              <br />
              우리 가게 AI 모델이
              <br />
              매주 홍보합니다
            </h1>
            <p className="max-w-[520px] text-[17px] leading-[1.75] text-[#4A4F5A]">
              쇼츠 영상과 이미지 광고를 만들고, 유튜브·인스타그램·스레드 업로드까지 대신 해 드려요. 제작도, 업로드도 대행해드려요.
            </p>
            <div className="flex flex-wrap gap-3">
              <MarketingLeadButton className={`rounded-xl border-[#C93A0C] ${ACCENT_BG} text-white hover:border-[#9E2D08] hover:bg-[#9E2D08]`}>출시 소식 받기</MarketingLeadButton>
              <a
                href="#models"
                className="inline-flex min-h-12 items-center rounded-xl border border-[#D6D1C6] bg-white px-6 text-sm font-semibold transition hover:border-[#15171C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C93A0C]"
              >
                AI 모델 미리 보기
              </a>
            </div>
          </div>

          <div className="flex flex-[1_1_300px] justify-center">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* 만드는 것 */}
      <section aria-labelledby="preview-title" className="border-y border-[#E3DFD6] bg-white">
        <div className={`${container} py-16 md:py-20`}>
          <p className={`text-[14px] font-bold ${ACCENT_TEXT}`}>무엇을 만들어 드리나요</p>
          <h2 id="preview-title" className="mt-3 text-[clamp(1.6rem,2.8vw,2.3rem)] leading-[1.3] font-extrabold tracking-[-0.03em]">
            가게 주소 하나로 시작하는 매주의 홍보 콘텐츠
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {PREVIEW.map((p) => (
              <li key={p.title} className="flex flex-col gap-3.5 rounded-2xl bg-paper p-7">
                <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {p.icon}
                </svg>
                <h3 className="text-[20px] font-bold tracking-[-0.02em]">{p.title}</h3>
                <p className="text-[15px] leading-[1.75] text-[#4A4F5A]">{p.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* AI 모델 라인업 — 어두운 구역 */}
      <section id="models" aria-labelledby="models-title" className={`scroll-mt-20 ${DARK} text-[#F6F4EF]`}>
        <div className={`${container} py-16 md:py-24`}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[640px]">
              <p className="text-[14px] font-bold text-[#FF9F7E]">다른 대행사와 다른 점</p>
              <h2 id="models-title" className="mt-3 text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.28] font-extrabold tracking-[-0.03em]">
                우리 가게 전속 AI 모델을
                <br />
                직접 고르세요
              </h2>
              <p className="mt-4 text-[16px] leading-[1.75] text-[#C9CCD3]">
                업종마다 어울리는 성격·말투·목소리를 가진 AI 모델을 준비하고 있어요. 고른 모델이 매주 같은 얼굴, 같은 목소리로 가게를 소개합니다.
              </p>
            </div>
            <p className="rounded-full border border-[#3A404B] px-4 py-2 text-[13px] text-[#DADCE1]">
              지금은 <b className="text-white">2명</b>만 먼저 살짝 공개해요
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODELS.map((m) => (
              <li key={m.field} className="min-w-0">
                {m.open ? <OpenModel m={m} /> : <LockedModel m={m} />}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-[13px] text-[#AEB2BC]">
            소개된 모델은 모두 AI로 만든 가상 인물이며 실존 인물이 아닙니다. 모든 콘텐츠에는 AI 생성 콘텐츠임을 표시합니다.
          </p>
        </div>
      </section>

      {/* 채널 */}
      <section aria-labelledby="channels-title">
        <div className={`${container} py-16 md:py-20`}>
          <p className={`text-[14px] font-bold ${ACCENT_TEXT}`}>어디에 올리나요</p>
          <h2 id="channels-title" className="mt-3 text-[clamp(1.6rem,2.8vw,2.3rem)] leading-[1.3] font-extrabold tracking-[-0.03em]">
            손님이 머무는 숏폼 채널 3곳
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {CHANNELS.map((c) => (
              <li
                key={c.name}
                className={`flex flex-col gap-3 rounded-2xl bg-white p-7 ${c.hot ? 'border-2 border-[#C93A0C]' : 'border border-[#E3DFD6]'}`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[20px] font-bold tracking-[-0.02em]">{c.name}</h3>
                  {c.hot && <span className={`rounded-full ${ACCENT_BG} px-2.5 py-0.5 text-[12px] font-bold text-white`}>가장 빠르게 성장 중</span>}
                </div>
                <p className="text-[15px] leading-[1.75] text-[#4A4F5A]">{c.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-[#6B707B]">스레드 성장 수치: 와이즈앱·리테일, 2026년 7월 국내 월간 사용자 798만 명(전년 대비 +29.6%)</p>
        </div>
      </section>

      {/* 준비 중 */}
      <section aria-labelledby="soon-title" className="px-5 pb-16 md:px-10 md:pb-24">
        <div className={`mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 rounded-[28px] ${ACCENT_BG} px-7 py-14 text-white md:px-14 md:py-16`}>
          <div className="min-w-0 flex-[999_1_420px]">
            <p className="text-[13px] font-bold tracking-[0.18em] text-white/80">MARKETING SOLUTION</p>
            <h2 id="soon-title" className="mt-3 text-[clamp(2.6rem,7vw,5rem)] leading-[1] font-extrabold tracking-[-0.04em]">
              COMING SOON
            </h2>
            <p className="mt-5 max-w-[520px] text-[16px] leading-[1.75] text-white/85">
              SOOM 마케팅 대행 솔루션은 지금 준비 중입니다. 제작만 맡기는 방식부터 업로드·채널 운영까지 통째로 맡기는 방식까지, 곧 요금과 함께 공개할게요.
            </p>
          </div>
          <div className="flex flex-[1_1_260px] flex-col items-start gap-4">
            <p className="text-[18px] font-bold">먼저 소식을 받아 보시겠어요?</p>
            <p className="text-[14px] leading-[1.7] text-white/85">출시할 때 가장 먼저 알려 드리고, 어울리는 AI 모델도 추천해 드릴게요.</p>
            <MarketingLeadButton className="rounded-xl border-white bg-white text-[#15171C] hover:border-[#15171C] hover:bg-[#15171C] hover:text-white">출시 소식 받기</MarketingLeadButton>
          </div>
        </div>
      </section>
    </main>
  )
}

/* 머리말 오른쪽 — 숏폼 한 장면을 흉내 낸 휴대폰 */
function PhoneMockup() {
  return (
    <div aria-hidden="true" className={`w-[280px] rounded-[40px] ${DARK} p-3 shadow-[0_30px_60px_-30px_rgb(21_23_28/0.5)]`}>
      <div className="flex aspect-[9/17] flex-col justify-between overflow-hidden rounded-[30px] bg-[#3A3F4B]">
        <div className="flex justify-between p-4 text-[11px] text-white">
          <span className="rounded-full bg-black/45 px-2.5 py-1">AI 생성 콘텐츠</span>
          <span className="rounded-full bg-black/45 px-2.5 py-1">0:15</span>
        </div>
        <div className="grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-white/15">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </div>
        <div className="flex flex-col gap-2.5 p-4 pb-5 text-white">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-[#E9C8B8] text-[13px] font-bold text-[#15171C]">하</span>
            <div className="leading-tight">
              <b className="block text-[13px]">하린 쌤</b>
              <span className="text-[11px] text-[#D5D8DE]">필라테스 전문 AI 모델</span>
            </div>
          </div>
          <p className="text-[14px] leading-[1.45] font-bold">
            거북목, 하루 3분이면 달라져요.
            <br />
            1:1 체험 수업 이벤트
          </p>
        </div>
      </div>
    </div>
  )
}

/* 공개 모델 — 이름·직업·소개 앞부분까지 보이고, 성격·말투·목소리는 흐리게 */
function OpenModel({ m }: { m: Model }) {
  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-[20px] border ${CARD_DARK}`}>
      <div className={`relative aspect-[4/3] ${m.tint}`}>
        {m.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photo} alt={`AI 가상 모델 ${m.name}`} className="size-full object-cover" />
        ) : (
          <div aria-hidden="true" className="grid size-full place-items-center">
            <span className="grid size-24 place-items-center rounded-full bg-white/70 text-[38px] font-extrabold text-[#15171C]">{m.initial}</span>
          </div>
        )}
        <span className="absolute top-3.5 left-3.5 rounded-full bg-[#15171C]/80 px-2.5 py-1 text-[12px] font-bold text-white">{m.field}</span>
        <span className="absolute top-3.5 right-3.5 rounded-full bg-white/85 px-2.5 py-1 text-[12px] font-bold text-[#15171C]">AI 가상 모델</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h3 className="text-[22px] font-bold text-white">{m.name}</h3>
          <span className="text-[14px] text-[#AEB2BC]">{m.role}</span>
        </div>
        <p className="text-[15px] leading-[1.7] text-[#DADCE1]">{m.lead}</p>
        <div className="relative mt-auto">
          <dl aria-hidden="true" className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-[#2E333D] pt-3 text-[13px] blur-[5px] select-none">
            {m.hidden.map((h) => (
              <div key={h.label} className="contents">
                <dt className="text-[#8D929D]">{h.label}</dt>
                <dd className="text-[#DADCE1]">{h.value}</dd>
              </div>
            ))}
          </dl>
          <p className="absolute inset-0 grid place-items-center pt-3">
            <span className={`rounded-full ${ACCENT_BG} px-3 py-1 text-[12px] font-bold text-white`}>곧 전체 공개</span>
          </p>
        </div>
      </div>
    </article>
  )
}

/* 비공개 모델 — 사진·이름 없이 업종만 */
function LockedModel({ m }: { m: Model }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-dashed border-[#3A404B] bg-[#1A1D24]">
      {/* 휴대폰에서는 한 줄에 한 장씩 쌓이므로 납작하게 — 빈 카드가 화면을 길게 채우지 않게 */}
      <div className="relative grid aspect-[16/9] place-items-center sm:aspect-[4/3]">
        <div className="flex flex-col items-center gap-3 text-[#8D929D]">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span className="text-[20px] font-bold tracking-[-0.02em] text-[#DADCE1]">공개 예정</span>
        </div>
        <span className="absolute top-3.5 left-3.5 rounded-full border border-[#3A404B] px-2.5 py-1 text-[12px] font-bold text-[#C9CCD3]">{m.field}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div aria-hidden="true" className="flex items-center gap-2.5">
          <span className="h-5 w-16 rounded bg-[#2E333D]" />
          <span className="h-3.5 w-28 rounded bg-[#262A33]" />
        </div>
        <div aria-hidden="true" className="space-y-2">
          <span className="block h-3 w-full rounded bg-[#262A33]" />
          <span className="block h-3 w-4/5 rounded bg-[#262A33]" />
        </div>
        <p className="mt-auto text-[13px] text-[#AEB2BC]">{m.field.split(' · ')[0]} 전속 모델 · 곧 공개</p>
      </div>
    </article>
  )
}
