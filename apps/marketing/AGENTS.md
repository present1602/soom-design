# 마케팅 대행 서비스 (apps/marketing)

AI로 숏폼·배너를 만들어 고객사 채널에 올리는 내부 직원용 서비스. **이 폴더만 떼어 별도 저장소로
옮겨도 그대로 동작해야 한다** — `apps/web` 과 코드·타입·DB·env 를 공유하지 않는다(루트 AGENTS.md).

```
console/   Next 16 어드민 (포트 3100). 화면 + 서버 액션 + 진행 상황 API
worker/    작업 큐 워커 (Node + ffmpeg). 이미지·영상 생성, 인코딩, 썸네일 추출, 채널 업로드
core/      console·worker 공용 (DB 행 타입, 작업 형식, 채널 정의, 프롬프트, AI 업체 연동). 빌드 없이 TS 원본을 쓴다
supabase/  마케팅 전용 Supabase 설정 + migrations
```

`core` 는 이 서비스 안의 console·worker 만 쓴다. web 에서 import 하지 않는다.

## 흐름

1. 콘솔이 `contents`·`content_assets` 를 쓰고 `jobs` 에 작업을 넣는다.
2. 워커가 `claim_job()` 으로 하나씩 꺼내 처리하고 결과 파일을 `marketing` 버킷(비공개)에 올린다.
3. 콘솔 화면은 `/api/contents/[id]`·`/api/jobs/[id]` 를 2초 남짓마다 물어 진행 상황을 그린다.

작업 종류는 `core/src/jobs.ts`. 업로드(publish)는 두 번 올라갈 수 있어 자동으로 다시 시도하지 않는다.

## 로컬 실행

```bash
pnpm dev:marketing    # 루트에서. 콘솔(http://localhost:3100) + 워커를 한 번에 띄운다
# 따로 띄울 때: pnpm dev:console / pnpm dev:worker (워커가 꺼져 있으면 생성이 시작되지 않는다)
```

- **DB 는 클라우드 Supabase 하나만 쓴다.** dev/prod 를 나누지 않고 로컬 Docker DB 도 띄우지 않는다.
  거의 어드민만 쓰는 실험용 서비스라 가데이터를 직접 넣었다가 필요 없어지면 지운다.
- console 과 worker 의 `.env.local` 은 **같은 Supabase 프로젝트**(URL·키)를 가리켜야 한다. 각 폴더의 `.env.example` 참고.
- 첫 슈퍼어드민: `SUPER_ADMIN_EMAILS` 에 적은 이메일로 로그인하면 자동 등록된다. 비밀번호 계정은
  Supabase Auth 에 만들어 두거나(로컬은 Studio http://localhost:54323), 구글 로그인을 쓴다.
- `AI_MODE=mock`(기본): AI 업체를 부르지 않고 ffmpeg 로 입력 이미지를 겹친 가짜 결과를 만든다. 비용 0.
  `live` 로 바꾸면 OpenAI 이미지(`OPENAI_API_KEY`)·Runway 영상(`RUNWAY_API_KEY`)을 실제로 부른다.
- `PUBLISH_MODE=mock`(기본): 실제로 올리지 않고 가짜 게시물 주소를 돌려준다. `live` 는 채널에 고객이
  허용한 토큰이 있어야 한다(아래 "채널 연결").

## DB 마이그레이션

- `supabase/migrations/0001_init.sql` 이 기준. 새 파일은 `0002_설명.sql` 처럼 네 자리로 이어 쓴다.
- 운영 DB 는 Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하게(멱등) 쓴다.
- 모든 표는 RLS 를 켜고(enable + force) 정책을 두지 않는다. 서버(service_role)만 읽고 쓴다.
- 여러 행을 한 번에 insert 할 때는 모든 행에 같은 칸을 넣는다 — 빠진 칸은 기본값이 아니라 null 로 들어간다.

## 홈페이지 자료 API (고객사 사이트 → 프롬프트 참고 자료)

- 우리가 만들어 준 고객사 홈페이지에 **읽기 전용 GET API 하나**를 둔다(그 사이트 저장소에서 작업. apps/web 은 아니다).
  응답 형식은 `core/src/site-feed.ts` 의 `SiteFeed`(예시 `SITE_FEED_EXAMPLE`) 하나로 통일한다. 토큰을 쓰면
  `Authorization: Bearer <토큰>` 으로 받는다. 매번 DB 를 읽게(Next 라우트면 캐시 끄기) 해야 바로 반영된다.
- 매장 정보 화면에서 주소·토큰을 저장하고 "지금 불러와 보기"로 확인한다. 토큰은 화면으로 내려보내지 않는다.
- **워커가 숏폼·배너를 만들기 직전에 매번 부른다.** 실패하면 지난 자료(`stores.site_feed_cache`)로 대신하고,
  그것도 없으면 자료 없이 만든다. 무엇을 썼는지는 `contents.settings.siteFeed` 에 남고 결과 화면에 표시된다.
- 프롬프트에는 `siteFeedBrief()` 요약 글만 들어간다(영상 350자, 배너 1200자). 자료의 이미지는 아직 쓰지 않는다.
- DB 칸은 `0002_site_feed.sql`. 돌리기 전에는 워커가 자료 없이 진행하고 화면은 안내 문구를 띄운다.
- **우리가 만들지 않은 사이트**는 매장 정보 화면의 "홈페이지 주소"만 넣는다. "API로 가져오기"를 끈 매장은 생성 직전에
  그 페이지 HTML 에서 제목·소개·본문 글을 뽑아(`core/src/homepage.ts`) 같은 자리에 넣는다. 자바스크립트로 그리는
  사이트는 글이 거의 안 나온다 — 그때는 매장 소개 칸으로 채운다. 내부망 주소는 막는다. 칸은 `0005_store_web_events.sql`.

## 매장 이벤트

- 대행사가 매장마다 이벤트(이름·기간·혜택·자세한 내용)를 넣는다(`store_events`, `core/src/events.ts`).
  매장 정보 화면과 콘텐츠 생성 화면("+ 새 이벤트") 어디서든 추가할 수 있다. 지우지 않고 "내리기"만 한다.
- 콘텐츠를 만들 때 하나 고르면 그 시점의 내용이 `contents.settings.event` 로 복사되고, 워커가 매장 정보·홈페이지 자료와
  함께 프롬프트에 넣는다(영상은 사용자 문장 바로 뒤, 배너는 매장 소개 뒤). 배너는 "이벤트 내용으로 채우기"로 문구를 채울 수 있다.

## 가상 모델 · 각도 세트

- **상태**(`virtual_models.status`, 0008): 대기(draft) → 공개(published) → 숨김(hidden) ↔ 공개. 새 모델은 대기로 시작하고,
  **공개만 콘텐츠 생성에서 고를 수 있다**(`listModels({ usable: true })`, `createContentAction` 이 다시 확인). 숨겨도 만든 콘텐츠는 그대로.
  바꾸기는 슈퍼어드민만(모델 화면 "상태" 카드). 예전 `archived` 칸은 남겨 두고 `status !== 'published'` 와 맞춘다.
  상태는 `modelStatus()` 로 읽는다 — 0008 전 DB 에서는 archived 로 판단한다.
- 만드는 방식 셋: 조건으로 만들기(글) · **사진 참고해 새 인물**(실제 사진의 분위기만 따고 얼굴은 다른 사람으로 —
  참고 사진은 모델에 저장하지 않는다) · 실제 인물 그대로(초상권 동의 필수).
- **각도 세트**: 모델마다 같은 얼굴로 얼굴 15 + 전신 4장을 한 번 만들어 고정한다(`core/src/model-shots.ts`).
  컷은 `model_images.label` 로 구분하고, 워커(`model_sheet`)는 없는 컷만 만든다 — 다시 돌려도 빠진 것만 채운다.
  기준 컷(얼굴 정면·전신 정면)을 먼저 만들고 나머지는 대표 + 기준 컷을 함께 넣어 그린다.
- **컷 수정**: 이상한 컷은 바로 지우지 않는다. 확대 보기에서 고칠 내용을 적으면(또는 "처음부터 다시") 워커
  (`model_shot_edit`)가 수정본 2장을 `models/<id>/draft-…` 로 만들고, 콘솔에서 지금 사진과 나란히 보고
  교체·이어서 고치기·버리기를 고른다. 고르기 전까지 `model_images` 는 그대로다. 수정본이 어느 이미지 것인지는
  jobs 기록(payload.imageId · result.paths)으로 알고, 고르면 `result.resolved` 를 적는다 — DB 칸을 따로 두지 않는다.
- 콘텐츠 첫 장면을 만들 때는 대표 + 얼굴 정면 + 전신 정면을 넘긴다(`loadModel`). 장면에 맞는 각도 컷 고르기는 아직 없다.

## 페르소나

- 모델마다 직업·MBTI·성격·취미·말투·자유 소개(`virtual_models.persona`, `core/src/persona.ts`). `personaBrief()` 요약이
  후보 얼굴·첫 장면·배너·영상 프롬프트에 "분위기 참고"로 들어간다. 얼굴 생김새는 바꾸지 않는다. DB 칸은 `0004_persona.sql`.

## 목소리 · 내레이션

- 모델 목소리: 기본 목소리(`core/src/voice.ts` 의 VOICE_PRESETS → ElevenLabs 기본 목소리) 또는 **녹음 파일**.
  녹음 파일은 녹음한 사람의 동의 체크가 있어야 저장되고, 워커(`voice_clone`)가 ElevenLabs 에 등록해 `voice_provider_id` 를 남긴다.
  목소리를 바꾸면 다시 등록하고 지난 목소리는 지운다(업체 등록 개수 한도). DB 칸은 `0003_voice.sql`.
- 숏폼 내레이션: 생성 화면의 대본(`settings.narration`)을 모델 목소리로 읽어(TTS) ffmpeg 로 영상에 입힌다.
  화면 밖 목소리(보이스오버)이고 립싱크는 없다. 영상보다 길면 뒤가 잘린다(1초에 7자 기준: 5초 35자 · 10초 70자 · 15초 105자 · 30초 210자).
- 목소리 업체는 `core/src/ai/voice/` 에 업체당 파일 하나(`VoiceProvider` 형식) + `index.ts` 의 PROVIDERS 한 줄.
  `VOICE_PROVIDER`(녹음 등록) · `VOICE_PRESET_PROVIDER`(기본 목소리) 로 고른다. 모델에는 `"업체:id"` 로 저장해
  업체를 섞거나 기본 업체를 바꿔도 예전 모델은 자기 업체로 읽는다. 업체를 빼면 그 모델은 "다시 등록"하면 된다.
- 녹음 목소리 엔진은 모델마다 고른다(`voice_engine`): **qwen** = 자체 Qwen3-TTS 서버(`voice-server/`, 등록 없이 읽을 때마다
  녹음 + 녹음에서 읽은 문장을 보낸다), **elevenlabs** = 업체에 목소리 등록. 기본 목소리는 ElevenLabs 가 읽는다.
- `AI_MODE=mock` 이면 업체를 부르지 않고 삐 소리로 길이만 맞춘 가짜 음성을 입힌다.

## 목소리 보관함 (`/voices`, 0006_voice_library.sql)

- 칩(성별·나이·음높이·분위기·속도) + 추가 설명을 고르면 워커(`voice_design`)가 **Qwen3-TTS VoiceDesign** 으로 후보 4개를
  `voice-candidates/` 에 만든다. 마음에 드는 후보를 별칭과 함께 보관하면 `voices` 표 + `voices/<id>/sample-….mp3`.
- VoiceDesign 은 **영어 설명만 제대로 알아듣는다**(한국어 "60대 할아버지"가 여성 음역으로 나왔다). 칩은 `core/src/voice.ts` 의
  `voiceInstruct()` 가 영어로 바꾸고, 직접 적은 추가 설명은 `core/src/ai/translate.ts` 가 OpenAI 로 옮긴다(키가 없으면 원문).
- 목소리의 실체는 샘플 mp3 + 샘플에서 읽은 문장(`VOICE_DESIGN_TEXT`). 모델에 고르면(`voice_source = 'library'`, `voice` = 별칭)
  샘플을 모델 폴더로 **복사**하고 녹음 목소리처럼 Qwen3-TTS Base 가 따라 읽는다 — 보관함에서 내려도 모델 목소리는 그대로다.
  업체 등록이 없어서 `voice_provider_id = 'qwen:ref'` 를 바로 넣고 등록 작업을 만들지 않는다.
- 모델 만들기·모델 화면 목소리 카드: AI로 만들기(후보 → "이 모델에 쓰기" = 보관 + 선택) / 보관함에서 고르기 / 기본 목소리 / 녹음 파일.
- 보관하지 않은 후보 파일(`voice-candidates/`)은 지우지 않는다(작은 mp3). 정리 작업이 필요하면 그때 만든다.
- 맥에서 돌린다: `voice-server` 를 `uvicorn` 으로 띄우고(Apple Silicon 은 자동으로 mps + bfloat16) `QWEN_TTS_URL=http://127.0.0.1:8000`.
  M5 24GB 기준 후보 하나 8–14초, 처음 `/design` 은 VoiceDesign 모델(약 4GB)을 올리느라 더 걸린다.

## 크롤링 · 매장 자료 수집

- 크롤러는 `core/src/crawl/` (소스마다 파일 하나, 결과는 `common.ts` 의 `CrawlResult` 하나, 진입점 `index.ts` 의 `runCrawl`).
  콘솔 실험 메뉴 `/lab/crawl` 은 저장하지 않고 보여 주기만 하고(콘솔 서버에서 바로 돈다), 실제 기능은 **매장 상세 "자료 수집" 탭**이다.
- 자료 수집: 매장 × 소스 종류마다 주소 하나(`store_sources`, 0007). 등록·다시 가져오기를 누르면 워커(`store_crawl`)가 긁어
  `data` 에 저장하고 지난 결과는 `prev_data` 로 민다(최신 + 직전만). 실패하면 `error` 만 적고 지난 결과는 그대로.
  디버그용 `raw`(네이버는 수 MB)는 저장하지 않는다. 사진은 원본 플랫폼 주소 그대로 — 쓸 사진만 다음 단계(매장 프로필)에서 버킷으로 복사한다.
- 결과 화면은 `console/src/components/crawl-result.tsx` 하나를 실험 메뉴와 자료 수집 탭이 같이 쓴다. 결과의 "연결된 채널"에서 바로 소스로 추가할 수 있다.
- 다음 단계(아직 없음): AI 가 소스들을 합쳐 매장 프로필 초안 → 관리자 확인·확정(`store_profiles`) → 고른 사진(`store_photos`) → 콘텐츠 기획에 참고.
- 주소로 종류를 자동으로 고른다(`detect.ts`). 소스마다 파일 하나, 결과는 `common.ts` 의 `CrawlResult` 하나로 맞춘다.
  같은 소스도 업종마다 칸이 달라서 알려진 경로 → 데이터 훑어 모양으로 찾기 → JSON-LD·og 순으로 시도하고 못 찾은 칸은 비워 둔다.
  - 네이버 플레이스(`naver-place.ts`, 20~30초): 헤드리스 크롬으로 m.place.naver.com 탭을 열어 `__APOLLO_STATE__` 를 합치고
    GraphQL 응답을 가로챈다. 직접 부르면 봇 방지 토큰이 없어 429, `navigator.webdriver` 가 켜져 있으면 405.
  - 카카오맵(`kakao-place.ts`, 1초 미만): `place-api.map.kakao.com/places/panel3/<id>` JSON 을 바로(`pf: web` 헤더).
  - 당근(`daangn.ts`, 1초): 페이지 HTML 의 `__remixContext` 에서 `__typename: LocalProfile` 객체를 찾는다.
  - 홈페이지(`homepage.ts`, 약 15초): 크롬으로 첫 화면 + 회사소개·메뉴 같은 하위 페이지 3개를 동시에 열어 글·큰 이미지·SNS 링크·연락처를 모은다.
  - 인스타그램(`instagram.ts`): 로그인 없이 프로필(이름·소개·팔로워·게시물 수)만. 게시물은 공식 API(채널 연결) 몫.
  - 스마트스토어: 자동 접속을 로그인 화면으로 보내서 지원하지 않는다(2026-11 확인).
- 처음 한 번 `apps/marketing/console` 에서 `pnpm exec playwright-core install chromium-headless-shell`(core 도 같은 버전이라 워커가 같이 쓴다). 없으면 설치된 크롬으로 대신 띄운다.
- 서버리스(Vercel)에서는 돌지 않는다 — 저장하는 수집은 워커에서만 돈다. 네이버 이미지 주소는 나중에 바뀔 수 있으니 쓸 때는 우리 버킷으로 복사한다.

## 채널 연결 (인스타그램·유튜브 자동 업로드)

- 비밀번호는 받지 않는다. 채널 관리의 **연결 링크 복사** → 고객이 `/connect/<링크값>`(로그인 없이 열림)에서 플랫폼에
  직접 로그인·허용 → `/api/oauth/callback/<플랫폼>` 이 토큰을 `store_channels` 에 저장하고 상태를 `connected` 로 바꾼다.
  링크값은 매장·플랫폼·만료(7일)를 HMAC 으로 서명한 것(`console/src/lib/oauth.ts`, 비밀값 `OAUTH_STATE_SECRET`).
- 인스타그램 = Instagram API with Instagram Login(페이스북 페이지 불필요, 프로페셔널 계정만). 장기 토큰 60일 —
  워커가 남은 기간 20일 아래면 업로드 직전과 6시간마다 연장한다. 업로드 계정 ID 는 `/me` 의 `user_id`.
- 유튜브 = Google OAuth(`youtube.upload` + 채널 이름 확인용 `youtube.readonly`). refresh_token 만 저장한다.
- 토큰이 끊기면(Meta code 190 · Google invalid_grant) 업로드가 실패하고 채널이 `expired` 가 된다 → 링크를 다시 보낸다.
- 토큰은 화면으로 내려보내지 않는다(`lib/data.ts` 의 `hideTokens`). 워커와 OAuth 콜백만 읽는다.
- 키·리디렉션 주소는 `console/.env.example`. 인스타그램은 https 리디렉션만 받아서 로컬은 `cloudflared tunnel --url http://localhost:3100`
  주소를 `CONSOLE_URL` 에 넣고 그 주소로 콘솔을 연다. 구글은 http://localhost:3100 도 된다.
- 검수 전: Meta 앱은 앱 역할(Instagram 테스터)로 넣은 계정만, 구글은 OAuth 동의 화면 "테스트 사용자"만 연결된다.
  구글 테스트 모드의 refresh_token 은 7일 뒤 끊긴다.
- 스레드 연결은 아직 없다(업로드 코드만 있다).

## 권한

- `admins.role`: `super` = 전체, `manager` = `store_managers` 로 할당된 매장만.
- 화면은 `requireStaff`/`requireSuper`, 서버 액션은 `actionStaff`/`actionSuper`/`actionStore` 로 다시 확인한다.
  서버 액션은 누구나 부를 수 있는 엔드포인트다.

## 아직 없는 것 (다음 단계)

- 스레드 연결(OAuth). 인스타그램·유튜브 실제 계정 업로드는 아직 실제 계정으로 돌려 보지 않았다.
- AI 포스팅(글 + 이미지 조합), 예약 업로드, 비용 집계, 고객 승인 단계.
