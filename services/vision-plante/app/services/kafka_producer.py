import json
import logging
from kafka import KafkaProducer
from kafka.errors import KafkaError
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class KafkaProducerService:
    def __init__(self):
        self.producer: Optional[KafkaProducer] = None
        self.connect()
    
    def connect(self):
        """Initialize Kafka producer"""
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                retries=3,
                max_in_flight_requests_per_connection=1
            )
            logger.info("Kafka producer connected successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {str(e)}")
            self.producer = None
    
    def publish_detection(self, detection_data: dict):
        """Publish disease detection event to Kafka"""
        if self.producer is None:
            logger.warning("Kafka producer not available, skipping publish")
            return
        
        try:
            future = self.producer.send(
                settings.KAFKA_TOPIC_DISEASE_DETECTION,
                value=detection_data
            )
            
            # Wait for confirmation
            record_metadata = future.get(timeout=10)
            logger.info(
                f"Published to {record_metadata.topic} "
                f"partition {record_metadata.partition} "
                f"offset {record_metadata.offset}"
            )
        except KafkaError as e:
            logger.error(f"Failed to publish to Kafka: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error publishing to Kafka: {str(e)}")
    
    def close(self):
        """Close Kafka producer"""
        if self.producer:
            self.producer.close()
            logger.info("Kafka producer closed")
    
    def is_connected(self) -> bool:
        """Check if Kafka producer is connected"""
        return self.producer is not None


# Global producer instance
kafka_producer = KafkaProducerService()
