from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import logging
import io

logger = logging.getLogger(__name__)

class MinioService:
    def __init__(self):
        try:
            self.client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
            self._ensure_bucket_exists(settings.MINIO_BUCKET_IMAGES)
        except Exception as e:
            logger.error(f"Failed to initialize MinIO client: {e}")
            self.client = None

    def _ensure_bucket_exists(self, bucket_name: str):
        if self.client and not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)
            
            # Set policy to public read (if needed) or handle via presigned URLs
            policy = '{ "Version": "2012-10-17", "Statement": [ { "Action": [ "s3:GetObject" ], "Effect": "Allow", "Principal": { "AWS": [ "*" ] }, "Resource": [ "arn:aws:s3:::%s/*" ], "Sid": "" } ] }' % bucket_name
            self.client.set_bucket_policy(bucket_name, policy)

    def upload_file(self, file_data: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """Uploads file to MinIO and returns the path (bucket/filename)"""
        if not self.client:
            raise Exception("MinIO client not initialized")
            
        try:
            self.client.put_object(
                settings.MINIO_BUCKET_IMAGES,
                filename,
                io.BytesIO(file_data),
                len(file_data),
                content_type=content_type
            )
            return f"{settings.MINIO_BUCKET_IMAGES}/{filename}"
        except S3Error as e:
            logger.error(f"MinIO upload error: {e}")
            raise e

    def get_file_url(self, path: str) -> str:
        """Returns the URL to access the file"""
        # If the path already has the bucket name, don't prepend it
        bucket_prefix = f"{settings.MINIO_BUCKET_IMAGES}/"
        if path.startswith(bucket_prefix):
            return f"http://localhost:9000/{path}"
        return f"http://localhost:9000/{bucket_prefix}{path}"

minio_service = MinioService()
