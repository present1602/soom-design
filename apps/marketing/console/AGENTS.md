<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> 마케팅 콘솔(`apps/marketing/console`) 규칙. 서비스 전체 규칙·실행 방법은 `apps/marketing/AGENTS.md`.

## 콘솔 규칙

- `cacheComponents` 는 켜지 않는다. 모든 화면이 로그인에 따라 달라서 정적 셸로 얻는 것이 없다.
  로그인 확인(`lib/staff.ts`)은 `connection()` 으로 요청 시점 실행을 명시하고, catch 에서 `unstable_rethrow` 로
  Next 내부 신호를 삼키지 않는다 — 삼키면 빌드 때 페이지가 로그인 화면으로 굳는다.
- 데이터는 서버에서 service_role(`lib/supabase.ts` 의 `db()`)로 읽는다. 브라우저 클라이언트는 로그인과
  서명 받은 주소로 파일을 바로 올릴 때만 쓴다.
- 버튼을 눌렀으면 결과가 화면에 보여야 한다. 서버 액션은 `{ ok: false, error }` 를 돌려주고, 화면은
  `useAction()` 으로 부른 뒤 `ErrorLine` 을 그 버튼 가까이(다이얼로그 안이면 다이얼로그 안에) 둔다.
- 비공개 버킷 파일은 `signMany()` 서명 링크(1시간)로만 보인다.
- 모델 파일은 `models/<모델ID>/` 에 모은다(경로 규칙은 `core/src/storage.ts`). 모델 저장 전에 올라온
  사진·녹음·AI 후보는 저장할 때 `lib/model-files.ts` 의 `adopt()` 로 복사해 오고, 모델에서 뺀 파일은
  `removeModelFiles()` 로 지운다. 대표 이미지는 파일 이름이 아니라 `virtual_models.cover_path` 가 정한다.
- 모델을 만들 때 넣은 실제 인물 사진은 초상권 확인용으로 `sources/<모델ID>/` 에 사본과 `info.json` 을 남긴다
  (`archiveSources()`). 이 폴더는 코드가 읽거나 지우지 않는다 — 정리 작업을 만들 때도 건드리지 않는다.
- UI 를 고쳤으면 브라우저로 성공과 실패 문구가 보이는지 둘 다 확인한다.
- **반응형은 크게 신경 쓰지 않는다.** 콘솔은 어드민과 콘텐츠 관리자만 들어오는 내부 화면이고
  일반 사용자에게 공개되지 않는다. 모바일에서도 쓸 만하면 좋지만, 휴대폰 폭(390px) 레이아웃 테스트까지
  꼼꼼히 할 필요는 없다 — 데스크톱(1280px)에서 동작과 문구를 확인하면 충분하다.
  (공개 홈페이지 `apps/web` 은 다르다 — 그쪽은 휴대폰 폭도 확인한다.)
