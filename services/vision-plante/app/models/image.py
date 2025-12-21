from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
from app.db.base import Base

class AnalyzedImage(Base):
    __tablename__ = "analyzed_images"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=True) # Optional link to a field
    filename = Column(String)
    
    # MinIO paths
    raw_image_path = Column(String)
    annotated_image_path = Column(String)
    
    # Geolocation of the image itself (if available, e.g. center point)
    location = Column(Geometry('POINT', srid=4326), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    field = relationship("Field", back_populates="analyzed_images")
    detections = relationship("Detection", back_populates="image")
