-- 의뢰·마케팅 문의 접수 확인 알림톡(Solapi) 발송 결과를 남긴다(lib/alimtalk.ts).
-- alimtalk: sent(Solapi 접수됨) · failed(거절·오류) · skipped(설정 없음·휴대폰 번호 아님). 이 파일 전에 들어온 건은 null.
-- Supabase SQL Editor 에서 실행한다. 여러 번 실행해도 안전하다.
-- 실행 전에도 접수·발송은 된다 — 결과만 저장되지 않는다(로그에 이 파일 이름을 남긴다).

alter table public.inquiries add column if not exists alimtalk text;
alter table public.inquiries add column if not exists alimtalk_error text;
alter table public.inquiries drop constraint if exists inquiries_alimtalk_check;
alter table public.inquiries add constraint inquiries_alimtalk_check
  check (alimtalk is null or alimtalk in ('sent', 'failed', 'skipped'));

alter table public.marketing_leads add column if not exists alimtalk text;
alter table public.marketing_leads add column if not exists alimtalk_error text;
alter table public.marketing_leads drop constraint if exists marketing_leads_alimtalk_check;
alter table public.marketing_leads add constraint marketing_leads_alimtalk_check
  check (alimtalk is null or alimtalk in ('sent', 'failed', 'skipped'));
