/* 목소리 업체 공통 형식.
   업체 하나 = 이 파일 형식을 따르는 파일 하나 + voice/index.ts 의 PROVIDERS 에 한 줄.
   빼고 싶으면 그 한 줄과 파일을 지우면 된다(그 업체로 등록된 모델은 화면에서 "다시 등록"하라고 안내된다). */

export type VoiceSample = { data: Uint8Array; mime: string; filename: string }

/** 읽을 때마다 녹음 원본이 필요한 업체(등록 없이 바로 따라 읽는 Qwen3-TTS 등)에 넘기는 것 */
export type VoiceRef = { sample: VoiceSample; transcript?: string | null }

export type VoiceProvider = {
  /** 저장되는 목소리 id 앞에 붙는 이름 (예: "elevenlabs:abc123") */
  name: string
  /** 화면·에러에 보이는 이름 */
  label: string
  /** true 면 speak 할 때마다 녹음 원본(ref)을 넘겨야 한다 */
  needsReference?: boolean
  /** 녹음 파일로 목소리 등록 → 업체 쪽 id */
  clone(name: string, sample: VoiceSample): Promise<string>
  /** 등록한 목소리 지우기 (등록 개수 한도가 있는 업체용). 실패해도 진행한다 */
  remove?(id: string): Promise<void>
  /** "맑은 여성" 같은 기본 목소리 이름 → 업체 쪽 id */
  preset(label: string): Promise<string>
  /** 대본 → mp3. needsReference 업체는 ref 가 꼭 있어야 한다 */
  speak(id: string, text: string, ref?: VoiceRef): Promise<Uint8Array>
}
