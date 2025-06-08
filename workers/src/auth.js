import { 
  corsHeaders, 
  generateToken, 
  isValidEmail, 
  checkRateLimit, 
  parseJsonBody, 
  validateMethod 
} from './utils.js';
import { sendMagicLink } from './email.js';
import { 
  securityHeaders, 
  enhancedRateLimit, 
  validateEmailInput, 
  validateToken, 
  validateOrigin, 
  validateUserAgent,
  validateHoneypot
} from './security.js';

export async function handleAuth(request, env, path) {
  const headers = { 
    'Content-Type': 'application/json', 
    ...corsHeaders,
    ...securityHeaders
  };

  try {
    if (path === '/api/auth/request') {
      return await handleAuthRequest(request, env, headers);
    }
    
    if (path === '/api/auth/verify') {
      return await handleAuthVerify(request, env, headers);
    }

    return new Response(JSON.stringify({ error: 'Auth endpoint not found' }), {
      status: 404,
      headers
    });

  } catch (error) {
    console.error('Auth error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Authentication error' 
    }), {
      status: 400,
      headers
    });
  }
}

async function handleAuthRequest(request, env, headers) {
  validateMethod(request, 'POST');
  
  // Security validations
  validateOrigin(request, ['https://stillmind.app']);
  validateUserAgent(request);
  
  const body = await parseJsonBody(request);
  validateHoneypot(body);
  
  // Enhanced email validation
  const email = validateEmailInput(body.email);

  // Enhanced rate limiting by IP
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `auth_request:${clientIP}`;
  
  const rateLimitResult = await enhancedRateLimit(env, rateLimitKey, {
    limit: 3,
    window: 300, // 5 minutes
    blockDuration: 3600 // 1 hour block
  });
  
  if (!rateLimitResult.allowed) {
    const message = rateLimitResult.blocked 
      ? 'Too many requests. Account temporarily blocked.'
      : 'Rate limit exceeded. Please try again later.';
    throw new Error(message);
  }

  // Generate magic link token
  const token = generateToken();
  const expiryTime = Date.now() + (15 * 60 * 1000); // 15 minutes

  // Store token in KV with email and expiry
  const tokenData = {
    email: email,
    expiresAt: expiryTime,
    createdAt: Date.now(),
    used: false,
    clientIP: clientIP
  };

  await env.AUTH_TOKENS.put(`magic_token:${token}`, JSON.stringify(tokenData), {
    expirationTtl: 900 // 15 minutes
  });

  // Send magic link email
  const magicLink = `${new URL(request.url).origin}/api/auth/verify?token=${token}`;
  
  try {
    await sendMagicLink(env, email, magicLink, token);
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    // Don't expose email service errors to client
    throw new Error('Failed to send magic link. Please try again.');
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Magic link sent to your email address'
  }), { headers });
}

async function handleAuthVerify(request, env, headers) {
  validateMethod(request, 'GET');
  
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  // Validate token format
  validateToken(token);

  // Retrieve token data from KV
  const tokenDataStr = await env.AUTH_TOKENS.get(`magic_token:${token}`);
  
  if (!tokenDataStr) {
    throw new Error('Invalid or expired token');
  }

  const tokenData = JSON.parse(tokenDataStr);
  
  // Check if token is expired
  if (Date.now() > tokenData.expiresAt) {
    await env.AUTH_TOKENS.delete(`magic_token:${token}`);
    throw new Error('Token has expired');
  }

  // Check if token has been used
  if (tokenData.used) {
    throw new Error('Token has already been used');
  }

  // Mark token as used
  tokenData.used = true;
  await env.AUTH_TOKENS.put(`magic_token:${token}`, JSON.stringify(tokenData), {
    expirationTtl: 900
  });

  // Generate JWT or session token for the user
  const userToken = await generateUserToken(env, tokenData.email);

  // Return success response with redirect or token
  const isWebRequest = request.headers.get('Accept')?.includes('text/html');
  
  if (isWebRequest) {
    // Redirect to app with token in URL fragment (client-side only)
    const redirectUrl = `https://stillmind.app/#auth-success?token=${userToken}`;
    return Response.redirect(redirectUrl, 302);
  } else {
    // API response with token
    return new Response(JSON.stringify({
      success: true,
      token: userToken,
      email: tokenData.email
    }), { headers });
  }
}

async function generateUserToken(env, email) {
  // Generate a user session token
  const userToken = generateToken();
  const sessionData = {
    email: email.toLowerCase(),
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };

  await env.AUTH_TOKENS.put(`user_session:${userToken}`, JSON.stringify(sessionData), {
    expirationTtl: 30 * 24 * 60 * 60 // 30 days
  });

  return userToken;
}