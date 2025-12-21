from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8003
    ENVIRONMENT: str = "development"
    
    # YOLO Model
    MODEL_PATH: str = "./model/best.pt"
    CONF_THRESHOLD: float = 0.4
    IOU_THRESHOLD: float = 0.45
    IMG_SIZE: int = 640
    DEVICE: str = "cuda"
    MAX_DETECTIONS: int = 300
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_TOPIC_DISEASE_DETECTION: str = "disease-detection-topic"
    KAFKA_TOPIC_IMAGE_TILES: str = "image-tiles-topic"
    
    # Storage
    UPLOAD_DIR: str = "./uploads"
    RESULTS_DIR: str = "./results"
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    
    # Database
    DATABASE_URL: str = "postgresql://agro_user:agro_password@postgis:5432/agro_gis"
    
    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "agro_minio_user"
    MINIO_SECRET_KEY: str = "agro_minio_password"
    MINIO_BUCKET_IMAGES: str = "images"
    MINIO_SECURE: bool = False
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
