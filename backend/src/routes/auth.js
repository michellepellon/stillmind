import express from 'express';
import { generateToken, generateJWT, isValidEmail, isValidToken } from '../utils/auth.js';
import { sendMagicLink } from '../services/email.js';
import { 
  createUser, 
  getUserByEmail, 
  saveToken, 
  getToken, 
  markTokenUsed,
  updateLastLogin
} from '../services/database.js';

const router = express.Router();

// Request magic link
router.post('/request', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    // Create user if doesn't exist
    const userId = createUser(email);
    
    // Generate magic link token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Save token to database
    const clientIp = req.ip || req.connection.remoteAddress;
    saveToken(token, email, 'magic', expiresAt, clientIp);
    
    // Generate magic link URL
    const baseUrl = process.env.FRONTEND_URL || `http://${req.get('host')}`;
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;
    
    // Send email
    try {
      await sendMagicLink(email, magicLink, token);
      res.json({
        success: true,
        message: 'Magic link sent to your email address'
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      res.status(500).json({
        error: 'Failed to send magic link. Please try again.'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Verify magic link
router.get('/verify', async (req, res, next) => {
  try {
    const { token } = req.query;
    
    // Validate token format
    if (!token || !isValidToken(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    // Get token from database
    const tokenData = getToken(token);
    
    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
    }
    
    // Check if already used
    if (tokenData.used) {
      return res.status(400).json({ error: 'Token has already been used' });
    }
    
    // Mark token as used
    markTokenUsed(token);
    
    // Get user
    const user = getUserByEmail(tokenData.email);
    updateLastLogin(user.id);
    
    // Generate session token
    const sessionToken = generateJWT({
      userId: user.id,
      email: user.email
    });
    
    // Check if this is a browser request
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    
    if (acceptsHtml) {
      // Redirect to app with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      return res.redirect(`${frontendUrl}/#auth-success?token=${sessionToken}`);
    } else {
      // API response
      res.json({
        success: true,
        token: sessionToken,
        email: user.email
      });
    }
  } catch (error) {
    next(error);
  }
});

// Logout (optional - just for completeness)
router.post('/logout', (req, res) => {
  // Since we're using JWTs, logout is handled client-side
  res.json({ success: true, message: 'Logged out' });
});

export default router;