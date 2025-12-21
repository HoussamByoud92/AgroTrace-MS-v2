import cv2
import numpy as np
from ultralytics import YOLO
from typing import List, Tuple
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class YOLODetector:
    def __init__(self):
        self.model = None
        self.class_names = ['healthy', 'st', 'stressed']
        self.load_model()
    
    def load_model(self):
        """Load YOLO model"""
        try:
            logger.info(f"Loading YOLO model from {settings.MODEL_PATH}")
            self.model = YOLO(settings.MODEL_PATH)
            logger.info("YOLO model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {str(e)}")
            raise
    
    def detect(self, image: np.ndarray) -> Tuple[np.ndarray, List[dict]]:
        """
        Run YOLO detection on image
        
        Args:
            image: Input image as numpy array (BGR format)
            
        Returns:
            Tuple of (annotated_image, detections_list)
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        try:
            # Run inference
            results = self.model(
                image,
                conf=settings.CONF_THRESHOLD,
                iou=settings.IOU_THRESHOLD,
                imgsz=settings.IMG_SIZE,
                device=settings.DEVICE,
                max_det=settings.MAX_DETECTIONS,
                verbose=False
            )
            
            # Annotate image
            annotated_image = image.copy()
            detections = []
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Extract box data
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0].cpu().numpy())
                    class_id = int(box.cls[0].cpu().numpy())
                    class_name = self.class_names[class_id]
                    
                    # Draw bounding box
                    color = self._get_color(class_name)
                    cv2.rectangle(
                        annotated_image,
                        (int(x1), int(y1)),
                        (int(x2), int(y2)),
                        color,
                        2
                    )
                    
                    # Draw label
                    label = f"{class_name}: {confidence:.2f}"
                    label_size, _ = cv2.getTextSize(
                        label, 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.6, 
                        2
                    )
                    label_y = max(int(y1) - 10, label_size[1] + 10)
                    
                    # Label background
                    cv2.rectangle(
                        annotated_image,
                        (int(x1), int(y1) - label_size[1] - 10),
                        (int(x1) + label_size[0], int(y1)),
                        color,
                        -1
                    )
                    
                    # Label text
                    cv2.putText(
                        annotated_image,
                        label,
                        (int(x1), label_y),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 0, 0),
                        2
                    )
                    
                    # Store detection
                    detections.append({
                        'class_name': class_name,
                        'confidence': confidence,
                        'bounding_box': {
                            'x1': float(x1),
                            'y1': float(y1),
                            'x2': float(x2),
                            'y2': float(y2)
                        }
                    })
            
            return annotated_image, detections
            
        except Exception as e:
            logger.error(f"Detection failed: {str(e)}")
            raise
    
    def _get_color(self, class_name: str) -> Tuple[int, int, int]:
        """Get color for bounding box based on class"""
        color_map = {
            'healthy': (0, 255, 0),      # Green
            'stressed': (0, 0, 255),     # Red
            'st': (0, 165, 255)          # Orange
        }
        return color_map.get(class_name, (255, 255, 255))
    
    def calculate_health_score(self, detections: List[dict]) -> float:
        """
        Calculate overall health score (0-100)
        100 = all healthy, 0 = all stressed
        """
        if not detections:
            return 100.0
        
        healthy_count = sum(1 for d in detections if d['class_name'] == 'healthy')
        total_count = len(detections)
        
        return (healthy_count / total_count) * 100.0


# Global detector instance
detector = YOLODetector()
