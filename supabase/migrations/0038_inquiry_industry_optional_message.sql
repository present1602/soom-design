-- 의뢰·문의 폼: 문의내용·이메일을 선택으로 바꾸고 업종(선택) 칸을 더한다.
-- 업종 선택지는 의뢰 폼과 마케팅 문의 폼이 같이 쓰고 어드민 설정 > 업종 목록에서 고친다(site_settings.industries).
-- Supabase SQL Editor 에서 실행한다. 여러 번 실행해도 안전하다.
-- 실행 전에도 접수는 된다 — 코드가 업종 없이, 빈 문의내용·이메일은 "미입력"으로 다시 저장한다(api/inquiry).

alter table public.inquiries alter column message drop not null;
alter table public.inquiries drop constraint if exists inquiries_message_len;
alter table public.inquiries add constraint inquiries_message_len
  check (message is null or char_length(trim(message)) <= 5000);

alter table public.inquiries alter column email drop not null;
alter table public.inquiries drop constraint if exists inquiries_email_len;
alter table public.inquiries add constraint inquiries_email_len
  check (email is null or char_length(trim(email)) between 3 and 200);

alter table public.inquiries add column if not exists industry text;
alter table public.inquiries drop constraint if exists inquiries_industry_len;
alter table public.inquiries add constraint inquiries_industry_len
  check (industry is null or char_length(industry) <= 50);

-- 업종 목록(비어 있으면 코드의 기본 목록을 쓴다 — lib/industries.ts)
alter table public.site_settings add column if not exists industries text[] not null default '{}';
update public.site_settings set industries = array[
  '음식점 · 카페 · 베이커리', '뷰티 · 헬스 · 필라테스', '학원 · 교육', '병원 · 의료',
  '쇼핑몰 · 판매', 'IT · 스타트업 · 플랫폼', '전문 서비스 · B2B', '기타'
] where id and industries = '{}';
