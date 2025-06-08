// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Generate secure random token
export function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate email address
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Rate limiting helper
export async function checkRateLimit(env, key, limit = 5, window = 300) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - window;
  
  const rateLimitKey = `rate_limit:${key}:${Math.floor(now / window)}`;
  const current = await env.AUTH_TOKENS.get(rateLimitKey);
  
  if (current && parseInt(current) >= limit) {
    return false;
  }
  
  const newCount = current ? parseInt(current) + 1 : 1;
  await env.AUTH_TOKENS.put(rateLimitKey, newCount.toString(), { expirationTtl: window });
  
  return true;
}

// Parse JSON body safely
export async function parseJsonBody(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

// Validate request method
export function validateMethod(request, expectedMethod) {
  if (request.method !== expectedMethod) {
    throw new Error(`Method ${request.method} not allowed`);
  }
}