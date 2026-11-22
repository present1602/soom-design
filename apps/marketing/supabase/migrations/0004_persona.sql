-- 가상 모델 페르소나 · 목소리 엔진 선택 (2026-11-21)
-- persona: 직업·MBTI·성격·취미·말투·소개 (core/src/persona.ts). AI 프롬프트에 분위기 참고로 들어간다.
-- voice_engine: 녹음 목소리를 읽을 엔진 (qwen = 자체 Qwen3-TTS 서버, elevenlabs)
-- voice_sample_text: 녹음에서 읽은 문장 (Qwen3-TTS 는 이게 있어야 목소리가 더 비슷해진다)
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 0003_voice.sql 다음에. 여러 번 돌려도 안전하다.

alter table virtual_models add column if not exists persona jsonb not null default '{}'::jsonb;
alter table virtual_models add column if not exists voice_engine text;
alter table virtual_models add column if not exists voice_sample_text text;
