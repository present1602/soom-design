# GPU 서버용. 모델 가중치는 처음 켤 때 Hugging Face 에서 받는다(캐시 볼륨을 붙이면 다시 받지 않는다).
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
ENV HF_HOME=/cache
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
