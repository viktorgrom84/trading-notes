// Test database connection locally
import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Convert direct connection string to pooled connection string
const getPooledConnectionString = () => {
  const directUrl = process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL;
  console.log('Original URL:', directUrl ? directUrl.substring(0, 30) + '...' : 'NOT FOUND');
  
  if (directUrl && directUrl.includes('@db.prisma.io')) {
    // Convert Prisma direct connection to Vercel Postgres pooled format
    const url = new URL(directUrl);
    const pooledUrl = `postgres://${url.username}:${url.password}@${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}?sslmode=require&pgbouncer=true`;
    console.log('Converted URL:', pooledUrl.substring(0, 30) + '...');
    return pooledUrl;
  }
  console.log('Using original URL as-is');
  return directUrl;
};

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Override the connection string for sql helper
    const pooledUrl = getPooledConnectionString();
    if (pooledUrl) {
      process.env.POSTGRES_URL = pooledUrl;
    }

    console.log('Final POSTGRES_URL:', process.env.POSTGRES_URL ? 'SET' : 'NOT SET');

    // Test 1: Simple query
    console.log('📊 Testing simple query...');
    const result = await sql`SELECT 1 as test, NOW() as current_time`;
    console.log('✅ Simple query successful:', result.rows[0]);

    // Test 2: Create users table
    console.log('📋 Testing table creation...');
    await sql`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table creation successful');

    // Test 3: Insert test user
    console.log('👤 Testing user creation...');
    const testUser = await sql`
      INSERT INTO test_users (username, password_hash)
      VALUES ('testuser', 'hashedpassword')
      RETURNING id, username, created_at
    `;
    console.log('✅ User creation successful:', testUser.rows[0]);

    // Test 4: Query test user
    console.log('🔍 Testing user query...');
    const foundUser = await sql`
      SELECT * FROM test_users WHERE username = 'testuser'
    `;
    console.log('✅ User query successful:', foundUser.rows[0]);

    // Test 5: Clean up
    console.log('🧹 Cleaning up test data...');
    await sql`DROP TABLE IF EXISTS test_users`;
    console.log('✅ Cleanup successful');

    console.log('🎉 All tests passed! Database connection is working correctly.');

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

// Run the test
testConnection();
