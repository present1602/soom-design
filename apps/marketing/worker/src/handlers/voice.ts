import type { JobPayloads, JobResults } from '@marketing/core/jobs'
import { cloneProvider, MOCK, packVoiceId, presetProvider, providerOf, unpackVoiceId, type VoiceRef } from '@marketing/core/ai/voice/index'
import { designVoice } from '@marketing/core/ai/voice/qwen'
import { toEnglish } from '@marketing/core/ai/translate'
import { voiceCandidatePath } from '@marketing/core/storage'
import type { VirtualModel } from '@marketing/core/types'
import { voiceInstruct } from '@marketing/core/voice'
import { db, download, must, upload } from '../db'
import { env } from '../env'
import { mockSpeech } from '../ffmpeg'

/* 가상 모델 목소리. 업체는 core/src/ai/voice 에서 고른다(이 파일은 업체를 모른다).
   - voice_clone: 녹음 파일 → 모델에서 고른 엔진(voice_engine, 없으면 VOICE_PROVIDER)에 등록. voice_provider_id 에 "업체:id" 로 남긴다.
   - voice_design: 설명대로 후보 목소리 n 개(Qwen3-TTS VoiceDesign). 보관은 콘솔이 한다(actions/voices.ts).
   - narrate: 대본을 모델 목소리로 읽은 mp3. 녹음 목소리가 아직 등록 전이면 그 자리에서 등록한다.
     보관함 목소리(library)는 녹음 목소리와 같다 — 모델 폴더의 샘플 + 샘플에서 읽은 문장을 Qwen3-TTS 가 따라 읽는다. */

async function loadModel(id: string) {
  const m = await must(db.from('virtual_models').select('*').eq('id', id).maybeSingle(), '모델 조회')
  if (!m) throw new Error('가상 모델을 찾지 못했어요. 삭제됐을 수 있어요.')
  return m as VirtualModel
}

async function register(model: VirtualModel) {
  if (!model.voice_sample_path) throw new Error('녹음 파일이 없어요. 모델 화면에서 목소리 파일을 다시 올려 주세요.')
  if (!model.voice_consent) throw new Error('녹음한 사람의 광고 사용 동의가 확인되지 않았어요.')
  let stored: string
  if (env.aiMode === 'live') {
    const provider = cloneProvider(model.voice_engine)
    const f = await download(model.voice_sample_path)
    const id = await provider.clone(`${model.name} (${model.id.slice(0, 8)})`, { data: f.data, mime: f.mime, filename: model.voice_sample_path.split('/').pop()! })
    stored = packVoiceId(provider.name, id)
    // 예전에 등록한 목소리는 그 업체에서 지운다(등록 개수 한도). 업체가 빠졌으면 건너뛴다
    if (model.voice_provider_id && model.voice_provider_id !== stored) {
      const old = unpackVoiceId(model.voice_provider_id)
      if (old.provider !== MOCK) {
        try {
          await providerOf(old.provider).remove?.(old.id)
        } catch {
          /* 지난 목소리 정리는 실패해도 된다 */
        }
      }
    }
  } else {
    stored = packVoiceId(MOCK, model.id.slice(0, 8))
  }
  await must(db.from('virtual_models').update({ voice_provider_id: stored, voice_error: null }).eq('id', model.id), '목소리 저장')
  return stored
}

export async function voiceCloneJob(p: JobPayloads['voice_clone']): Promise<JobResults['voice_clone']> {
  const model = await loadModel(p.modelId)
  if (model.voice_source !== 'upload' && model.voice_source !== 'library') throw new Error('이 모델은 녹음 목소리를 쓰지 않아요.')
  return { voiceId: await register(model), mock: env.aiMode === 'mock' }
}

/** 대본 → mp3. mock 이면 삐 소리(글자 수만큼 길이) */
export async function narrate(modelId: string, text: string) {
  const model = await loadModel(modelId)
  if (env.aiMode === 'mock') return mockSpeech(text)
  if (model.voice_source === 'upload' || model.voice_source === 'library') {
    let stored = model.voice_provider_id
    // 등록 전 · 모의 등록 · 엔진을 바꾼 뒤면 지금 고른 엔진으로 다시 등록
    const want = cloneProvider(model.voice_engine).name
    if (!stored || unpackVoiceId(stored).provider === MOCK || unpackVoiceId(stored).provider !== want) stored = await register(model)
    const { provider: name, id } = unpackVoiceId(stored)
    const provider = providerOf(name)
    let ref: VoiceRef | undefined
    if (provider.needsReference) {
      const f = await download(model.voice_sample_path!)
      ref = { sample: { data: f.data, mime: f.mime, filename: model.voice_sample_path!.split('/').pop()! }, transcript: model.voice_sample_text }
    }
    return provider.speak(id, text, ref)
  }
  if (!model.voice) throw new Error(`가상 모델 ${model.name}에 목소리가 정해지지 않았어요. 모델 화면에서 목소리를 골라 주세요.`)
  const provider = presetProvider()
  return provider.speak(await provider.preset(model.voice), text)
}

/** 후보는 한 번에 하나씩 만든다(음성 서버가 GPU 하나로 한 번에 하나만 돈다). 하나라도 실패하면 작업 전체를 다시 한다 */
export async function voiceDesignJob(p: JobPayloads['voice_design']): Promise<JobResults['voice_design']> {
  const n = Math.min(Math.max(p.n || 4, 1), 6)
  const extra = await toEnglish(p.input.extra ?? '')
  const instruct = voiceInstruct(p.input, extra.text)
  const paths: string[] = []
  for (let i = 0; i < n; i++) {
    const mp3 = env.aiMode === 'live' ? await designVoice(p.text, instruct) : await mockSpeech(p.text)
    paths.push(await upload(voiceCandidatePath(), mp3, 'audio/mpeg'))
  }
  return { paths, instruct, mock: env.aiMode === 'mock' }
}
