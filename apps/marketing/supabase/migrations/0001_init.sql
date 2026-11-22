-- 마케팅 대행 콘솔 기준 스키마 (2026-11-21)
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하게(멱등) 쓴다.
-- 모든 표는 RLS 를 켜고(enable + force) 정책을 두지 않는다 — 서버(service_role)만 읽고 쓴다.

create extension if not exists pgcrypto;

-- ───────────── 관리자 ─────────────
-- 로그인은 Supabase Auth 로 하고, 들어올 수 있는 사람과 권한은 이 표로 정한다.
-- role: super = 슈퍼어드민(전체), manager = 콘텐츠 관리자(할당된 매장만)
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nickname text not null,
  role text not null default 'manager',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists admins_email_key on admins (lower(email));
alter table admins drop constraint if exists admins_role_chk;
alter table admins add constraint admins_role_chk check (role in ('super', 'manager'));

-- ───────────── 고객사 · 매장 ─────────────
create sequence if not exists client_code_seq;
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  code text not null default ('CL-' || lpad(nextval('client_code_seq')::text, 4, '0')),
  name text not null,
  rep_name text not null default '',
  phone text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_code_key on clients (code);

-- 고객사 하나가 매장이나 브랜드를 여러 개 가진다. 콘텐츠·채널·담당자는 매장 단위다.
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  kind text not null default 'store',
  address text not null default '',
  phone text not null default '',
  hours text not null default '',
  intro text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table stores drop constraint if exists stores_kind_chk;
alter table stores add constraint stores_kind_chk check (kind in ('store', 'brand'));
create index if not exists stores_client_idx on stores (client_id, sort, created_at);

-- 콘텐츠 담당자는 매장별로 여러 명. 넣고 빼는 건 슈퍼어드민만.
create table if not exists store_managers (
  store_id uuid not null references stores(id) on delete cascade,
  admin_id uuid not null references admins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, admin_id)
);
create index if not exists store_managers_admin_idx on store_managers (admin_id);

-- 매장별 플랫폼 채널. 여기 등록한 채널만 콘텐츠 업로드 대상에 나온다.
-- status: pending = 등록만(고객 허용 전), connected = 토큰 있음, expired = 토큰 만료,
--         manager = 카카오처럼 API 없이 매니저 초대로 직접 올리는 채널
create table if not exists store_channels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  platform text not null,
  handle text not null default '',
  profile_url text not null default '',
  status text not null default 'pending',
  external_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table store_channels drop constraint if exists store_channels_platform_chk;
alter table store_channels add constraint store_channels_platform_chk check (platform in ('instagram', 'youtube', 'threads', 'kakao'));
alter table store_channels drop constraint if exists store_channels_status_chk;
alter table store_channels add constraint store_channels_status_chk check (status in ('pending', 'connected', 'expired', 'manager'));
create unique index if not exists store_channels_store_platform_key on store_channels (store_id, platform);

-- ───────────── 가상 모델 ─────────────
create table if not exists virtual_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null default '',
  age_band text not null default '',
  mood text not null default '',
  voice text not null default '',
  source text not null default 'ai',
  consent boolean not null default false,
  cover_path text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table virtual_models drop constraint if exists virtual_models_source_chk;
alter table virtual_models add constraint virtual_models_source_chk check (source in ('ai', 'photo'));

-- 각도·의상 같은 기준 이미지. 얼굴이 영상마다 달라지지 않게 함께 넘긴다.
create table if not exists model_images (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references virtual_models(id) on delete cascade,
  label text not null default '',
  path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists model_images_model_idx on model_images (model_id, sort);

-- ───────────── 생성 옵션 ─────────────
-- 숏폼 분위기 단어. 슈퍼어드민이 설정 화면에서 넣고 빼고 순서를 바꾼다.
create table if not exists mood_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists mood_options_label_key on mood_options (label);
insert into mood_options (label, sort) values
  ('세련된', 1), ('현대적인', 2), ('감각적인', 3), ('편안한', 4),
  ('따뜻한', 5), ('고급스러운', 6), ('활기찬', 7), ('미니멀한', 8)
on conflict (label) do nothing;

-- ───────────── 콘텐츠 ─────────────
-- type: short = AI 숏폼(영상), banner = AI 배너(이미지)
-- status: generating → ready(업로드 전) → published(한 곳 이상 올라감) / failed
create table if not exists contents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  type text not null,
  status text not null default 'generating',
  title text not null default '',
  prompt text not null default '',
  moods text[] not null default '{}',
  model_id uuid references virtual_models(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references admins(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table contents drop constraint if exists contents_type_chk;
alter table contents add constraint contents_type_chk check (type in ('short', 'banner'));
alter table contents drop constraint if exists contents_status_chk;
alter table contents add constraint contents_status_chk check (status in ('generating', 'ready', 'failed', 'published'));
create index if not exists contents_store_idx on contents (store_id, created_at desc);
create index if not exists contents_published_idx on contents (published_at desc) where published_at is not null;

-- 콘텐츠에 딸린 파일.
-- kind: product(제품) · reference(참고) · first_frame(퍼스트 프레임) · video(결과 영상)
--       thumb_candidate(AI 추천 썸네일) · thumbnail(쓰는 썸네일) · variant(배너 시안)
-- selected: 썸네일 후보·배너 시안 중 고른 것
create table if not exists content_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  kind text not null,
  path text not null,
  sort int not null default 0,
  selected boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists content_assets_content_idx on content_assets (content_id, kind, sort);

-- 채널별 업로드 기록. 카카오처럼 API 가 없는 채널은 manual 로 두고 직원이 주소를 적는다.
create table if not exists content_posts (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  channel_id uuid references store_channels(id) on delete set null,
  platform text not null,
  status text not null default 'queued',
  caption text not null default '',
  post_url text,
  error text,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table content_posts drop constraint if exists content_posts_status_chk;
alter table content_posts add constraint content_posts_status_chk check (status in ('queued', 'uploading', 'done', 'failed', 'manual'));
create index if not exists content_posts_content_idx on content_posts (content_id);

-- 매장별 마지막 업로드 시각 (고객사 목록의 "최근 업로드")
create or replace view store_last_upload as
  select c.store_id, max(c.published_at) as last_published_at
  from contents c where c.published_at is not null group by c.store_id;

-- ───────────── 작업 큐 ─────────────
-- 콘솔이 넣고 워커가 꺼내 처리한다. 저장소가 나뉘어도 DB 만 같으면 그대로 돈다.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 2,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table jobs drop constraint if exists jobs_status_chk;
alter table jobs add constraint jobs_status_chk check (status in ('queued', 'running', 'done', 'failed'));
create index if not exists jobs_queue_idx on jobs (status, run_after, created_at);

-- 하나만 꺼낸다. 여러 워커가 동시에 불러도 같은 작업을 두 번 잡지 않는다(skip locked).
-- 30분 넘게 running 인 작업은 워커가 죽은 것으로 보고 다시 꺼낼 수 있게 한다.
create or replace function claim_job(p_worker text)
returns setof jobs
language plpgsql
as $$
begin
  return query
  update jobs j
     set status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = j.attempts + 1, updated_at = now()
   where j.id = (
     select q.id from jobs q
      where (q.status = 'queued' and q.run_after <= now())
         or (q.status = 'running' and q.locked_at < now() - interval '30 minutes')
      order by q.created_at
      limit 1
      for update skip locked
   )
  returning j.*;
end;
$$;

-- ───────────── 저장소 ─────────────
-- 비공개 버킷. 화면에는 서명 링크로만 보여 준다.
insert into storage.buckets (id, name, public) values ('marketing', 'marketing', false)
on conflict (id) do nothing;

-- ───────────── API 권한 ─────────────
-- 프로젝트 설정에서 "Grant API access to new tables automatically" 를 끄면 새 표에 아무 권한도 붙지 않는다.
-- 서버(service_role)에만 직접 준다. anon·authenticated(브라우저)에는 주지 않는다 — RLS 와 함께 이중으로 막힌다.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function claim_job(text) to service_role;
revoke all on all tables in schema public from anon, authenticated;
revoke execute on function claim_job(text) from anon, authenticated, public;

-- ───────────── RLS ─────────────
alter table admins enable row level security;            alter table admins force row level security;
alter table clients enable row level security;           alter table clients force row level security;
alter table stores enable row level security;            alter table stores force row level security;
alter table store_managers enable row level security;    alter table store_managers force row level security;
alter table store_channels enable row level security;    alter table store_channels force row level security;
alter table virtual_models enable row level security;    alter table virtual_models force row level security;
alter table model_images enable row level security;      alter table model_images force row level security;
alter table mood_options enable row level security;      alter table mood_options force row level security;
alter table contents enable row level security;          alter table contents force row level security;
alter table content_assets enable row level security;    alter table content_assets force row level security;
alter table content_posts enable row level security;     alter table content_posts force row level security;
alter table jobs enable row level security;              alter table jobs force row level security;
