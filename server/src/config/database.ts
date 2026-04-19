import mongoose from 'mongoose';
import { Pool } from 'pg';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medishift');
    console.log(`\n  🍃 MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`\n  ❌ MongoDB Connection Error: ${error.message}`);
    // Do not exit the process, allow the app to keep running with mock functionality if needed.
  }
};

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medishift',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('error', (err) => {
  console.error('[POSTGRES POOL ERROR]', err.message);
});
