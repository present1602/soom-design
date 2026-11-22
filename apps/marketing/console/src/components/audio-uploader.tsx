'use client'

import { useRef, useState } from 'react'
import { AUDIO_TYPES, BUCKET, MAX_UPLOAD_BYTES } from '@marketing/core/storage'
import { createUploadTargetsAction } from '@/actions/admin'
import { browserClient } from '@/lib/supabase-browser'
import { ErrorLine, cx } from './ui'
import type { Uploaded } from './image-uploader'

/* 녹음 파일 한 개 올리기. 고르면 바로 저장소에 올리고, 올린 파일을 그 자리에서 들어 볼 수 있다. */
export function AudioUploader({ value, onChange, label, disabled }: { value: Uploaded | null; onChange: (v: Uploaded | null) => void; label: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (f: File | undefined) => {
    setError(null)
    if (!f) return
    // 일부 브라우저는 m4a 의 type 을 비워 보낸다 → 확장자로 보정
    const mime = f.type || ({ m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' } as Record<string, string>)[f.name.split('.').pop()?.toLowerCase() ?? ''] || ''
    if (!(AUDIO_TYPES as readonly string[]).includes(mime) || f.size > MAX_UPLOAD_BYTES) {
      setError(`${f.name}: MP3 · WAV · M4A 녹음 파일, ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 이하만 올릴 수 있어요.`)
      return
    }
    setBusy(true)
    try {
      const r = await createUploadTargetsAction([{ mime, size: f.size }], 'audio')
      if (!r.ok) throw new Error(r.error)
      const t = r.targets[0]
      const up = await browserClient().storage.from(BUCKET).uploadToSignedUrl(t.path, t.token, f, { contentType: mime })
      if (up.error) throw new Error(`${f.name}을(를) 올리지 못했어요: ${up.error.message}`)
      onChange({ path: t.path, url: URL.createObjectURL(f) })
    } catch (e) {
      setError(e instanceof Error ? e.message : '올리지 못했어요')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="grid gap-2">
      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <audio src={value.url} controls className="h-10 max-w-full" />
          <button type="button" className="text-[12.5px] text-ink-soft underline" onClick={() => onChange(null)} disabled={disabled}>
            다른 파일로 바꾸기
          </button>
        </div>
      ) : (
        <label className={cx('grid cursor-pointer place-items-center gap-1 rounded-xl border-[1.5px] border-dashed border-line-2 bg-card p-3.5 text-center text-[13px] text-ink-soft hover:border-accent hover:text-accent', (disabled || busy) && 'pointer-events-none opacity-60')}>
          <input ref={input} type="file" accept={[...AUDIO_TYPES, '.m4a', '.mp3', '.wav'].join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0])} disabled={disabled || busy} />
          {busy ? '올리는 중…' : label}
        </label>
      )}
      <ErrorLine error={error} />
    </div>
  )
}
