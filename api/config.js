// Set the correct environment variable for Vercel Postgres
if (process.env.viktor_POSTGRES_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.viktor_POSTGRES_URL;
}
