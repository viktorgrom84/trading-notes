// Set the correct environment variable for Vercel Postgres
if (process.env.viktor_POSTGRES_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.viktor_POSTGRES_URL;
}

// Convert direct connection string to pooled connection string
if (process.env.POSTGRES_URL && process.env.POSTGRES_URL.includes('@db.prisma.io')) {
  // Convert Prisma connection string to Vercel Postgres pooled format
  const url = new URL(process.env.POSTGRES_URL);
  const pooledUrl = `postgres://${url.username}:${url.password}@${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}?sslmode=require&pgbouncer=true`;
  process.env.POSTGRES_URL = pooledUrl;
}
