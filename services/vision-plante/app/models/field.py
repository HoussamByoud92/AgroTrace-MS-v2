from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
from app.db.base import Base

class Field(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True) # ID from auth-service
    name = Column(String, nullable=True)
    area_hectares = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Polygon geometry (using SRID 4326 for lat/lon)
    boundary = Column(Geometry('POLYGON', srid=4326))

    analyzed_images = relationship("AnalyzedImage", back_populates="field")
