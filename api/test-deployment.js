// Test what's actually deployed
export default async function handler(req, res) {
  try {
    // Check if Prisma is available
    let prismaAvailable = false;
    try {
      const { PrismaClient } = await import('@prisma/client');
      prismaAvailable = true;
    } catch (error) {
      console.log('Prisma not available:', error.message);
    }

    // Check environment variables
    const envVars = {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      viktor_PRISMA_DATABASE_URL: process.env.viktor_PRISMA_DATABASE_URL ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    };

    res.status(200).json({
      message: 'Deployment test',
      prismaAvailable,
      envVars,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
