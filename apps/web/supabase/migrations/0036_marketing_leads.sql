-- ════════════════════════════════════════════════════════
-- 마케팅 대행 "출시 소식 받기" 접수 (/marketing 페이지).
-- 0035_roster_files.sql 다음에 실행한다.
-- Supabase SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ════════════════════════════════════════════════════════

-- 의뢰 문의(inquiries)와 칸이 달라 따로 둔다. 서버(service_role)만 읽고 쓴다.
create table if not exists public.marketing_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- 필수
  company         text not null,
  contact_name    text not null,
  phone           text not null,
  industry        text not null,
  -- 시·군·구까지만 (예: 서울 강남구)
  region          text not null,

  -- 선택 — 서버가 https:// 를 붙여 정리한 주소. 안 적으면 null
  homepage_url    text,
  naver_place_url text,
  instagram_url   text,
  youtube_url     text,

  -- 같은 접수를 두 번 저장하지 않게(연결이 끊겨 다시 보낸 경우)
  submit_key      text unique,
  -- 어드민 알림 메일이 나갔는지
  mailed          boolean not null default false
);

alter table public.marketing_leads drop constraint if exists marketing_leads_len;
alter table public.marketing_leads add constraint marketing_leads_len check (
  char_length(company) <= 100
  and char_length(contact_name) <= 100
  and char_length(phone) <= 40
  and char_length(industry) <= 50
  and char_length(region) <= 50
  and coalesce(char_length(homepage_url), 0) <= 500
  and coalesce(char_length(naver_place_url), 0) <= 500
  and coalesce(char_length(instagram_url), 0) <= 500
  and coalesce(char_length(youtube_url), 0) <= 500
);

create index if not exists marketing_leads_created_idx on public.marketing_leads (created_at desc);

alter table public.marketing_leads enable row level security;
alter table public.marketing_leads force row level security;
