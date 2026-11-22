-- 가상 모델 상태: 대기(draft) · 공개(published) · 숨김(hidden) (2026-11-22)
-- - draft: 막 만든 모델. 각도 세트·목소리를 다듬는 중이라 콘텐츠 생성에서 고를 수 없다
-- - published: 콘텐츠 생성에서 고를 수 있다
-- - hidden: 쓰다가 내린 모델. 새 콘텐츠에서 못 고르고, 이미 만든 콘텐츠는 그대로 둔다
-- 예전 archived 칸은 지우지 않고 status 와 맞춰 둔다(archived = status 가 published 가 아님).
-- 이 파일 전에 있던 모델은 공개, 내렸던 모델(archived)은 숨김으로 옮긴다. 새 모델의 기본값은 대기.
-- Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 돌려도 안전하다.

alter table virtual_models add column if not exists status text not null default 'published';
alter table virtual_models drop constraint if exists virtual_models_status_chk;
alter table virtual_models add constraint virtual_models_status_chk check (status in ('draft', 'published', 'hidden'));
update virtual_models set status = 'hidden' where archived and status = 'published';
alter table virtual_models alter column status set default 'draft';
create index if not exists virtual_models_status_idx on virtual_models (status, created_at);
