import base64
import io
import os
import threading
from contextlib import asynccontextmanager

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageChops, ImageFilter, ImageOps
from pydantic import BaseModel
from rembg import new_session, remove
from transformers import AutoImageProcessor, AutoModel


MAX_IMAGE_BYTES = 6 * 1024 * 1024
SEGMENTATION_MODEL = os.getenv("SEGMENTATION_MODEL", "silueta")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "facebook/dinov2-small")
MODEL_VERSION = f"{SEGMENTATION_MODEL}+{EMBEDDING_MODEL}"
DEVICE = "cpu"

segmenter = None
processor = None
embedder = None
inference_lock = threading.Lock()


class ImageRequest(BaseModel):
    data_url: str


def decode_data_url(data_url: str) -> Image.Image:
    try:
        header, encoded = data_url.split(",", 1)
        if not header.startswith("data:image/") or ";base64" not in header:
            raise ValueError
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        raise HTTPException(400, "Нужно фото JPEG, PNG или WebP")
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Фото должно быть не больше 6 МБ")
    try:
        image = Image.open(io.BytesIO(raw))
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        return image
    except Exception:
        raise HTTPException(400, "Файл не удалось прочитать как фотографию")


def cut_out_subject(image: Image.Image):
    mask = remove(image, session=segmenter, only_mask=True).convert("L")
    # Убираем одиночный шум, но сохраняем тонкие детали прибора.
    mask = mask.filter(ImageFilter.MedianFilter(3))
    binary = mask.point(lambda value: 255 if value >= 48 else 0)
    bbox = binary.getbbox()
    foreground_ratio = float(np.asarray(binary, dtype=np.uint8).mean() / 255.0)

    if bbox is None or foreground_ratio < 0.025:
        raise HTTPException(422, "В кадре не найден отдельный предмет")
    if foreground_ratio > 0.90:
        raise HTTPException(422, "Предмет занимает весь кадр: отойдите немного дальше")

    width, height = image.size
    left, top, right, bottom = bbox
    subject_width, subject_height = right - left, bottom - top
    if subject_width < width * 0.12 or subject_height < height * 0.12:
        raise HTTPException(422, "Предмет слишком маленький: подойдите ближе")

    padding = max(12, int(max(subject_width, subject_height) * 0.08))
    crop_box = (
        max(0, left - padding), max(0, top - padding),
        min(width, right + padding), min(height, bottom + padding),
    )
    cropped_image = image.crop(crop_box)
    cropped_mask = mask.crop(crop_box)
    rgba = cropped_image.convert("RGBA")
    rgba.putalpha(cropped_mask)

    metrics = {
        "foreground_ratio": round(foreground_ratio, 4),
        "subject_width_ratio": round(subject_width / width, 4),
        "subject_height_ratio": round(subject_height / height, 4),
        "source_width": width,
        "source_height": height,
    }
    return rgba, metrics


def composite_for_embedding(subject: Image.Image) -> Image.Image:
    # Квадратное поле не содержит исходный фон. Нейтральный серый меньше
    # влияет на признаки DINO, чем чёрный или прозрачность, превращённая в чёрный.
    side = max(subject.size)
    pad = max(16, int(side * 0.12))
    canvas = Image.new("RGB", (side + pad * 2, side + pad * 2), (238, 240, 243))
    x = (canvas.width - subject.width) // 2
    y = (canvas.height - subject.height) // 2
    canvas.paste(subject.convert("RGB"), (x, y), subject.getchannel("A"))
    return canvas


def make_embedding(image: Image.Image):
    inputs = processor(images=image, return_tensors="pt")
    with torch.inference_mode():
        output = embedder(**{key: value.to(DEVICE) for key, value in inputs.items()})
        vector = output.last_hidden_state[:, 0, :].squeeze(0).cpu().numpy().astype(np.float32)
    norm = float(np.linalg.norm(vector))
    if not np.isfinite(norm) or norm < 1e-8:
        raise HTTPException(500, "Модель не смогла получить признаки предмета")
    return (vector / norm).round(7).tolist()


def encode_cutout(subject: Image.Image) -> str:
    output = io.BytesIO()
    subject.save(output, format="WEBP", lossless=True, method=4)
    return "data:image/webp;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def analyze(data_url: str):
    image = decode_data_url(data_url)
    with inference_lock:
        subject, metrics = cut_out_subject(image)
        embedding = make_embedding(composite_for_embedding(subject))
    return {
        "data_url": encode_cutout(subject),
        "embedding": embedding,
        "embedding_size": len(embedding),
        "model_version": MODEL_VERSION,
        "segmentation": metrics,
    }


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global segmenter, processor, embedder
    torch.set_num_threads(max(1, int(os.getenv("OMP_NUM_THREADS", "2"))))
    segmenter = new_session(SEGMENTATION_MODEL)
    processor = AutoImageProcessor.from_pretrained(EMBEDDING_MODEL, local_files_only=True)
    embedder = AutoModel.from_pretrained(EMBEDDING_MODEL, local_files_only=True).to(DEVICE).eval()
    yield


app = FastAPI(title="IMCStroy recognition AI", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": bool(segmenter and embedder), "model_version": MODEL_VERSION}


@app.post("/analyze")
def analyze_image(request: ImageRequest):
    return analyze(request.data_url)
