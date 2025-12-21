"""
Simple test script for VisionPlante API
"""
import requests
import sys


def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get("http://localhost:8003/api/v1/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")


def test_model_info():
    """Test model info endpoint"""
    print("Testing model info endpoint...")
    response = requests.get("http://localhost:8003/api/v1/model/info")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")


def test_detection(image_path: str):
    """Test detection endpoint"""
    print(f"Testing detection with image: {image_path}")
    
    with open(image_path, 'rb') as f:
        files = {'image': f}
        data = {
            'field_id': 'test-field-001',
            'tile_id': 'test-tile-001'
        }
        
        response = requests.post(
            "http://localhost:8003/api/v1/detect",
            files=files,
            data=data
        )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Detection ID: {result['detection_id']}")
        print(f"Total Detections: {result['total_detections']}")
        print(f"Health Score: {result['health_score']:.2f}")
        print(f"Stressed: {result['stressed_count']}, Healthy: {result['healthy_count']}")
        print(f"Result Image: {result['image_url']}")
        
        # Print individual detections
        for i, det in enumerate(result['detections'], 1):
            print(f"  Detection {i}: {det['class_name']} ({det['confidence']:.2f})")
    else:
        print(f"Error: {response.text}")


if __name__ == "__main__":
    print("VisionPlante API Test\n" + "="*50 + "\n")
    
    # Test health
    test_health()
    
    # Test model info
    test_model_info()
    
    # Test detection if image path provided
    if len(sys.argv) > 1:
        test_detection(sys.argv[1])
    else:
        print("To test detection, run: python test_api.py <image_path>")
