# AgroTrace-MS v2 🌿

AgroTrace-MS v2 is an advanced microservices-based smart agriculture platform designed to optimize irrigation and monitor crop health using AI and computer vision.

The system utilizes a decentralized architecture with **Netflix Eureka** for service discovery, **Apache Kafka** for event-driven processing, and a hybrid AI approach combining **LSTM** networks with **YOLOv8** and a **Drools** rules engine.

## 🏗 System Architecture

The platform is composed of several specialized microservices that communicate via REST APIs and Kafka events. All services register with a central **Eureka Server** for dynamic discovery.

### Core Components
- **Netflix Eureka Server**: Service registry and discovery provider (Port 8761).
- **Nginx Gateway**: Central entry point for all API and frontend requests (Port 80).
- **Frontend**: Interactive React dashboard for field management and diagnostics.

### Analytical Microservices
- **🚀 Reco-Irrigation**: The "Brain" of the platform. Integrates results from Vision and Prediction workers into a unified recommendation.
- **👁 Vision-Plante**: YOLOv8-powered crop stress detection and geospatial mapping.
- **📉 Prevision-Eau**: LSTM-based water demand forecasting using 7-day weather predictions.
- **⚖️ Regles-Agro**: Drools expert system enforcing agronomic constraints.
- **🔄 Pre-traitement**: Kafka consumer for image tiling and sensor data cleaning.
- **🛰 Ingestion-Capteurs**: Entry point for IoT sensor telemetry and UAV imagery.

### Infrastructure & Data
- **TimescaleDB**: High-performance storage for time-series sensor readings.
- **PostGIS**: Geospatial database for storing field boundaries and detection coordinates.
- **Apache Kafka**: Event bus for high-throughput data processing.
- **MinIO**: Scalable object storage for high-resolution images and AI models.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (for local frontend development)
- Python 3.10+ (for local service development)

### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/HoussamByoud92/AgroTrace-MS-v2.git
   cd AgroTrace-MS-v2
   ```

2. Start the entire infrastructure using Docker Compose:
   ```bash
   docker-compose up --build
   ```

3. Access the services:
   - **Frontend**: [http://localhost](http://localhost) (via Gateway)
   - **Eureka Dashboard**: [http://localhost:8761](http://localhost:8761)
   - **MinIO Console**: [http://localhost:9001](http://localhost:9001)

## 🛠 Technology Stack
- **Backend**: FastAPI (Python), Spring Boot (Java)
- **Frontend**: React, Vite, Tailwind CSS, Leaflet
- **AI/ML**: TensorFlow/Keras (LSTM), Ultralytics YOLOv8
- **Rules Engine**: Drools 8
- **Discovery**: Spring Cloud Netflix Eureka
- **Data**: PostgreSQL/PostGIS, TimescaleDB, Kafka, MinIO

## 📈 ML Performance
- **LSTM MAE**: 2.34mm
- **Water Need Accuracy**: 93.1%
- **YOLO Inference**: <500ms per tile

---
Developed by: **Wadii BOUTOU, Houssam BYOUD, Nada JAMIM, Oumaima AARAB**
