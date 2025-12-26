from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from pathlib import Path
import os
import py_eureka_client.eureka_client as eureka_client

from app.core.config import settings
from app.api.routes import router
from app.services.kafka_producer import kafka_producer

EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://eureka-server:8761/eureka")

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="VisionPlante - Crop Stress Detection Service",
    description="AI-powered crop disease and stress detection using YOLO",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

# Create directories
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.RESULTS_DIR).mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting VisionPlante service...")
    logger.info(f"Model path: {settings.MODEL_PATH}")
    logger.info(f"Device: {settings.DEVICE}")
    
    # Register with Eureka
    try:
        await eureka_client.init_async(
            eureka_server=EUREKA_SERVER,
            app_name="vision-plante",
            instance_port=8000,
            instance_host="vision-plante"
        )
        logger.info("Registered with Eureka")
    except Exception as e:
        logger.warning(f"Failed to register with Eureka: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down VisionPlante service...")
    kafka_producer.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )
