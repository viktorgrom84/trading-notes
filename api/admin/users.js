import { Pool } from 'pg';
import { verifyToken } from '../auth.js';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const ADMIN_USERNAME = 'admin@test.com';

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (decoded.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const client = await pool.connect();
    
    try {
      if (req.method === 'GET') {
        const result = await client.query(
          'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
      } else if (req.method === 'DELETE') {
        const { id } = req.query;
        
        if (parseInt(id) === decoded.userId) {
          return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        const result = await client.query(
          'DELETE FROM users WHERE id = $1 RETURNING id, username',
          [id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
          message: 'User deleted successfully', 
          deletedUser: result.rows[0] 
        });
      } else {
        res.status(405).json({ message: 'Method not allowed' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
