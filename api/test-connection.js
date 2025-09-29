import { sql } from '@vercel/postgres';

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

export default async function handler(req, res) {
  try {
    // Override the connection string for sql helper
    const pooledUrl = getPooledConnectionString();
    if (pooledUrl) {
      process.env.POSTGRES_URL = pooledUrl;
    }

    console.log('Final POSTGRES_URL:', process.env.POSTGRES_URL ? process.env.POSTGRES_URL.substring(0, 30) + '...' : 'NOT SET');

    // Try a simple query
    const result = await sql`SELECT 1 as test`;
    
    res.status(200).json({
      message: 'Connection test successful',
      testResult: result.rows[0],
      connectionString: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
    });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      connectionString: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
    });
  }
}
