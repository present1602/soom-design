import type { Metadata } from 'next'
import Image, { type StaticImageData } from 'next/image'
import modelJang from '@/assets/marketing/model-jang-wonyi.jpg'
import modelKang from '@/assets/marketing/model-kang-youngsun.jpg'
import modelMuyeol from '@/assets/marketing/model-muscle-muyeol.jpg'
import { MarketingLeadButton } from '@/components/marketing-lead'
import { marketingModels, type ConsoleModel } from '@/lib/marketing-models'

export const metadata: Metadata = {
  title: 'SNS 콘텐츠 마케팅 대행',
  description: '홈페이지 제작부터 SNS 콘텐츠 마케팅 대행까지. 직접 고른 AI 가상 모델로 매장과 브랜드를 홍보하는 방법을 상담해 보세요.',
  alternates: { canonical: '/marketing' },
}

/* 마케팅 대행 소개와 문의 접수 페이지.

   서비스 본체는 apps/marketing 이고, 이 페이지는 그 서비스를 알리기만 한다(코드·DB 공유 없음).

   톤: 사이트의 아이보리 바탕·먹색은 그대로 두고, 이 페이지만 마케팅 서비스 시안(Claude 아티팩트)의
   인상을 입힌다 — 굵은 고딕 제목, 주황 포인트(ACCENT), 둥근 카드, 휴대폰 모형, 어두운 모델 구역.
   사이트의 장밋빛(plum)·세리프 이탤릭은 쓰지 않는다. 색은 이 파일의 상수로만 쓴다(globals.css 를 건드리지 않음).

   AI 모델 카드의 순서·업종·역할·흐린 칸은 여기에 적는다 — 서비스끼리 DB 를 공유하지 않는다.
   이름·한줄 소개·대표 사진은 consoleId 로 콘솔 공개 API 에서 읽어 덮어쓴다(lib/marketing-models.ts, MARKETING_CONSOLE_URL).
   콘솔을 못 읽거나 값이 비면 여기 적은 name·lead 와 src/assets/marketing/ 의 사진(2026-11-23 콘솔 대표 사진을 720px JPG 로 줄인 것)으로 보인다.
   콘솔에서 새로 공개한 모델은 저절로 카드가 생기지 않는다 — MODELS 에 consoleId 를 넣어 한 줄 더한다.
   open: false 면 사진·이름 없이 "공개 예정" 카드로 보인다.
   흐린 글은 화면 읽기 프로그램에 읽히지 않게 aria-hidden 으로 감추고, 대신 "곧 전체 공개" 를 읽어 준다. */

const container = 'mx-auto max-w-[1200px] px-5 md:px-10'

// 시안의 주황 — 흰 글자와 대비 5:1 남짓(작은 글자도 읽힌다)
const ACCENT_BG = 'bg-[#C93A0C]'
const ACCENT_TEXT = 'text-[#C93A0C]'
const ACCENT_SOFT = 'bg-[#FBE7DF]'
const DARK = 'bg-[#15171C]'
const CARD_DARK = 'bg-[#1F232B] border-[#2E333D]'
const inquiryButton = `rounded-xl border-[#C93A0C] ${ACCENT_BG} text-white hover:border-[#9E2D08] hover:bg-[#9E2D08]`

type Model = {
  field: string
  open: boolean
  /** 마케팅 콘솔의 virtual_models.id — 콘솔의 이름·한줄 소개·대표 사진을 name·lead·photo 대신 보여 준다(비면 이 값) */
  consoleId?: string
  name?: string
  role?: string
  lead?: string
  hidden: { label: string; value: string }[]
  tint?: string
  initial?: string
  photo?: StaticImageData
}

const MODELS: Model[] = [
  {
    field: '카페 · 뷰티 · 생활',
    open: true,
    consoleId: '58ac3e76-69b7-43d7-a320-f0c811b89091',
    name: '장원이',
    role: '20대 · 밝고 친근한 캐주얼',
    lead: '꾸밈없이 밝은 표정으로 매장의 일상을 자연스럽게 보여 줘요. 신메뉴·신상품 첫인상을 가볍고 친근하게 전해요.',
    hidden: [
      { label: '성격', value: '밝음 · 친근함' },
      { label: '분위기', value: '자연스러운 캐주얼' },
      { label: '목소리', value: '또렷한 여성' },
    ],
    photo: modelJang,
  },
  {
    field: '법률 · 세무 · 전문 서비스',
    open: true,
    consoleId: '5d4de654-d13a-40ed-b651-8354b137b5d3',
    name: '강영선',
    role: '33세 · 동네 변호사',
    lead: '임대차·계약 분쟁처럼 사장님들이 실제로 겪는 문제를 일상 예시로 쉽게 풀어 줘요. "우선 지금 갖고 계신 것부터 같이 볼게요."',
    hidden: [
      { label: '성격', value: '차분함 · 다정함 · 세련됨' },
      { label: '말투', value: '차분하고 신뢰감 주는 존댓말' },
      { label: '목소리', value: '차분하고 신뢰감 있는 여성' },
    ],
    photo: modelKang,
  },
  {
    field: '헬스 · 피트니스 · 쇼핑몰',
    open: true,
    consoleId: '4b7084f7-e515-4cd0-a2f9-8c65362b9822',
    name: '머슬무열',
    role: '38세 · 피트니스 쇼핑몰 대표',
    lead: '보충제 쇼핑몰을 운영하며 피트니스 대회까지 나간 현장형 사장님. 운동하는 손님의 눈높이로 제품을 소개해요.',
    hidden: [
      { label: '성격', value: 'ENTP · 친근함 · 장난기' },
      { label: '말투', value: '낮은 목소리에 장난기 섞인 말투' },
      { label: '목소리', value: '중저음 따뜻한 남성' },
    ],
    photo: modelMuyeol,
  },
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
    description: '유튜브 쇼츠·인스타그램·스레드에 주기적으로 꾸준히 올려 드립니다.',
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

export default async function MarketingPage() {
  const fromConsole = await marketingModels()
  return (
    <main className="flex-1 bg-paper text-[#15171C]">
      {/* 머리말 — 왼쪽 글, 오른쪽 숏폼 휴대폰 모형 */}
      <section aria-labelledby="marketing-title">
        <div className={`${container} flex flex-wrap items-center gap-12 py-14 md:gap-16 md:py-20`}>
          <div className="flex min-w-0 flex-[999_1_480px] flex-col items-start gap-6">
            <p className={`inline-flex items-center gap-2 rounded-full ${ACCENT_SOFT} px-3.5 py-1.5 text-[13px] font-bold ${ACCENT_TEXT}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${ACCENT_BG} motion-safe:animate-pulse`} />
              AI 숏폼 마케팅 대행
            </p>
            <h1 id="marketing-title" className="text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.2] font-extrabold tracking-[-0.035em]">
              사장님 대신,
              <br />
              우리 가게 AI 모델이
              <br />
              매주 홍보합니다
            </h1>
            <p className="max-w-[520px] text-[17px] leading-[1.75] text-[#4A4F5A]">
              SOOM의 자체제작 ai콘텐츠 생성 툴로 쇼츠 영상과 이미지 광고, 소식/이벤트 게시물을 생성할 수 있어요.<br/>
              유튜브쇼츠, 인스타그램, 스레드 등 SNS 채널에 배포도 대행해드릴 수 있어요.
            </p>
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
                개성있는 페르소나의 성격·목소리를 가진 AI 모델들을 준비하고 있어요. 우리 브랜드/가게를 잘 홍보해줄 가상 모델을 만나보세요. 
              </p>
            </div>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODELS.map((m) => (
              <li key={m.field} className="min-w-0">
                {m.open ? <OpenModel m={m} live={m.consoleId ? fromConsole[m.consoleId] : undefined} /> : <LockedModel m={m} />}
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
        </div>
      </section>

      <section aria-labelledby="marketing-inquiry-title" className={`${container} pb-14 md:pb-20`}>
        <div className="mx-auto flex max-w-[880px] flex-col items-center rounded-3xl border border-[#EDD6CA] bg-[#FFF8F3] px-6 py-8 text-center md:px-10 md:py-10">
          <h2 id="marketing-inquiry-title" className="text-[clamp(1.4rem,3vw,2rem)] leading-[1.3] font-bold tracking-[-0.035em] break-keep">
            우리 매장에 맞는 SNS 마케팅
          </h2>
          <p className="mt-2 max-w-[35em] text-[15px] leading-[1.7] break-keep text-[#4A4F5A]">
            홈페이지 제작부터 SNS 콘텐츠 제작과 채널 운영까지 상담해 보세요.
          </p>
          <MarketingLeadButton className={`${inquiryButton} mt-5`} />
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
function OpenModel({ m, live }: { m: Model; live?: ConsoleModel }) {
  // 콘솔 값이 있으면 그것을, 없으면 이 파일의 값. 한줄 소개(최대 100자)가 칸을 넘으면 세 줄에서 … 로 자른다
  const name = live?.name || m.name
  const lead = live?.tagline || m.lead
  const photo = live?.photo || m.photo
  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-[20px] border ${CARD_DARK}`}>
      <div className={`relative aspect-[4/3] ${m.tint}`}>
        {photo ? (
          /* 콘솔 사진은 원본(PNG 2MB 남짓)이라 next/image 가 줄여서 내보낸다. 흐린 미리보기는 손으로 넣은 사진에만 있다 */
          <Image src={photo} alt={`AI 가상 모델 ${name}`} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" placeholder={typeof photo === 'string' ? 'empty' : 'blur'} className="object-cover object-[center_18%]" />
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
          <h3 className="text-[22px] font-bold text-white">{name}</h3>
          <span className="text-[14px] text-[#AEB2BC]">{m.role}</span>
        </div>
        <p className="line-clamp-3 text-[15px] leading-[1.7] break-keep text-[#DADCE1]" title={lead}>{lead}</p>
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
