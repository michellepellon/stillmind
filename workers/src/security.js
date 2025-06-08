// Security headers and middleware
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none';",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

// Enhanced rate limiting with different tiers
export async function enhancedRateLimit(env, key, config = {}) {
  const { 
    limit = 5, 
    window = 300, 
    blockDuration = 3600 
  } = config;
  
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `rate:${key}:${Math.floor(now / window)}`;
  const blockKey = `blocked:${key}`;
  
  // Check if currently blocked
  const isBlocked = await env.AUTH_TOKENS.get(blockKey);
  if (isBlocked) {
    return { allowed: false, blocked: true, resetTime: parseInt(isBlocked) };
  }
  
  // Get current count
  const current = await env.AUTH_TOKENS.get(windowKey);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) {
    // Block for longer duration after exceeding limit
    const blockUntil = now + blockDuration;
    await env.AUTH_TOKENS.put(blockKey, blockUntil.toString(), { 
      expirationTtl: blockDuration 
    });
    return { allowed: false, blocked: true, resetTime: blockUntil };
  }
  
  // Increment counter
  await env.AUTH_TOKENS.put(windowKey, (count + 1).toString(), { 
    expirationTtl: window 
  });
  
  return { 
    allowed: true, 
    blocked: false, 
    remaining: limit - count - 1,
    resetTime: now + window
  };
}

// Input validation helpers
export function validateEmailInput(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length < 3 || trimmed.length > 320) {
    throw new Error('Email length is invalid');
  }
  
  // Enhanced email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format');
  }
  
  // Block disposable email domains (basic list)
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
    'mailinator.com', 'throwaway.email'
  ];
  
  const domain = trimmed.split('@')[1];
  if (disposableDomains.includes(domain)) {
    throw new Error('Disposable email addresses are not allowed');
  }
  
  return trimmed;
}

// Token validation
export function validateToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }
  
  // Check token format (64 character hex string)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new Error('Invalid token format');
  }
  
  return token;
}

// Request origin validation
export function validateOrigin(request, allowedOrigins = []) {
  const origin = request.headers.get('Origin');
  
  if (!origin) {
    return true; // Allow requests without origin (direct API calls)
  }
  
  // In development, allow localhost
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }
  
  // Check against allowed origins
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    throw new Error('Origin not allowed');
  }
  
  return true;
}

// User agent validation (basic bot detection)
export function validateUserAgent(request) {
  const userAgent = request.headers.get('User-Agent');
  
  if (!userAgent) {
    return true; // Allow requests without user agent
  }
  
  // Block common bot patterns
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      throw new Error('Automated requests not allowed');
    }
  }
  
  return true;
}

// Honeypot validation (if honeypot fields are included)
export function validateHoneypot(body) {
  // Check for common honeypot field names
  const honeypotFields = ['website', 'url', 'phone', 'fax'];
  
  for (const field of honeypotFields) {
    if (body[field] && body[field].trim() !== '') {
      throw new Error('Bot detected');
    }
  }
  
  return true;
}