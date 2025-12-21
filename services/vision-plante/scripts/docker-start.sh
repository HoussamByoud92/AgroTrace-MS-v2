#!/bin/bash

echo "========================================"
echo "  VisionPlante - Docker Startup"
echo "========================================"
echo ""

echo "Choose deployment mode:"
echo ""
echo "1. VisionPlante + Kafka (Full microservices)"
echo "2. VisionPlante Only (Standalone, no Kafka)"
echo "3. Stop all containers"
echo "4. View logs"
echo "5. Rebuild containers"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "Starting VisionPlante with Kafka..."
        docker-compose up -d
        echo ""
        echo "✅ Services started!"
        echo ""
        echo "Access points:"
        echo "  - VisionPlante API: http://localhost:8003"
        echo "  - API Docs: http://localhost:8003/docs"
        echo "  - Kafka: localhost:9092"
        echo ""
        echo "Check status: docker-compose ps"
        echo "View logs: docker-compose logs -f"
        ;;
    2)
        echo ""
        echo "Starting VisionPlante (standalone)..."
        docker-compose -f docker-compose.standalone.yml up -d
        echo ""
        echo "✅ Service started!"
        echo ""
        echo "Access points:"
        echo "  - VisionPlante API: http://localhost:8003"
        echo "  - API Docs: http://localhost:8003/docs"
        echo ""
        echo "Check status: docker-compose -f docker-compose.standalone.yml ps"
        echo "View logs: docker-compose -f docker-compose.standalone.yml logs -f"
        ;;
    3)
        echo ""
        echo "Stopping all containers..."
        docker-compose down
        docker-compose -f docker-compose.standalone.yml down
        echo ""
        echo "✅ All containers stopped!"
        ;;
    4)
        echo ""
        echo "Choose which logs to view:"
        echo "1. VisionPlante + Kafka"
        echo "2. VisionPlante Only"
        echo ""
        read -p "Enter choice (1-2): " logchoice
        
        case $logchoice in
            1)
                docker-compose logs -f
                ;;
            2)
                docker-compose -f docker-compose.standalone.yml logs -f
                ;;
            *)
                echo "Invalid choice"
                ;;
        esac
        ;;
    5)
        echo ""
        echo "Rebuilding containers..."
        docker-compose down
        docker-compose build --no-cache
        echo ""
        echo "✅ Rebuild complete!"
        echo ""
        echo "Start with: docker-compose up -d"
        ;;
    *)
        echo ""
        echo "❌ Invalid choice!"
        ;;
esac

echo ""
