import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/* ffmpeg 로 하는 일
   - 결과 영상을 플랫폼 공통 규격(1080×1920, H.264, AAC)으로 맞춘다
   - 썸네일 후보 프레임을 뽑는다
   - AI_MODE=mock 일 때 가짜 이미지·영상을 만든다(입력 이미지를 겹쳐서 진짜 같은 흐름을 본다) */

function run(bin: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => reject(new Error(`${bin} 를 실행하지 못했어요: ${e.message}`)))
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${bin} 실패 (${code}): ${err.slice(-600)}`))))
  })
}

export async function withTmp<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mk-worker-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function put(dir: string, name: string, data: Uint8Array) {
  const p = path.join(dir, name)
  await writeFile(p, data)
  return p
}

const ff = (args: string[]) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

/** 영상 길이(초) */
export async function durationOf(file: string) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  return Number(out.trim()) || 0
}

async function hasAudio(file: string) {
  const out = await run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file])
  return out.trim().length > 0
}

/** 9:16 1080×1920 H.264 + AAC. 소리가 없으면 무음 트랙을 넣는다(인스타·카카오가 무음 트랙 없는 영상을 거절하는 경우가 있다). */
export async function normalizeVideo(input: Uint8Array) {
  return withTmp(async (dir) => {
    const src = await put(dir, 'in.mp4', input)
    const out = path.join(dir, 'out.mp4')
    const vf = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p'
    const audio = await hasAudio(src)
    const args = audio
      ? ['-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]
      : ['-i', src, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', vf, '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]
    await ff(args)
    return new Uint8Array(await readFile(out))
  })
}

/** 영상의 마지막 장면 (다음 구간을 이어 만들 첫 장면) */
export async function lastFrame(video: Uint8Array) {
  return withTmp(async (dir) => {
    const src = await put(dir, 'v.mp4', video)
    const out = path.join(dir, 'last.png')
    await ff(['-sseof', '-0.1', '-i', src, '-frames:v', '1', '-update', '1', out])
    return new Uint8Array(await readFile(out))
  })
}

/** normalizeVideo 를 거친(규격이 같은) 영상들을 순서대로 이어 붙인다 */
export async function concatVideos(videos: Uint8Array[]) {
  if (videos.length === 1) return videos[0]
  return withTmp(async (dir) => {
    const list: string[] = []
    for (const [i, v] of videos.entries()) list.push(`file '${await put(dir, `s${i}.mp4`, v)}'`)
    const txt = path.join(dir, 'list.txt')
    await writeFile(txt, list.join('\n'))
    const out = path.join(dir, 'out.mp4')
    await ff(['-f', 'concat', '-safe', '0', '-i', txt, '-c', 'copy', '-movflags', '+faststart', out])
    return new Uint8Array(await readFile(out))
  })
}

/** 썸네일 후보: 영상의 10% · 35% · 60% · 85% 지점 */
export async function extractFrames(video: Uint8Array, count = 4) {
  return withTmp(async (dir) => {
    const src = await put(dir, 'v.mp4', video)
    const len = await durationOf(src)
    const frames: Uint8Array[] = []
    for (let i = 0; i < count; i++) {
      const t = (len * (0.1 + (0.75 * i) / Math.max(1, count - 1))).toFixed(2)
      const out = path.join(dir, `f${i}.jpg`)
      await ff(['-ss', t, '-i', src, '-frames:v', '1', '-q:v', '3', out])
      frames.push(new Uint8Array(await readFile(out)))
    }
    return frames
  })
}

/** 이미지를 비율에 맞게 가운데를 잘라 낸다 (배너 4:5 · 9:16) */
export async function cropTo(input: Uint8Array, ratio: '1:1' | '4:5' | '9:16') {
  if (ratio === '1:1') return input
  const [w, h] = ratio === '4:5' ? [4, 5] : [9, 16]
  return withTmp(async (dir) => {
    const src = await put(dir, 'in.png', input)
    const out = path.join(dir, 'out.png')
    await ff(['-i', src, '-vf', `crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})'`, out])
    return new Uint8Array(await readFile(out))
  })
}

/* ───────── 모의 생성 (AI_MODE=mock) ───────── */

const PALETTE = ['0xD8C3A5', '0xA7C4BC', '0xC9B6E4', '0xF2C6A0', '0xB5CDE8', '0xE8B4B8']

/** 모델 이미지 위에 제품 이미지를 겹친 장면. 진짜 합성처럼 입력이 결과에 보인다. */
export async function mockComposite(opts: { model?: Uint8Array; products: Uint8Array[]; w: number; h: number; seed: number }) {
  return withTmp(async (dir) => {
    const inputs: string[] = ['-f', 'lavfi', '-i', `color=c=${PALETTE[opts.seed % PALETTE.length]}:s=${opts.w}x${opts.h}`]
    const chains: string[] = []
    let last = '0:v'
    let idx = 1
    if (opts.model) {
      inputs.push('-i', await put(dir, 'model.img', opts.model))
      chains.push(`[${idx}:v]scale=${Math.round(opts.w * 0.86)}:${Math.round(opts.h * 0.86)}:force_original_aspect_ratio=decrease[m]`, `[${last}][m]overlay=(W-w)/2+${(opts.seed % 3) * 20 - 20}:(H-h)/2[b${idx}]`)
      last = `b${idx}`
      idx++
    }
    for (const [i, p] of opts.products.slice(0, 3).entries()) {
      inputs.push('-i', await put(dir, `p${i}.img`, p))
      const size = Math.round(opts.w * 0.26)
      chains.push(`[${idx}:v]scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size + 12}:${size + 12}:6:6:white[p${i}]`, `[${last}][p${i}]overlay=W-w-${40 + i * 18}:H-h-${80 + i * (size + 30)}[b${idx}]`)
      last = `b${idx}`
      idx++
    }
    const out = path.join(dir, 'out.png')
    const args = [...inputs]
    if (chains.length) args.push('-filter_complex', chains.join(';'), '-map', `[${last}]`)
    args.push('-frames:v', '1', out)
    await ff(args)
    return new Uint8Array(await readFile(out))
  })
}

/** 정지 이미지를 천천히 확대하는 영상 */
export async function mockVideo(frame: Uint8Array, seconds: number) {
  return withTmp(async (dir) => {
    const src = await put(dir, 'f.png', frame)
    const out = path.join(dir, 'out.mp4')
    const frames = seconds * 30
    await ff([
      '-loop', '1', '-i', src, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-vf', `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p`,
      '-t', String(seconds), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out,
    ])
    return new Uint8Array(await readFile(out))
  })
}

/** 가상 모델 후보 자리 이미지 (색만 다른 세로 그라데이션) */
export async function mockPortrait(seed: number) {
  return withTmp(async (dir) => {
    const out = path.join(dir, 'p.png')
    const a = PALETTE[seed % PALETTE.length]
    const b = PALETTE[(seed + 2) % PALETTE.length]
    await ff(['-f', 'lavfi', '-i', `gradients=s=768x1024:c0=${a}:c1=${b}:x0=0:y0=0:x1=768:y1=1024:d=1`, '-frames:v', '1', out])
    return new Uint8Array(await readFile(out))
  })
}

/* ───────── 내레이션 ───────── */

/** 영상에 내레이션을 입힌다. 0.3초 뒤에 시작하고, 영상보다 길면 영상 길이에서 자르고(끝 0.3초 페이드), 짧으면 남은 구간은 조용하다. */
export async function mixNarration(video: Uint8Array, speech: Uint8Array) {
  return withTmp(async (dir) => {
    const v = await put(dir, 'v.mp4', video)
    const a = await put(dir, 'a.mp3', speech)
    const out = path.join(dir, 'out.mp4')
    const len = await durationOf(v)
    const fadeAt = Math.max(0, len - 0.3).toFixed(2)
    await ff([
      '-i', v, '-i', a,
      '-filter_complex', `[1:a]adelay=300|300,apad,atrim=0:${len.toFixed(2)},afade=t=out:st=${fadeAt}:d=0.3,aresample=48000[a]`,
      '-map', '0:v:0', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', out,
    ])
    return new Uint8Array(await readFile(out))
  })
}

/** 소리 길이(초) */
export async function audioDuration(data: Uint8Array, ext = 'mp3') {
  return withTmp(async (dir) => durationOf(await put(dir, `a.${ext}`, data)))
}

/** 모의 생성용 "말소리" — 글자 수만큼 짧은 삐 소리를 이어 붙인 mp3 (비용 0, 흐름 확인용) */
export async function mockSpeech(text: string) {
  return withTmp(async (dir) => {
    const out = path.join(dir, 'a.mp3')
    const seconds = Math.min(12, Math.max(1.5, text.length / 6.5))
    // 440Hz 를 초당 4번 끊어 말하는 것처럼 들리게
    await ff(['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds.toFixed(2)}`, '-af', "volume='0.25*gt(sin(2*PI*4*t),0)':eval=frame", '-c:a', 'libmp3lame', '-b:a', '96k', out])
    return new Uint8Array(await readFile(out))
  })
}
