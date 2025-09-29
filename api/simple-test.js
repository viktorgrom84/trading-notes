// Simple test endpoint
export default async function handler(req, res) {
  res.status(200).json({
    message: 'Simple test working',
    timestamp: new Date().toISOString(),
    method: req.method,
  });
}
