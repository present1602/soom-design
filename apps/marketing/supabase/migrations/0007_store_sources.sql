-- 매장 자료 수집 (2026-11-22)
-- 매장마다 소스 주소(네이버 플레이스·카카오맵·당근·인스타그램·홈페이지)를 등록하고, 워커(store_crawl)가 긁어 온 결과를 저장한다.
-- 소스 종류마다 한 줄. 최신 결과(data)와 그 직전 결과(prev_data)만 둔다 — 무엇이 바뀌었는지 보고, 용량은 늘지 않게.
-- data 는 core/src/crawl/common.ts 의 CrawlResult (디버그용 raw 는 뺀다). 사진은 원본 플랫폼 주소 그대로 — 고른 것만 나중에 우리 버킷으로 복사한다.
-- 이 자료를 AI 가 정리한 매장 프로필은 다음 단계(store_profiles).
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하다.

create table if not exists store_sources (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  kind text not null,
  url text not null,
  data jsonb,
  fetched_at timestamptz,
  prev_data jsonb,
  prev_fetched_at timestamptz,
  -- 마지막 가져오기 실패 이유 (성공하면 null. 실패해도 지난 data 는 남는다)
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table store_sources drop constraint if exists store_sources_kind_chk;
alter table store_sources add constraint store_sources_kind_chk check (kind in ('naver_place', 'kakao_place', 'daangn', 'instagram', 'homepage'));
create unique index if not exists store_sources_store_kind_idx on store_sources (store_id, kind);

grant select, insert, update, delete on store_sources to service_role;
revoke all on store_sources from anon, authenticated;
alter table store_sources enable row level security;
alter table store_sources force row level security;
