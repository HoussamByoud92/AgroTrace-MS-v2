from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text, inspect
from typing import List, Dict, Any, Optional
import os
import py_eureka_client.eureka_client as eureka_client

EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://eureka-server:8761/eureka")

app = FastAPI(
    title="DB Explorer Service",
    description="Database introspection API for AgroTrace",
    version="1.0.0"
)

# Eureka registration on startup
@app.on_event("startup")
async def startup_event():
    try:
        await eureka_client.init_async(
            eureka_server=EUREKA_SERVER,
            app_name="db-explorer",
            instance_port=8000,
            instance_host="db-explorer"
        )
        print("Registered with Eureka")
    except Exception as e:
        print(f"Failed to register with Eureka: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configurations
DATABASES = {
    "timescaledb": {
        "url": os.getenv("TIMESCALE_URL", "postgresql://agro_user:agro_password@timescaledb:5432/agro_timescale"),
        "display_name": "TimescaleDB",
        "type": "PostgreSQL + TimescaleDB",
        "description": "Time-series data for sensor readings"
    },
    "auth_db": {
        "url": os.getenv("AUTH_DB_URL", "postgresql://agro_user:agro_password@timescaledb:5432/agro_auth"),
        "display_name": "Auth Database",
        "type": "PostgreSQL",
        "description": "User authentication data"
    },
    "postgis": {
        "url": os.getenv("POSTGIS_URL", "postgresql://agro_user:agro_password@postgis:5432/agro_gis"),
        "display_name": "PostGIS",
        "type": "PostgreSQL + PostGIS",
        "description": "Spatial data for fields and detections"
    },
    "reco_db": {
        "url": os.getenv("POSTGIS_URL", "postgresql://agro_user:agro_password@postgis:5432/agro_gis"),
        "display_name": "Recommendations DB",
        "type": "PostgreSQL + Irrigation Logs",
        "description": "Historical irrigation plans and AI decisions"
    }
}

# Pydantic models
class DatabaseInfo(BaseModel):
    name: str
    display_name: str
    type: str
    description: str
    table_count: int

class TableInfo(BaseModel):
    name: str
    row_count: Optional[int] = None

class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool
    default: Optional[str] = None

class TableSchema(BaseModel):
    table_name: str
    columns: List[ColumnInfo]

class TableData(BaseModel):
    table_name: str
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_count: int
    page: int
    page_size: int

def get_engine(db_name: str):
    if db_name not in DATABASES:
        raise HTTPException(status_code=404, detail=f"Database '{db_name}' not found")
    return create_engine(DATABASES[db_name]["url"], pool_pre_ping=True)

# Known application tables for each database (whitelist approach)
APPLICATION_TABLES = {
    "timescaledb": {"sensor_data", "sensor_readings"},
    "auth_db": {"users"},
    "postgis": {"fields", "analyzed_images", "detections", "irrigation_plans"},
    "reco_db": {"irrigation_plans"},
}

def filter_to_app_tables(db_name: str, tables: list) -> list:
    """Only return known application tables, filtering out all system tables"""
    known_tables = APPLICATION_TABLES.get(db_name, set())
    if known_tables:
        # Return only tables that are in our whitelist
        return [t for t in tables if t in known_tables]
    else:
        # If no whitelist defined, return all tables (fallback)
        return tables

@app.get("/health")
def health():
    return {"status": "ok", "service": "db-explorer"}

@app.get("/databases", response_model=List[DatabaseInfo])
def list_databases():
    """List all configured databases with their table counts"""
    result = []
    for db_name, config in DATABASES.items():
        try:
            engine = get_engine(db_name)
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            # Filter to show only application tables
            tables = filter_to_app_tables(db_name, tables)
            table_count = len(tables)
        except Exception as e:
            table_count = -1  # Indicate connection error
        
        result.append(DatabaseInfo(
            name=db_name,
            display_name=config["display_name"],
            type=config["type"],
            description=config["description"],
            table_count=table_count
        ))
    return result

@app.get("/databases/{db_name}/tables", response_model=List[TableInfo])
def list_tables(db_name: str):
    """List all tables in a database"""
    try:
        engine = get_engine(db_name)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        # Filter to show only application tables
        tables = filter_to_app_tables(db_name, tables)
        
        result = []
        for table_name in tables:
            try:
                with engine.connect() as conn:
                    count_result = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
                    row_count = count_result.scalar()
            except:
                row_count = None
            
            result.append(TableInfo(name=table_name, row_count=row_count))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/databases/{db_name}/tables/{table_name}/schema", response_model=TableSchema)
def get_table_schema(db_name: str, table_name: str):
    """Get schema (columns) for a specific table"""
    try:
        engine = get_engine(db_name)
        inspector = inspect(engine)
        
        # Check if table exists
        if table_name not in inspector.get_table_names():
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        
        columns = inspector.get_columns(table_name)
        pk_columns = inspector.get_pk_constraint(table_name).get('constrained_columns', [])
        
        column_infos = []
        for col in columns:
            column_infos.append(ColumnInfo(
                name=col['name'],
                type=str(col['type']),
                nullable=col.get('nullable', True),
                primary_key=col['name'] in pk_columns,
                default=str(col.get('default')) if col.get('default') else None
            ))
        
        return TableSchema(table_name=table_name, columns=column_infos)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/databases/{db_name}/tables/{table_name}/data", response_model=TableData)
def get_table_data(
    db_name: str, 
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Get paginated data from a table"""
    try:
        engine = get_engine(db_name)
        inspector = inspect(engine)
        
        # Check if table exists
        if table_name not in inspector.get_table_names():
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        
        with engine.connect() as conn:
            # Get total count
            count_result = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
            total_count = count_result.scalar()
            
            # Get column names
            columns_info = inspector.get_columns(table_name)
            column_names = [col['name'] for col in columns_info]
            
            # Get paginated data
            offset = (page - 1) * page_size
            data_result = conn.execute(
                text(f'SELECT * FROM "{table_name}" LIMIT :limit OFFSET :offset'),
                {"limit": page_size, "offset": offset}
            )
            
            rows = []
            for row in data_result:
                row_dict = {}
                for i, col_name in enumerate(column_names):
                    value = row[i]
                    # Convert non-serializable types to string
                    if value is not None and not isinstance(value, (str, int, float, bool)):
                        value = str(value)
                    row_dict[col_name] = value
                rows.append(row_dict)
        
        return TableData(
            table_name=table_name,
            columns=column_names,
            rows=rows,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/databases/{db_name}/tables/{table_name}/clear")
def clear_table(db_name: str, table_name: str):
    """Clear all data from a table (DELETE FROM table)"""
    try:
        engine = get_engine(db_name)
        inspector = inspect(engine)
        
        # Check if table exists
        if table_name not in inspector.get_table_names():
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        
        # Only allow clearing application tables for safety
        app_tables = APPLICATION_TABLES.get(db_name, set())
        if app_tables and table_name not in app_tables:
            raise HTTPException(status_code=403, detail=f"Clearing table '{table_name}' is not allowed")
        
        with engine.connect() as conn:
            # Get count before clearing
            count_result = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
            rows_before = count_result.scalar()
            
            # Clear the table
            conn.execute(text(f'DELETE FROM "{table_name}"'))
            conn.commit()
            
            return {
                "success": True,
                "message": f"Successfully cleared table '{table_name}'",
                "rows_deleted": rows_before
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
