'use client'

import { MBTIS, type Persona } from '@marketing/core/persona'
import { Field, cx, inputCls } from './ui'

/* 가상 모델 페르소나 입력. 키워드 칸은 쉼표로 나누고, 아래 추천 키워드를 눌러 넣고 뺄 수 있다. */

export type PersonaDraft = { role: string; mbti: string; traits: string; hobbies: string; speech: string; bio: string }

export const toDraft = (p: Persona | null | undefined): PersonaDraft => ({
  role: p?.role ?? '',
  mbti: p?.mbti ?? '',
  traits: (p?.traits ?? []).join(', '),
  hobbies: (p?.hobbies ?? []).join(', '),
  speech: p?.speech ?? '',
  bio: p?.bio ?? '',
})

const split = (s: string) => s.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean)
export const fromDraft = (d: PersonaDraft): Persona => ({ role: d.role, mbti: d.mbti, traits: split(d.traits), hobbies: split(d.hobbies), speech: d.speech, bio: d.bio })

const TRAITS = ['밝음', '친근함', '활발함', '차분함', '다정함', '장난기', '유머러스', '카리스마', '세련됨', '진지함']
const HOBBIES = ['운동', '러닝', '요가', '필라테스', '카페 탐방', '요리', '여행', '패션', '음악', '게임', '독서', '캠핑']

function Chips({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const cur = split(value)
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = cur.includes(o)
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onChange((on ? cur.filter((x) => x !== o) : [...cur, o]).join(', '))} className={cx('rounded-full border px-2 py-0.5 text-[12px]', on ? 'border-accent bg-accent-weak text-accent' : 'border-line text-ink-soft hover:border-accent')}>
            {on ? '✓ ' : '+ '}
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function PersonaFields({ value: d, onChange, idPrefix = 'pf' }: { value: PersonaDraft; onChange: (d: PersonaDraft) => void; idPrefix?: string }) {
  const set = (k: keyof PersonaDraft) => (v: string) => onChange({ ...d, [k]: v })
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="직업 · 캐릭터" htmlFor={`${idPrefix}-role`}>
          <input id={`${idPrefix}-role`} className={inputCls} value={d.role} onChange={(e) => set('role')(e.target.value)} placeholder="예: 데뷔 3년 차 아이돌 가수" maxLength={60} />
        </Field>
        <Field label="MBTI" htmlFor={`${idPrefix}-mbti`}>
          <select id={`${idPrefix}-mbti`} className={inputCls} value={d.mbti} onChange={(e) => set('mbti')(e.target.value)}>
            <option value="">선택 안 함</option>
            {MBTIS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="성격 키워드 (쉼표로 구분)" htmlFor={`${idPrefix}-traits`}>
        <input id={`${idPrefix}-traits`} className={inputCls} value={d.traits} onChange={(e) => set('traits')(e.target.value)} placeholder="예: 밝음, 처음 보는 사람과도 금방 친해짐" />
      </Field>
      <Chips value={d.traits} options={TRAITS} onChange={set('traits')} />
      <Field label="취미 · 관심사 (쉼표로 구분)" htmlFor={`${idPrefix}-hobbies`}>
        <input id={`${idPrefix}-hobbies`} className={inputCls} value={d.hobbies} onChange={(e) => set('hobbies')(e.target.value)} placeholder="예: 운동, 카페 탐방" />
      </Field>
      <Chips value={d.hobbies} options={HOBBIES} onChange={set('hobbies')} />
      <Field label="말투" htmlFor={`${idPrefix}-speech`}>
        <input id={`${idPrefix}-speech`} className={inputCls} value={d.speech} onChange={(e) => set('speech')(e.target.value)} placeholder="예: 반말 섞인 친근한 말투, 감탄사가 많음" maxLength={120} />
      </Field>
      <Field label="자유 소개" htmlFor={`${idPrefix}-bio`} hint="배경 이야기, 좋아하는 것, 잘 안 하는 행동 등. 자유롭게 적을수록 개성이 살아나요.">
        <textarea id={`${idPrefix}-bio`} rows={3} className={inputCls} value={d.bio} onChange={(e) => set('bio')(e.target.value)} placeholder="예: 아침마다 한강을 달리고, 팬들에게 먼저 말을 거는 게 습관. 매운 음식을 좋아함." maxLength={600} />
      </Field>
    </div>
  )
}
