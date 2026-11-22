-- 목소리 보관함 (2026-11-22)
-- 글로 설명하면 AI(Qwen3-TTS VoiceDesign)가 후보 목소리 여러 개를 만들고, 마음에 드는 것을 별칭("중저음 따뜻한 톤")을 붙여 보관한다.
-- 보관한 목소리는 어느 모델에든 고를 수 있다. 목소리의 실체는 샘플 음성 파일 + 그 파일에서 읽은 문장이고,
-- 내레이션은 이 샘플을 Qwen3-TTS Base 가 따라 읽는다(녹음 목소리와 같은 방식).
-- 모델에 고르면 샘플을 모델 폴더로 복사해 둔다 — 보관함에서 내려도 그 모델 목소리는 그대로다.
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하다.

create table if not exists voices (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  gender text not null,
  -- 직원이 적은 설명 (한국어)
  description text not null default '',
  -- AI 에 실제로 넘긴 설명
  instruct text not null default '',
  engine text not null default 'qwen',
  sample_path text not null,
  sample_text text not null default '',
  archived boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
alter table voices drop constraint if exists voices_gender_chk;
alter table voices add constraint voices_gender_chk check (gender in ('female', 'male'));
create index if not exists voices_list_idx on voices (archived, gender, created_at desc);

grant select, insert, update, delete on voices to service_role;
revoke all on voices from anon, authenticated;
alter table voices enable row level security;
alter table voices force row level security;

-- 모델이 보관함 목소리를 쓰면 voice_source = 'library', voice = 별칭
alter table virtual_models add column if not exists voice_library_id uuid references voices(id) on delete set null;
alter table virtual_models drop constraint if exists virtual_models_voice_source_chk;
alter table virtual_models add constraint virtual_models_voice_source_chk check (voice_source in ('preset', 'upload', 'library'));
