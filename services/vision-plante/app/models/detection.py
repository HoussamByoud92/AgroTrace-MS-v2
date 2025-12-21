from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("analyzed_images.id"))
    
    class_name = Column(String)
    confidence = Column(Float)
    
    # Bounding box coordinates (normalized or pixel)
    # Stored as JSON: {x1, y1, x2, y2}
    bbox = Column(JSON)
    
    image = relationship("AnalyzedImage", back_populates="detections")
