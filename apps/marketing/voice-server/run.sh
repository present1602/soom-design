#!/usr/bin/env bash
# 음성 서버 실행. 설정은 같은 폴더의 .env.local (없으면 기본값: 장치 자동 · 1.7B Base · 토큰 없음 · 127.0.0.1:8000)
# 처음 한 번: python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

if [ ! -x .venv/bin/uvicorn ]; then
  echo "[voice] .venv 가 없어요. 먼저: cd apps/marketing/voice-server && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

# Apple Silicon 에서 mps 가 못 하는 연산은 CPU 로 넘긴다
export PYTORCH_ENABLE_MPS_FALLBACK="${PYTORCH_ENABLE_MPS_FALLBACK:-1}"
exec .venv/bin/uvicorn server:app --host "${VOICE_HOST:-127.0.0.1}" --port "${VOICE_PORT:-8000}"
