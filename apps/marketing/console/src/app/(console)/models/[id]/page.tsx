import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ModelImage, VirtualModel } from '@marketing/core/types'
import { Card, CardHead, PageHead, Pill } from '@/components/ui'
import { signMany } from '@/lib/files'
import { canSeeStore, requireStaff } from '@/lib/staff'
import { db } from '@/lib/supabase'
import { listLibraryVoices } from '@/lib/voices'
import { voiceGenderOf } from '@marketing/core/voice'
import { ModelImages, type ShotEdit } from './model-images'

type EditRow = {
  status: string
  error: string | null
  payload: { imageId: string; mode: 'edit' | 'fresh'; instruction?: string; basePath?: string }
  result: { paths?: string[]; resolved?: string } | null
}
import { PersonaCard } from './persona-card'
import { VoiceCard, type VoiceState } from './voice-card'
import { StatusCard } from './status-card'
import { modelStatus } from '@marketing/core/types'

export default async function ModelPage({ params }: PageProps<'/models/[id]'>) {
  const staff = await requireStaff()
  const { id } = await params
  const { data } = await db().from('virtual_models').select('*').eq('id', id).maybeSingle()
  const m = data as VirtualModel | null
  if (!m) notFound()
  const [imgs, used, sheetJob, voiceJob, lib] = await Promise.all([
    db().from('model_images').select('*').eq('model_id', id).order('sort'),
    db().from('contents').select('store_id, stores(id, name, clients(name))').eq('model_id', id).limit(2000),
    db().from('jobs').select('status, error, result, attempts').eq('kind', 'model_sheet').eq('payload->>modelId', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db().from('jobs').select('status').eq('kind', 'voice_clone').eq('payload->>modelId', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    listLibraryVoices(),
  ])
  const sj = sheetJob.data as { status: string; error: string | null; result: { failed?: { label: string; error: string }[] } | null; attempts: number } | null
  const sheet = {
    running: sj?.status === 'queued' || sj?.status === 'running',
    error: sj?.status === 'failed' ? sj.error : null,
    failed: sj?.status === 'done' ? (sj.result?.failed ?? []) : [],
  }
  const images = (imgs.data ?? []) as ModelImage[]

  // 이미지마다 가장 최근 수정 작업 — 아직 고르지 않은 것만 (actions/models.ts requestShotEditAction)
  const { data: editRows } = await db().from('jobs').select('status, error, payload, result').eq('kind', 'model_shot_edit').eq('payload->>modelId', id).order('created_at', { ascending: false }).limit(200)
  const latest = new Map<string, EditRow>()
  for (const r of (editRows ?? []) as EditRow[]) if (!latest.has(r.payload.imageId)) latest.set(r.payload.imageId, r)
  const openEdits = [...latest.values()].filter((r) => !r.result?.resolved)

  const signed = await signMany([m.cover_path, m.voice_sample_path ?? null, ...images.map((i) => i.path), ...openEdits.flatMap((r) => [...(r.result?.paths ?? []), r.payload.basePath])])
  const edits: Record<string, ShotEdit> = {}
  for (const r of openEdits) {
    edits[r.payload.imageId] = {
      status: r.status as ShotEdit['status'],
      error: r.status === 'failed' ? r.error : null,
      mode: r.payload.mode,
      instruction: r.payload.instruction ?? '',
      base: r.payload.basePath ? (signed.get(r.payload.basePath) ?? null) : null,
      drafts: (r.result?.paths ?? []).map((p) => ({ path: p, url: signed.get(p) ?? null })),
    }
  }
  const vj = (voiceJob.data as { status: string } | null)?.status
  const upload = m.voice_source === 'upload'
  const library = m.voice_source === 'library'
  const voice: VoiceState = {
    source: upload ? 'upload' : library ? 'library' : 'preset',
    preset: m.voice,
    libraryId: library ? (m.voice_library_id ?? null) : null,
    sampleUrl: upload || library ? (signed.get(m.voice_sample_path ?? '') ?? null) : null,
    samplePath: upload ? (m.voice_sample_path ?? null) : null,
    engine: m.voice_engine === 'elevenlabs' ? 'elevenlabs' : m.voice_engine === 'qwen' ? 'qwen' : m.voice_provider_id && !m.voice_provider_id.startsWith('qwen:') && !/^mock[-:]/.test(m.voice_provider_id) ? 'elevenlabs' : 'qwen',
    sampleText: m.voice_sample_text ?? '',
    // 작업도 없고 결과도 없으면(작업이 지워졌거나 못 넣었으면) 멈춘 채 "등록 중"으로 두지 않고 다시 등록하게 한다
    status: !upload ? 'none' : vj === 'queued' || vj === 'running' ? 'pending' : m.voice_error ? 'failed' : m.voice_provider_id ? 'ready' : vj ? 'pending' : 'failed',
    error: m.voice_error ?? (upload && !m.voice_provider_id && !vj ? '목소리 등록 작업을 찾지 못했어요. "다시 등록"을 눌러 주세요.' : null),
    mock: !!m.voice_provider_id && /^mock[-:]/.test(m.voice_provider_id),
  }
  const stores = new Map<string, string>()
  for (const r of (used.data ?? []) as unknown as { store_id: string; stores: { id: string; name: string; clients: { name: string } | null } | null }[]) {
    if (r.stores && canSeeStore(staff, r.store_id)) stores.set(r.store_id, `${r.stores.clients?.name ?? ''} ${r.stores.name}`)
  }
  return (
    <>
      <PageHead title={m.name} sub={`${m.gender} · ${m.age_band} · ${m.mood}`} crumb={<><Link href="/models">가상 모델</Link> / {m.name}</>} />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHead title="기준 이미지" sub="영상마다 얼굴이 달라지지 않게, 장면을 만들 때 대표 · 얼굴 정면 · 전신 정면을 함께 AI에 넘겨요" />
          <ModelImages
            modelId={id}
            cover={signed.get(m.cover_path ?? '') ?? null}
            images={images.map((i) => ({ id: i.id, label: i.label, url: signed.get(i.path) ?? null }))}
            sheet={sheet}
            edits={edits}
          />
        </Card>
        <div className="grid gap-4">
          <StatusCard modelId={id} status={modelStatus(m)} canChange={staff.role === 'super'} used={(used.data ?? []).length} />
          <Card>
            <h2 className="mb-3 text-[16px] font-bold">정보</h2>
            <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-[13.5px] [&>dt]:text-ink-soft">
              <dt>만든 방식</dt>
              <dd>{m.source === 'ai' ? 'AI 생성' : '참고 사진'} {m.source === 'photo' && m.consent && <Pill tone="ok">초상권 동의 확인</Pill>}</dd>
              <dt>사용</dt>
              <dd>{(used.data ?? []).length}편</dd>
            </dl>
          </Card>
          <PersonaCard modelId={id} persona={m.persona ?? null} />
          <VoiceCard modelId={id} v={voice} voices={lib.voices} libraryMissing={lib.missing} gender={voiceGenderOf(m.gender)} />
          <Card>
            <CardHead title="사용 중인 매장" />
            <div className="flex flex-wrap gap-1.5">
              {[...stores].map(([sid, label]) => (
                <Link key={sid} href={`/stores/${sid}`} className="rounded-md border border-line px-2 text-[12.5px] text-ink-soft hover:border-accent hover:text-accent">{label}</Link>
              ))}
              {!stores.size && <span className="text-[12.5px] text-ink-soft">아직 없어요</span>}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
