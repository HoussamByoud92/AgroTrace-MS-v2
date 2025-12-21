# 🗂️ Project Structure Guide

## Visual Structure

```
visionPlant/
│
├── 🎯 main.py                       ← START HERE (Entry point)
│
├── 📦 app/                          ← Application Package
│   │
│   ├── 🌐 api/                     ← HTTP Layer
│   │   └── routes.py               ← All REST endpoints
│   │
│   ├── ⚙️ core/                    ← Configuration
│   │   └── config.py               ← Settings & env vars
│   │
│   ├── 📋 schemas/                 ← Data Models
│   │   └── detection.py            ← Pydantic models
│   │
│   └── 🔧 services/                ← Business Logic
│       ├── yolo_detector.py        ← AI detection
│       └── kafka_producer.py       ← Event publishing
│
├── 📚 docs/                         ← All Documentation
│   ├── GETTING_STARTED.md          ← Read this first!
│   ├── README.md                   ← Full docs
│   ├── QUICKSTART.md               ← 5-min setup
│   ├── DEPLOYMENT.md               ← Production guide
│   ├── ARCHITECTURE.md             ← System design
│   └── PROJECT_SUMMARY.md          ← Overview
│
├── 🧪 tests/                        ← Testing
│   ├── test_api.py                 ← Python tests
│   └── test_frontend.html          ← Web UI test
│
├── 🚀 scripts/                      ← Utilities
│   ├── start.bat                   ← Windows start
│   └── start.sh                    ← Linux/Mac start
│
├── 🤖 model/                        ← AI Model
│   └── best.pt                     ← YOLO weights
│
├── 📤 uploads/                      ← Temp uploads
├── 📥 results/                      ← Detection results
│
└── 🐳 Docker files
    ├── Dockerfile
    ├── docker-compose.yml
    └── .dockerignore
```

## Request Flow

```
1. Client Request
   ↓
2. main.py (FastAPI app)
   ↓
3. app/api/routes.py (Route handler)
   ↓
4. app/schemas/detection.py (Validate request)
   ↓
5. app/services/yolo_detector.py (Run AI detection)
   ↓
6. app/services/kafka_producer.py (Publish event)
   ↓
7. app/api/routes.py (Format response)
   ↓
8. Client Response
```

## Module Dependencies

```
main.py
  ├── imports app.api.routes
  ├── imports app.core.config
  └── imports app.services.kafka_producer

app/api/routes.py
  ├── imports app.core.config
  ├── imports app.schemas.detection
  ├── imports app.services.yolo_detector
  └── imports app.services.kafka_producer

app/services/yolo_detector.py
  └── imports app.core.config

app/services/kafka_producer.py
  └── imports app.core.config

app/schemas/detection.py
  └── (no internal imports)

app/core/config.py
  └── (no internal imports)
```

## File Sizes & Complexity

| File | Lines | Complexity | Purpose |
|------|-------|------------|---------|
| `main.py` | ~60 | Low | App initialization |
| `app/api/routes.py` | ~150 | Medium | API endpoints |
| `app/services/yolo_detector.py` | ~140 | High | AI detection |
| `app/services/kafka_producer.py` | ~70 | Low | Event publishing |
| `app/core/config.py` | ~40 | Low | Configuration |
| `app/schemas/detection.py` | ~50 | Low | Data models |

## Quick Navigation

### I want to...

| Goal | Go to |
|------|-------|
| Start the service | Run `scripts/start.bat` or `main.py` |
| Add a new endpoint | Edit `app/api/routes.py` |
| Change AI settings | Edit `app/core/config.py` or `.env` |
| Add a data model | Edit `app/schemas/detection.py` |
| Modify detection logic | Edit `app/services/yolo_detector.py` |
| Test the API | Open `tests/test_frontend.html` |
| Read documentation | Open `docs/GETTING_STARTED.md` |
| Deploy with Docker | Run `docker-compose up -d` |

## Color-Coded Organization

### 🎯 Entry Points (Red)
- `main.py` - Start here

### 📦 Application Code (Blue)
- `app/` - All business logic

### 📚 Documentation (Green)
- `docs/` - All guides and docs

### 🧪 Testing (Yellow)
- `tests/` - All test files

### 🚀 Utilities (Purple)
- `scripts/` - Helper scripts

### 🤖 Resources (Orange)
- `model/` - AI model files

## Best Practices Applied

### ✅ Separation of Concerns
```
API Layer (routes.py)        → HTTP handling
Service Layer (services/)    → Business logic
Schema Layer (schemas/)      → Data validation
Core Layer (core/)           → Configuration
```

### ✅ Single Responsibility
```
yolo_detector.py    → Only AI detection
kafka_producer.py   → Only Kafka publishing
config.py           → Only configuration
routes.py           → Only HTTP routing
```

### ✅ Clear Dependencies
```
High Level:  routes.py
             ↓
Mid Level:   services/
             ↓
Low Level:   core/config.py
```

### ✅ Easy Testing
```
tests/
├── test_api.py          → Test API endpoints
└── test_frontend.html   → Manual testing UI
```

## Common Patterns

### Adding a New Feature

1. **Define data model** in `app/schemas/detection.py`
2. **Create service** in `app/services/` (if needed)
3. **Add route** in `app/api/routes.py`
4. **Add test** in `tests/`
5. **Update docs** in `docs/`

### Modifying Configuration

1. **Add setting** to `app/core/config.py`
2. **Add to** `.env.example`
3. **Update** `.env`
4. **Document** in `docs/README.md`

### Debugging

1. **Check logs** in console output
2. **Test endpoint** at `/docs`
3. **Use** `tests/test_frontend.html`
4. **Check** `app/api/routes.py` for logic

## Folder Purposes Summary

| Folder | Contains | Purpose |
|--------|----------|---------|
| `app/api/` | HTTP routes | Handle web requests |
| `app/core/` | Configuration | Manage settings |
| `app/schemas/` | Data models | Validate data |
| `app/services/` | Business logic | Core functionality |
| `docs/` | Documentation | User guides |
| `tests/` | Test files | Quality assurance |
| `scripts/` | Utilities | Helper scripts |
| `model/` | AI models | YOLO weights |
| `uploads/` | Temp files | User uploads |
| `results/` | Output files | Detection results |

## Why This Structure?

### Before: Flat Structure ❌
```
All files in root directory
→ Hard to find files
→ No clear organization
→ Difficult to maintain
→ Doesn't scale well
```

### After: Organized Structure ✅
```
Logical folder hierarchy
→ Easy to navigate
→ Clear organization
→ Easy to maintain
→ Scales perfectly
```

## Pro Tips

### 💡 Finding Files Fast
- **API endpoints?** → `app/api/routes.py`
- **Configuration?** → `app/core/config.py`
- **AI logic?** → `app/services/yolo_detector.py`
- **Documentation?** → `docs/`

### 💡 Making Changes
- **New endpoint?** → Add to `app/api/routes.py`
- **New setting?** → Add to `app/core/config.py`
- **New service?** → Create in `app/services/`

### 💡 Testing
- **Quick test?** → Open `tests/test_frontend.html`
- **API docs?** → Visit `/docs` endpoint
- **Python test?** → Run `tests/test_api.py`

---

**This structure makes the project professional, maintainable, and easy to understand!** 🎉
