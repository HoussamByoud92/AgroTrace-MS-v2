-- Create additional databases if they don't exist
-- The primary DB is created by POSTGRES_DB env var.

CREATE DATABASE agro_auth;
GRANT ALL PRIVILEGES ON DATABASE agro_auth TO agro_user;

-- Verify/Create agro_timescale if it wasn't the primary (it is, but safe to ignore if exists)
-- CREATE DATABASE agro_timescale;
