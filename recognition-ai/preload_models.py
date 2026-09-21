import os

from rembg import new_session
from transformers import AutoImageProcessor, AutoModel


segmentation_model = os.getenv("SEGMENTATION_MODEL", "silueta")
embedding_model = os.getenv("EMBEDDING_MODEL", "facebook/dinov2-small")

print(f"Downloading segmentation model: {segmentation_model}", flush=True)
new_session(segmentation_model)

print(f"Downloading embedding model: {embedding_model}", flush=True)
AutoImageProcessor.from_pretrained(embedding_model)
AutoModel.from_pretrained(embedding_model)
