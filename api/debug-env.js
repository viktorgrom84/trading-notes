// Debug environment variables
export default async function handler(req, res) {
  try {
    const envVars = {
      viktor_POSTGRES_URL: process.env.viktor_POSTGRES_URL ? 'SET' : 'NOT SET',
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    };

    // Show actual values (masked for security)
    const actualValues = {
      viktor_POSTGRES_URL: process.env.viktor_POSTGRES_URL ? 
        process.env.viktor_POSTGRES_URL.substring(0, 20) + '...' : 'NOT SET',
      POSTGRES_URL: process.env.POSTGRES_URL ? 
        process.env.POSTGRES_URL.substring(0, 20) + '...' : 'NOT SET',
    };

    res.status(200).json({
      message: 'Environment variables debug',
      envVars,
      actualValues,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
