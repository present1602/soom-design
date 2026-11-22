-- 가상 모델 목소리 · 숏폼 내레이션 (2026-11-21)
-- voice_source: preset = 기본 목소리(voice 칸의 이름), upload = 녹음 파일로 업체(ElevenLabs)에 등록한 목소리
-- 내레이션 대본은 contents.settings.narration, 합성한 음성 파일은 content_assets(kind = 'narration') 에 둔다.
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하다.

alter table virtual_models add column if not exists voice_source text not null default 'preset';
alter table virtual_models add column if not exists voice_sample_path text;
alter table virtual_models add column if not exists voice_consent boolean not null default false;
alter table virtual_models add column if not exists voice_provider_id text;
alter table virtual_models add column if not exists voice_error text;
alter table virtual_models drop constraint if exists virtual_models_voice_source_chk;
alter table virtual_models add constraint virtual_models_voice_source_chk check (voice_source in ('preset', 'upload'));
