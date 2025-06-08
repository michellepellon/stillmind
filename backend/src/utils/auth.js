import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Generate a secure random token
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate JWT token
export function generateJWT(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
}

// Verify JWT token
export function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Validate email format
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate token format
export function isValidToken(token) {
  return typeof token === 'string' && token.length === 64 && /^[a-f0-9]+$/.test(token);
}