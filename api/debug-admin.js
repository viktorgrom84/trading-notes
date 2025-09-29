export default async function handler(req, res) {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'viktorgrom84@gmail.com';
    
    res.json({
      adminUsername,
      hasEnvVar: !!process.env.ADMIN_USERNAME,
      allEnvVars: Object.keys(process.env).filter(key => key.includes('ADMIN') || key.includes('viktor'))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
