/* 짧은 한국어 설명 → 영어 (목소리 설명용).
   Qwen3-TTS VoiceDesign 은 한국어 설명을 거의 알아듣지 못해서, 직원이 적은 추가 설명만 옮긴다.
   OPENAI_API_KEY 가 없거나 실패하면 원문을 그대로 돌려준다 — 칩 설명만으로도 후보는 만들어진다.
   env: OPENAI_API_KEY, OPENAI_TEXT_MODEL (기본 gpt-4o-mini) */

export async function toEnglish(text: string): Promise<{ text: string; translated: boolean }> {
  const src = text.trim()
  if (!src || !/[가-힣]/.test(src)) return { text: src, translated: false }
  const key = process.env.OPENAI_API_KEY
  if (!key) return { text: src, translated: false }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: 'Translate the Korean description of a voice into one short natural English phrase for a voice-design TTS model. Output only the translation.' },
          { role: 'user', content: src.slice(0, 300) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const out = j.choices?.[0]?.message?.content?.trim()
    return out ? { text: out.slice(0, 300), translated: true } : { text: src, translated: false }
  } catch (e) {
    console.warn('[translate] 영어로 옮기지 못해 원문을 써요:', e instanceof Error ? e.message : e)
    return { text: src, translated: false }
  }
}
