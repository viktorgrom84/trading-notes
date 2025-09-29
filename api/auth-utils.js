import { verifyToken } from './auth.js';

// Shared authentication utility for both local and Vercel APIs
export const authenticateUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    throw new Error('Invalid token');
  }

  return decoded;
};

// Helper to handle authentication errors consistently
export const handleAuthError = (error, res) => {
  if (error.message === 'No token provided') {
    return res.status(401).json({ message: 'No token provided' });
  }
  if (error.message === 'Invalid token') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  throw error;
};
