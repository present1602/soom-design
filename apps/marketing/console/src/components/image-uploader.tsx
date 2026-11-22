'use client'

import { useRef, useState } from 'react'
import { BUCKET, IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@marketing/core/storage'
import { createUploadTargetsAction } from '@/actions/admin'
import { browserClient } from '@/lib/supabase-browser'
import { ErrorLine, cx } from './ui'

export type Uploaded = { path: string; url: string }

/* 이미지 여러 장 올리기. 고르면 바로 저장소에 올리고 경로를 돌려준다.
   max 를 넘기면 앞에서부터 받을 수 있는 만큼만 받고 문구로 알린다. */
export function ImageUploader({
  value,
  onChange,
  max,
  label,
  square = true,
  disabled,
}: {
  value: Uploaded[]
  onChange: (v: Uploaded[]) => void
  max: number
  label: string
  square?: boolean
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const room = max - value.length

  const pick = async (list: FileList | null) => {
    setError(null)
    const all = [...(list ?? [])]
    const bad = all.find((f) => !(IMAGE_TYPES as readonly string[]).includes(f.type) || f.size > MAX_UPLOAD_BYTES)
    if (bad) {
      setError(`${bad.name}: JPG · PNG · WEBP 이미지, ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 이하만 올릴 수 있어요.`)
      return
    }
    const files = all.slice(0, room)
    if (all.length > room) setError(`최대 ${max}장까지예요. 앞의 ${files.length}장만 올렸어요.`)
    if (!files.length) return
    setBusy(files.length)
    try {
      const r = await createUploadTargetsAction(files.map((f) => ({ mime: f.type, size: f.size })))
      if (!r.ok) throw new Error(r.error)
      const done: Uploaded[] = []
      for (const [i, f] of files.entries()) {
        const t = r.targets[i]
        const up = await browserClient().storage.from(BUCKET).uploadToSignedUrl(t.path, t.token, f, { contentType: f.type })
        if (up.error) throw new Error(`${f.name}을(를) 올리지 못했어요: ${up.error.message}`)
        done.push({ path: t.path, url: URL.createObjectURL(f) })
      }
      onChange([...value, ...done])
    } catch (e) {
      setError(e instanceof Error ? e.message : '올리지 못했어요')
    } finally {
      setBusy(0)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="grid gap-2">
      {room > 0 && (
        <label
          className={cx('grid cursor-pointer place-items-center gap-1 rounded-xl border-[1.5px] border-dashed border-line-2 bg-card p-3.5 text-center text-[13px] text-ink-soft hover:border-accent hover:text-accent', (disabled || busy > 0) && 'pointer-events-none opacity-60')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files)
          }}
        >
          <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} multiple={max > 1} className="hidden" onChange={(e) => pick(e.target.files)} disabled={disabled || busy > 0} />
          {busy ? `${busy}장 올리는 중…` : label}
        </label>
      )}
      <ErrorLine error={error} />
      {value.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-2">
          {value.map((v, i) => (
            <div key={v.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.url} alt="" className={cx('w-full rounded-lg border border-line object-cover', square ? 'aspect-square' : 'aspect-[9/16]')} />
              <button
                type="button"
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/55 text-[11px] text-white"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={`${i + 1}번째 이미지 빼기`}
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
