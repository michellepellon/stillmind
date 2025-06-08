# StillMind Authentication Worker

Cloudflare Worker providing authentication services for the StillMind meditation journal app.

## Features

- Magic link authentication
- Rate limiting and security headers
- Email validation and bot protection
- Token-based session management
- KV storage for tokens and rate limiting

## API Endpoints

### POST `/api/auth/request`

Request a magic link for authentication.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link sent to your email address"
}
```

**Rate Limits:**
- 3 requests per 5 minutes per IP
- 1 hour block after exceeding limit

### GET `/api/auth/verify?token=<token>`

Verify a magic link token.

**Response:**
- Web browsers: Redirects to app with token
- API clients: JSON response with token

```json
{
  "success": true,
  "token": "user_session_token",
  "email": "user@example.com"
}
```

### GET `/health`

Health check endpoint.

```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

## Security Features

- CORS protection
- Rate limiting with IP blocking
- Input validation and sanitization
- Bot detection and honeypot validation
- Secure token generation
- Email domain validation
- Security headers (CSP, HSTS, etc.)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Create KV namespaces:
```bash
wrangler kv:namespace create "AUTH_TOKENS"
wrangler kv:namespace create "AUTH_TOKENS" --preview
```

4. Add secrets:
```bash
wrangler secret put EMAIL_API_KEY
wrangler secret put JWT_SECRET
```

5. Start development server:
```bash
npm run dev
```

## Deployment

1. Update production KV namespace IDs in `wrangler.toml`

2. Deploy to production:
```bash
npm run deploy
```

3. Set production secrets:
```bash
wrangler secret put EMAIL_API_KEY --env production
wrangler secret put JWT_SECRET --env production
```

## Configuration

### Email Service

The worker supports various email services. Update `src/email.js` to use your preferred provider:

- Mailgun
- SendGrid
- Resend
- Postmark
- AWS SES

### Environment Variables

Set in Cloudflare dashboard or via wrangler:

- `EMAIL_API_KEY`: API key for email service
- `JWT_SECRET`: Secret for token signing
- `EMAIL_API_URL`: Email service endpoint (optional)

## Testing

Test the endpoints locally:

```bash
# Request magic link
curl -X POST http://localhost:8787/api/auth/request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check logs for magic link URL in development
```

## Monitoring

The worker includes comprehensive error logging and can be monitored via:

- Cloudflare Workers analytics
- `wrangler tail` for real-time logs
- Custom monitoring endpoints