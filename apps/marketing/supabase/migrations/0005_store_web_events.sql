-- 매장 홈페이지 주소 · 매장 이벤트 (2026-11-21)
-- 1) 홈페이지 주소: 아무 사이트나 넣으면 생성 직전에 페이지 글을 읽어 참고 자료로 쓴다(자료 API 를 켠 매장은 API 가 먼저).
-- 2) 매장 이벤트: 대행사가 직접 입력하는 이벤트·프로모션. 콘텐츠를 만들 때 하나 골라 매장 정보와 함께 AI 에 넘긴다.
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하다.

alter table stores add column if not exists homepage_url text not null default '';
alter table stores add column if not exists homepage_cache jsonb;
alter table stores add column if not exists homepage_fetched_at timestamptz;
alter table stores add column if not exists homepage_error text;

create table if not exists store_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  title text not null,
  starts_on date,
  ends_on date,
  -- 혜택 한 줄 (예: 아메리카노 1+1)
  offer text not null default '',
  -- 대상·조건·참여 방법 등 자세한 내용
  details text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_events_store_idx on store_events (store_id, archived, created_at desc);

grant select, insert, update, delete on store_events to service_role;
revoke all on store_events from anon, authenticated;
alter table store_events enable row level security;
alter table store_events force row level security;
