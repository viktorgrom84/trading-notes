import { Pool } from 'pg';
import { hashPassword, generateToken } from '../auth.js';

// Create connection pool for Vercel
const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const client = await pool.connect();
    
    try {
      // Check if user already exists
      const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password and create user
      const passwordHash = await hashPassword(password);
      const result = await client.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
        [username, passwordHash]
      );

      const user = result.rows[0];

      // Generate token
      const token = generateToken(user.id, user.username);

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          id: user.id,
          username: user.username
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}