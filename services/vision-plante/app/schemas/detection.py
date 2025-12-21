from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class DetectionClass(str, Enum):
    HEALTHY = "healthy"
    STRESSED = "stressed"
    ST = "st"


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Detection(BaseModel):
    class_name: str
    confidence: float
    bounding_box: BoundingBox


class DetectionRequest(BaseModel):
    field_id: Optional[str] = None
    tile_id: Optional[str] = None


class DetectionResponse(BaseModel):
    detection_id: str
    field_id: Optional[str] = None
    tile_id: Optional[str] = None
    timestamp: datetime
    detections: List[Detection]
    total_detections: int
    health_score: float = Field(ge=0, le=100)
    stressed_count: int
    healthy_count: int
    image_url: str


class HealthStatus(BaseModel):
    status: str
    model_loaded: bool
    kafka_connected: bool
