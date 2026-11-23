-- /marketing 문의 폼. 0036_marketing_leads.sql 다음에 Supabase SQL Editor에서 실행한다.
-- 예전 신청의 담당자명과 채널 주소는 보존한다.
alter table public.marketing_leads
  add column if not exists message text,
  alter column contact_name drop not null;

alter table public.marketing_leads drop constraint if exists marketing_leads_message_len;
alter table public.marketing_leads add constraint marketing_leads_message_len
  check (char_length(message) <= 2000);
