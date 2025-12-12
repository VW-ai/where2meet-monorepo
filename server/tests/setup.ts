// Set environment variables before any module imports
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5434/where2meet?schema=public";
process.env.REDIS_URL = "redis://localhost:6380";
process.env.PORT = "3001";
process.env.HOST = "127.0.0.1";
