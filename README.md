AgroTrace-MS v2
Overview

AgroTrace-MS v2 is a microservices-based smart agriculture platform designed to support irrigation optimization and crop health monitoring. The system integrates artificial intelligence, computer vision, and rule-based reasoning to assist decision-making in precision agriculture.

The platform follows a decentralized microservices architecture, relying on REST communication and event-driven processing. Service discovery is handled using Netflix Eureka, while data exchange and processing are coordinated through Apache Kafka. The analytical layer combines time-series forecasting, object detection, and agronomic rules.

System Architecture:

The platform is composed of independent microservices, each responsible for a specific functional domain. Services communicate through REST APIs and Kafka topics. Service discovery is handled dynamically at runtime using Netflix Eureka; however, the architectural diagrams focus on logical interactions rather than infrastructure-level discovery mechanisms.

<img width="911" height="824" alt="image" src="https://github.com/user-attachments/assets/2dd4977f-be73-4f8e-9c3a-d015b91c3f30" />




Core Infrastructure Components:

API Gateway (Nginx)
Central entry point for external requests and frontend access.

Service Discovery (Netflix Eureka)
Enables dynamic registration and discovery of microservices at runtime.

Apache Kafka
Event streaming platform used for high-throughput data ingestion and asynchronous processing.

Analytical and Functional Microservices

Reco-Irrigation
Aggregates outputs from prediction, vision, and rule-based services to generate irrigation recommendations.

Vision-Plante
Computer vision service using YOLOv11 for crop stress detection and spatial localization.

Prevision-Eau
Time-series forecasting service based on LSTM networks for estimating crop water demand using weather and sensor data.

Regles-Agro
Expert system implemented with Drools to enforce agronomic constraints and domain rules.

Pre-traitement
Kafka-based preprocessing service for image tiling and sensor data normalization.

Ingestion-Capteurs
Entry point for IoT sensor data and UAV imagery ingestion.

Data Management

TimescaleDB
Storage for time-series sensor measurements.

PostgreSQL / PostGIS
Management of spatial data, including field boundaries and detection coordinates.

MinIO
Object storage for high-resolution imagery and machine learning models.

Use Case Model

The functional interactions between system actors and the platform are described using a UML Use Case diagram. This model highlights the main user actions and system responsibilities, including data ingestion, analysis, visualization, and decision support.

Primary actors include:

Farmer / Operator

Agronomist

IoT Sensor Network

UAV Imaging System

<img width="473" height="763" alt="image" src="https://github.com/user-attachments/assets/82296be6-0ed9-4fed-9db1-3d454e25cae2" />




Process Modeling:

The operational workflows of the system are modeled using BPMN to describe data ingestion, analysis, and recommendation generation processes.

<img width="477" height="1002" alt="image" src="https://github.com/user-attachments/assets/ee843bdb-5609-44f2-a75f-c04d55ddb400" />




Technology Stack:

Backend: FastAPI (Python), Spring Boot (Java)

Frontend: React, Vite, Tailwind CSS, Leaflet

AI / ML: TensorFlow / Keras (LSTM), YOLOv11

Rules Engine: Drools 8

Service Discovery: Spring Cloud Netflix Eureka

Data & Messaging: PostgreSQL/PostGIS, TimescaleDB, Apache Kafka, MinIO

Experimental Results:

LSTM Mean Absolute Error (MAE): 2.34 mm

Water Requirement Prediction Accuracy: 93.1%

YOLOv11 Inference Time: < 500 ms per image tile

Deployment and Execution:
Prerequisites:

Docker and Docker Compose

Node.js (required only for frontend development using npm run dev)

Python 3.10+ (for local backend development)

Execution:
git clone https://github.com/HoussamByoud92/AgroTrace-MS-v2.git
cd AgroTrace-MS-v2
docker-compose up --build

Access Points:

Frontend: http://localhost:3000

Eureka Dashboard: http://localhost:8761

MinIO Console: http://localhost:9001



https://github.com/user-attachments/assets/cb5619ac-9a80-44f9-ab10-76b29e1f7f9d



Authors:

Wadii BOUTOU

Houssam BYOUD

Nada JAMIM

Oumaima AARAB
