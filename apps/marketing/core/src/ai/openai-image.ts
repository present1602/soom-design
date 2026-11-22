/* OpenAI 이미지 API (참고: proj/main-repo talents-hub/lib/ai-providers/openai-image.ts)
   - compose: 여러 이미지를 넣어 새 이미지 만들기 (모델+제품 합성, 배너)
   - generate: 글로만 새 이미지 만들기 (가상 모델 후보 얼굴) */

import { AiError, networkError, openAiError } from './errors'

const BASE = 'https://api.openai.com/v1'

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024'
export type InputImage = { data: Uint8Array; mime: string; name: string }

function model() {
  return process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
}

function key() {
  const k = process.env.OPENAI_API_KEY
  if (!k) throw new AiError('openai', 'auth', 'OPENAI_API_KEY 가 없어 이미지를 만들 수 없어요. worker/.env.local 에 넣거나 AI_MODE=mock 으로 두세요.')
  return k
}

async function call(url: string, init: RequestInit, what: string) {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(5 * 60_000) })
  } catch (e) {
    throw networkError('openai', e)
  }
  if (!res.ok) throw openAiError(res.status, await res.text(), what)
  return res
}

function decode(json: { data?: { b64_json?: string }[] }) {
  const out = (json.data ?? [])
    .map((d) => d.b64_json)
    .filter((b): b is string => typeof b === 'string' && b.length > 0)
    .map((b) => Buffer.from(b, 'base64'))
  if (!out.length) throw new Error('이미지 결과를 받지 못했어요')
  return out
}

export async function composeImages(images: InputImage[], prompt: string, n: number, size: ImageSize) {
  const form = new FormData()
  form.append('model', model())
  form.append('prompt', prompt)
  form.append('n', String(n))
  form.append('size', size)
  for (const img of images) form.append('image[]', new Blob([new Uint8Array(img.data)], { type: img.mime }), img.name)
  const res = await call(`${BASE}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key()}` }, body: form }, '이미지 합성')
  return decode(await res.json())
}

export async function generateImages(prompt: string, n: number, size: ImageSize) {
  const res = await call(
    `${BASE}/images/generations`,
    { method: 'POST', headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model(), prompt, n, size }) },
    '이미지 생성',
  )
  return decode(await res.json())
}
