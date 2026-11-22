-- 고객사 홈페이지 자료 API (2026-11-21)
-- 우리가 만들어 준 고객사 사이트의 읽기 전용 API 주소·토큰을 매장마다 둔다.
-- 숏폼·배너를 만들기 직전에 워커가 불러 프롬프트 참고 자료로 쓰고, 받은 자료는 cache 에 남긴다.
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하다.

alter table stores add column if not exists site_feed_url text not null default '';
alter table stores add column if not exists site_feed_token text;
alter table stores add column if not exists site_feed_cache jsonb;
alter table stores add column if not exists site_feed_fetched_at timestamptz;
alter table stores add column if not exists site_feed_error text;
