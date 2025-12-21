from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class Coordinate(BaseModel):
    lat: float
    lng: float

class FieldCreate(BaseModel):
    name: str = "My Field"
    coordinates: List[Coordinate]
    area_hectares: Optional[float] = None
    user_id: int

class FieldResponse(FieldCreate):
    id: int
    class Config:
        from_attributes = True

class DetectionResult(BaseModel):
    class_name: str
    confidence: float
    bbox: Dict[str, float]

class AnalysisResponse(BaseModel):
    image_url: str
    annotated_image_url: str
    detections: List[DetectionResult]
