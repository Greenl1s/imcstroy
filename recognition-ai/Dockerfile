FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    REMBG_HOME=/models/rembg \
    SEGMENTATION_MODEL=silueta \
    EMBEDDING_MODEL=facebook/dinov2-small

WORKDIR /app

RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
      torch==2.5.1 torchvision==0.20.1 \
 && pip install --no-cache-dir \
      fastapi==0.115.8 uvicorn==0.34.0 pillow==11.1.0 numpy==1.26.4 \
      transformers==4.48.3 safetensors==0.5.2 "rembg[cpu]==2.0.67"

COPY preload_models.py ./
RUN mkdir -p /models/huggingface /models/rembg \
 && python preload_models.py

COPY app.py ./

RUN useradd --create-home --uid 10001 app \
 && chown -R app:app /app /models
USER app

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
