// Test database connection with createClient
import { createClient } from '@vercel/postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  try {
    console.log('🔍 Testing database connection with createClient...');
    
    // Set up environment variables
    const directUrl = process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL;
    console.log('Original URL:', directUrl ? directUrl.substring(0, 30) + '...' : 'NOT FOUND');
    
    // Set the non-pooled connection string
    process.env.POSTGRES_URL_NON_POOLING = directUrl;
    console.log('Set POSTGRES_URL_NON_POOLING:', process.env.POSTGRES_URL_NON_POOLING ? 'SET' : 'NOT SET');

    // Test 1: Create client and test connection
    console.log('📊 Testing createClient connection...');
    const client = createClient();
    await client.connect();
    console.log('✅ Client connected successfully');

    // Test 2: Simple query
    console.log('📊 Testing simple query...');
    const result = await client.sql`SELECT 1 as test, NOW() as current_time`;
    console.log('✅ Simple query successful:', result.rows[0]);

    // Test 3: Create users table
    console.log('📋 Testing table creation...');
    await client.sql`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table creation successful');

    // Test 4: Insert test user
    console.log('👤 Testing user creation...');
    const testUser = await client.sql`
      INSERT INTO test_users (username, password_hash)
      VALUES ('testuser', 'hashedpassword')
      RETURNING id, username, created_at
    `;
    console.log('✅ User creation successful:', testUser.rows[0]);

    // Test 5: Query test user
    console.log('🔍 Testing user query...');
    const foundUser = await client.sql`
      SELECT * FROM test_users WHERE username = 'testuser'
    `;
    console.log('✅ User query successful:', foundUser.rows[0]);

    // Test 6: Clean up
    console.log('🧹 Cleaning up test data...');
    await client.sql`DROP TABLE IF EXISTS test_users`;
    console.log('✅ Cleanup successful');

    // Close connection
    await client.end();
    console.log('✅ Connection closed');

    console.log('🎉 All tests passed! Database connection is working correctly.');

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

// Run the test
testConnection();
