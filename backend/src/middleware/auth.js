import { verifyJWT } from '../utils/auth.js';
import { getUserByEmail } from '../services/database.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  // Get user from database
  const user = getUserByEmail(decoded.email);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }
  
  req.user = user;
  next();
}