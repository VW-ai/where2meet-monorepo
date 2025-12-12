// Set environment variables before any module imports
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.PORT = "3001";
process.env.HOST = "127.0.0.1";
