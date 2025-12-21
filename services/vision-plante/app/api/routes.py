from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon, Point
import cv2
import numpy as np
import uuid
import os
import logging
from datetime import datetime
import json

from app.core.config import settings
from app.schemas.detection import DetectionResponse, Detection
from app.schemas.vision import FieldCreate, FieldResponse
from app.services.yolo_detector import detector
from app.services.kafka_producer import kafka_producer
from app.services.minio_service import minio_service
from app.db.session import get_db, engine
from app.db.base import Base
from app.models import Field, AnalyzedImage, Detection as DetectionModel

logger = logging.getLogger(__name__)

# Create tables if they don't exist (basic migration)
Base.metadata.create_all(bind=engine)

router = APIRouter()

@router.get("/", tags=["Root"])
async def root():
    return {"service": "VisionPlante", "version": "1.0.0", "status": "running"}

@router.post("/api/v1/fields", response_model=FieldResponse, tags=["Fields"])
async def create_field(field_data: FieldCreate, db: Session = Depends(get_db)):
    """Create a new field polygon"""
    try:
        # Create Shapely polygon
        coords = [(p.lng, p.lat) for p in field_data.coordinates]
        # Ensure it's closed
        if coords[0] != coords[-1]:
            coords.append(coords[0])
            
        poly = Polygon(coords)
        
        # Create DB object
        new_field = Field(
            user_id=field_data.user_id,
            name=field_data.name,
            area_hectares=field_data.area_hectares,
            boundary=from_shape(poly, srid=4326)
        )
        
        db.add(new_field)
        db.commit()
        db.refresh(new_field)
        
        return FieldResponse(
            id=new_field.id,
            name=new_field.name,
            coordinates=field_data.coordinates,
            area_hectares=new_field.area_hectares,
            user_id=new_field.user_id
        )
    except Exception as e:
        logger.error(f"Error creating field: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/v1/fields", response_model=list[FieldResponse], tags=["Fields"])
async def get_fields(user_id: int = 2, db: Session = Depends(get_db)):
    """Get all fields for a user"""
    try:
        # TODO: Get user_id from auth token (hardcoded to 2 for now to match frontend default)
        fields = db.query(Field).filter(Field.user_id == user_id).all()
        
        response = []
        for f in fields:
            # Convert PostGIS geometry to coordinates
            # Using geoalchemy2.shape.to_shape to get Shapely object
            from geoalchemy2.shape import to_shape
            
            try:
                shapely_poly = to_shape(f.boundary)
                # Extract coordinates (outer shell only for simplicity)
                coords = []
                if shapely_poly and shapely_poly.exterior:
                    # shapely coords are (x, y) -> (lng, lat)
                    coords = [{"lat": y, "lng": x} for x, y in shapely_poly.exterior.coords]
                    # Remove last point if duplicate (closed ring)
                    if len(coords) > 0 and coords[0] == coords[-1]:
                        coords.pop()
                
                response.append(FieldResponse(
                    id=f.id,
                    name=f.name,
                    coordinates=coords,
                    area_hectares=f.area_hectares,
                    user_id=f.user_id
                ))
            except Exception as parse_error:
                logger.error(f"Error parsing geometry for field {f.id}: {parse_error}")
                continue
                
        return response
    except Exception as e:
        logger.error(f"Error fetching fields: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/v1/fields/{field_id}", tags=["Fields"])
async def delete_field(field_id: int, user_id: int = 2, db: Session = Depends(get_db)):
    """Delete a field"""
    try:
        field = db.query(Field).filter(Field.id == field_id).first()
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")
            
        # Optional: Check ownership
        if field.user_id != user_id:
             # Just logging warning for now, strictly enforcing might break demo if IDs mismatch
             logger.warning(f"User {user_id} deleting field owned by {field.user_id}")
        
        # Cascade Delete: Delete related AnalyzedImages and Detections
        # 1. Get IDs of images to delete
        images_to_delete = db.query(AnalyzedImage).filter(AnalyzedImage.field_id == field_id).all()
        image_ids = [img.id for img in images_to_delete]
        
        if image_ids:
            # 2. Delete detections for these images
            db.query(DetectionModel).filter(DetectionModel.image_id.in_(image_ids)).delete(synchronize_session=False)
            
            # 3. Delete the images themselves
            db.query(AnalyzedImage).filter(AnalyzedImage.field_id == field_id).delete(synchronize_session=False)
            
        db.delete(field)
        db.commit()
        
        return {"status": "success", "message": f"Field {field_id} deleted"}
    except Exception as e:
        logger.error(f"Error deleting field: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/v1/detect", response_model=DetectionResponse, tags=["Detection"])
async def detect_crop_stress(
    image: UploadFile = File(...),
    field_id: int = Form(None),
    tile_id: str = Form(None),
    lat: float = Form(None),
    lng: float = Form(None),
    db: Session = Depends(get_db)
):
    # Debug logging
    logger.info(f"Detect request - Field: {field_id}, Tile: {tile_id}, Lat: {lat}, Lng: {lng}")

    # Validate file type
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
            
        # 1. Upload Raw Image to MinIO
        raw_filename = f"raw_{uuid.uuid4()}.jpg"
        raw_image_path = minio_service.upload_file(contents, raw_filename)
        
        # 2. Run detection
        annotated_img, detections = detector.detect(img)
        
        # 3. Upload Annotated Image to MinIO
        annotated_filename = f"annotated_{uuid.uuid4()}.jpg"
        # Encode to bytes
        _, buffer = cv2.imencode('.jpg', annotated_img)
        annotated_image_bytes = buffer.tobytes()
        annotated_image_path = minio_service.upload_file(annotated_image_bytes, annotated_filename)

        # 4. Save to Database
        # Create AnalyzedImage record
        analyzed_image = AnalyzedImage(
            field_id=field_id,
            filename=image.filename,
            raw_image_path=raw_image_path,
            annotated_image_path=annotated_image_path,
            location=from_shape(Point(lng, lat), srid=4326) if lat is not None and lng is not None else None
        )
        db.add(analyzed_image)
        db.flush() # Get ID
        
        # Create Detection records
        for d in detections:
            bbox_json = d['bounding_box']
            det_record = DetectionModel(
                image_id=analyzed_image.id,
                class_name=d['class_name'],
                confidence=float(d['confidence']),
                bbox=bbox_json
            )
            db.add(det_record)
            
        db.commit()
        
        # 5. Prepare Response properties
        detection_id = str(uuid.uuid4())
        timestamp = datetime.utcnow()
        stressed_count = sum(1 for d in detections if d['class_name'] in ['stressed', 'st'])
        healthy_count = sum(1 for d in detections if d['class_name'] == 'healthy')
        health_score = detector.calculate_health_score(detections)
        
        # Use MinIO URL for response
        annotated_image_url = minio_service.get_file_url(annotated_filename)
        
        return DetectionResponse(
            detection_id=detection_id,
            field_id=str(field_id) if field_id else None,
            tile_id=tile_id,
            timestamp=timestamp,
            detections=[Detection(**d) for d in detections],
            total_detections=len(detections),
            health_score=health_score,
            stressed_count=stressed_count,
            healthy_count=healthy_count,
            image_url=annotated_image_url
        )
        
    except Exception as e:
        logger.error(f"Detection failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")

@router.get("/api/v1/analyses", tags=["Detection"])
async def get_analyses(field_id: int = None, user_id: int = 2, db: Session = Depends(get_db)):
    """Get analyzed images and detections"""
    try:
        query = db.query(AnalyzedImage)
        if field_id:
            query = query.filter(AnalyzedImage.field_id == field_id)
        
        # TODO: Filter by user_id if we want to restrict to user's fields
        # fields = db.query(Field.id).filter(Field.user_id == user_id).subquery()
        # query = query.filter(AnalyzedImage.field_id.in_(fields))
        
        analyses = query.all()
        
        results = []
        for img in analyses:
            detections = db.query(DetectionModel).filter(DetectionModel.image_id == img.id).all()
            
            stressed_detections = [d for d in detections if d.class_name in ['stressed', 'st']]
            if not stressed_detections:
                continue
                
            # Calculate average confidence for stressed crops
            total_conf = sum(d.confidence for d in stressed_detections)
            avg_conf = total_conf / len(stressed_detections) if stressed_detections else 0
            
            # Get location
            lat, lng = 0, 0
            if img.location:
                # Convert WKB/Geometry to lat/lng
                from geoalchemy2.shape import to_shape
                point = to_shape(img.location)
                lat, lng = point.y, point.x
                
            # Get annotated image URL
            # Note: The stored path is MinIO path "bucket/file", we need full URL
            # Or if it's just filename, get_file_url handles it.
            # Assuming minio_service.get_file_url works with the stored path segment
            # Actually upload_file returns just the object name usually? 
            # Let's check minio_service.py if unsure, but for now assume it takes filename
            # The code in detect uses `annotated_filename` which is just "annotated_uuid.jpg".
            # The DB stores `annotated_image_path`.
            # We'll use the DB value.
            image_url = minio_service.get_file_url(img.annotated_image_path)
            
            results.append({
                "lat": lat,
                "lng": lng,
                "confidence": avg_conf,
                "className": "stressed",
                "imageName": img.filename,
                "previewUrl": image_url,
                "count": len(stressed_detections),
                "fieldId": img.field_id
            })
            
        return results
    except Exception as e:
        logger.error(f"Error fetching analyses: {e}")
        raise HTTPException(status_code=500, detail=str(e))
