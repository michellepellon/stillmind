# StillMind - Technical Specification

## Overview

StillMind is a minimalist meditation journal Progressive Web App (PWA) built 
with pure vanilla JavaScript, ES modules, and no build process. This 
specification details the technical implementation based on the design document 
and our planning session.

## Technology Stack

### Frontend
- **Language**: Vanilla JavaScript with ES Modules
- **Build Process**: None - pure ES modules served directly
- **Styling**: Pure CSS with CSS custom properties
- **Framework**: No framework - vanilla JS only
- **Module Structure**: Feature-based organization

### PWA Infrastructure  
- **Service Worker**: Cache-first strategy
- **Manifest**: Standard web app manifest
- **Icons**: Multiple sizes for all platforms
- **Offline**: Full offline functionality

### Data Layer
- **Local Storage**: Pure IndexedDB (no wrappers)
- **Data Sync**: Optional via REST API
- **Encryption**: Client-side encryption for cloud backup

### Backend (Optional - for sync only)
- **Hosting**: Cloudflare Pages (static) + Workers (API)
- **API**: Minimal REST endpoints
- **Authentication**: Magic link email
- **Database**: Cloudflare KV or D1 for user data

## Architecture

### File Structure
```
/
├── index.html
├── manifest.json
├── sw.js                 # Service worker
├── app.js               # Main application entry
├── router.js            # Hash-based routing
├── 
├── features/
│   ├── today/
│   │   ├── today.js
│   │   └── today.css
│   ├── write/
│   │   ├── write.js  
│   │   └── write.css
│   └── history/
│       ├── history.js
│       └── history.css
├── 
├── core/
│   ├── db.js           # IndexedDB abstraction
│   ├── auth.js         # Magic link auth
│   ├── sync.js         # Cloud sync logic
│   └── crypto.js       # Encryption utilities
├── 
├── shared/
│   ├── styles/
│   │   ├── base.css    # Reset and base styles
│   │   ├── theme.css   # CSS custom properties
│   │   └── utils.css   # Utility classes
│   └── components/
│       ├── button.js
│       └── textarea.js
└── assets/
    └── icons/
```

### URL Structure
- `/#today` - Home screen with prompt and quick start
- `/#write` - Journal writing interface  
- `/#history` - Browse past entries
- `/#entry/[timestamp]` - View specific entry

### Data Schema

#### IndexedDB Structure
```javascript
// Database: SettleDB
// Version: 1

// Object Store: entries
{
  timestamp: Date.now(),        // Primary key
  duration: 15,                 // Minutes (nullable)
  entry: "Today I noticed...",  // Journal text
  promptId: "prompt_001",       // Optional prompt ID
  wordCount: 127,              // Auto-calculated
  syncStatus: "local",         // local|synced|pending
  lastModified: Date.now()
}

// Object Store: settings  
{
  key: "user_email",           // Primary key
  value: "user@example.com"
}

// Object Store: sync_meta
{
  id: "last_sync",
  timestamp: Date.now(),
  status: "success"
}
```

## Core Features Implementation

### 1. Service Worker (sw.js)
```javascript
// Cache-first strategy with elegant fallbacks
const CACHE_NAME = 'settle-v1';
const urlsToCache = [
  '/',
  '/app.js',
  '/features/today/today.js',
  '/features/write/write.js', 
  '/features/history/history.js',
  // ... all static assets
];

// Install, activate, and fetch handlers
// Cache-first for all static assets
// Network-only for API calls
```

### 2. Database Layer (core/db.js)
```javascript
// Minimal IndexedDB wrapper
export class StillMindDB {
  async init() { /* Open database */ }
  async saveEntry(entry) { /* Save with auto-timestamp */ }
  async getEntries(limit, offset) { /* Paginated retrieval */ }
  async getEntry(timestamp) { /* Single entry */ }
  async updateSyncStatus(timestamp, status) { /* Sync tracking */ }
}
```

### 3. Writing Interface (features/write/write.js)

#### Auto-expanding Textarea
- Initial height: 3 lines
- Grows with content (no max height)
- Smooth expansion animation (200ms)
- No scrollbar until necessary

#### Auto-save Logic  
- Debounced save every 2 seconds of inactivity
- Visual pulse on save (opacity animation)
- "Last saved just now" indicator
- Relative time updates ("a minute ago")

#### Duration Selection
- Shows after writing, not before
- Preset buttons: 5, 10, 15, 20, 30, ...
- Custom input revealed by "..." button
- Optional - can navigate away without selecting

### 4. Authentication Flow (core/auth.js)

#### Magic Link Implementation
1. User enters email
2. POST to `/api/auth/request-link`
3. Server sends email with token
4. User clicks link → `/#auth/[token]`
5. Token validated → Store email in IndexedDB
6. Enable sync features

#### Privacy Features
- No account creation
- No passwords stored
- No personal data beyond email
- Can use app fully without auth

### 5. Encryption (core/crypto.js)

#### Client-side Encryption
```javascript
// Key derivation
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await deriveKey(email + salt);

// Encrypt before sync
const encrypted = await encrypt(journalEntry, key);

// Decrypt after retrieval  
const decrypted = await decrypt(encryptedData, key);
```

### 6. Sync Logic (core/sync.js)

#### Sync Strategy
- Manual sync by default
- Queue changes when offline
- Conflict resolution: Last write wins
- Sync indicator: Subtle status text

## API Specification

### Base URL
`https://api.stillmind.app`

### Endpoints

#### POST /auth/request
```json
Request:
{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "message": "Check your email"
}
```

#### POST /auth/verify
```json
Request:
{
  "token": "abc123..."
}

Response:
{
  "success": true,
  "email": "user@example.com",
  "sessionToken": "xyz789..."
}
```

#### GET /entries
```json
Headers: {
  "Authorization": "Bearer [sessionToken]"
}

Response:
{
  "entries": [
    {
      "timestamp": 1234567890,
      "encrypted": "base64...",
      "salt": "base64..."
    }
  ],
  "lastSync": 1234567890
}
```

#### POST /entries
```json
Headers: {
  "Authorization": "Bearer [sessionToken]"
}

Request:
{
  "entries": [
    {
      "timestamp": 1234567890,
      "encrypted": "base64...",
      "salt": "base64..."
    }
  ]
}

Response:
{
  "success": true,
  "synced": 1
}
```

## User Interface Components

### Base Styles (shared/styles/base.css)
```css
:root {
  /* Color Palette */
  --color-charcoal: #2a2a2a;
  --color-medium-gray: #666666;
  --color-light-gray: #999999;
  --color-off-white: #fefefe;
  --color-white: #ffffff;
  --color-subtle-gray: #f5f5f5;
  --color-border: #e5e5e5;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --line-height: 1.6;
  --letter-spacing-heading: 3px;
}
```

### Component Patterns

#### Ghost Button
```css
.button {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 24px;
  padding: var(--space-md) var(--space-lg);
  transition: transform 200ms ease-out;
}

.button:hover {
  transform: scale(1.02);
}
```

#### Auto-expanding Textarea
```javascript
// features/write/write.js
const textarea = document.querySelector('.journal-input');

textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
```

## Performance Requirements

### Core Web Vitals Targets
- **FCP**: < 1.5s
- **LCP**: < 2.5s  
- **FID**: < 100ms
- **CLS**: < 0.1

### Optimization Strategies
1. Inline critical CSS
2. Lazy load features on route change
3. Preload next likely route
4. Use CSS containment for long lists
5. Virtual scrolling for history view

### Lighthouse CI Configuration
```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v8
  with:
    urls: |
      http://localhost:8080
      http://localhost:8080/#write
      http://localhost:8080/#history
    uploadArtifacts: true
    temporaryPublicStorage: true
```

## Error Handling

### Silent Fallbacks
- Network failures → Continue offline
- Sync conflicts → Last write wins
- IndexedDB quota → Inform gently

### User-Facing Messages
```javascript
// Gentle, calm language
const messages = {
  offline: "Your thoughts are saved locally",
  syncError: "We'll sync when you're ready", 
  quotaExceeded: "Your journal is getting full"
};
```

## Security Considerations

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               style-src 'self' 'unsafe-inline';
               connect-src 'self' https://api.settle.io">
```

### Privacy Measures
1. No analytics without consent
2. No third-party scripts
3. All data encrypted before leaving device
4. No cookies beyond session
5. Clear data ownership

## Launch Checklist

### Pre-launch
- [ ] All Lighthouse scores green
- [ ] PWA installable on all platforms
- [ ] Offline mode fully functional
- [ ] Encryption verified secure
- [ ] WCAG 2.1 AA compliance confirmed

### Performance Validation  
- [ ] FCP < 1.5s on 3G
- [ ] No JavaScript errors in console
- [ ] Service worker caches all assets
- [ ] Images optimized and lazy loaded

### Security Validation
- [ ] CSP headers configured
- [ ] HTTPS enforced
- [ ] API rate limiting enabled
- [ ] Input sanitization complete

## Development Workflow

### Local Development
```bash
# No build needed - just serve files
python -m http.server 8080
# or
npx serve .
```

### Deployment
```bash
# Cloudflare Pages
git push origin main
# Automatic deployment via Cloudflare
```

### Environment Variables
```javascript
// Cloudflare Workers environment
API_URL = "https://api.settle.io"
SMTP_ENDPOINT = "https://api.mailgun.net/v3"
KV_NAMESPACE = "SETTLE_USERS"
```

## Future Enhancements (Post-MVP)

### Version 1.1
- Export journal as markdown/PDF
- Search within entries
- Keyboard shortcuts
- Additional writing prompts

### Version 1.2  
- Meditation timer integration
- Gentle reminder notifications
- Entry templates
- Multiple journals

### Never Implement
- Social features
- Gamification/streaks  
- Advertisements
- Complex customization
- Account requirements

---

This specification provides a complete blueprint for implementing StillMind 
while maintaining its core philosophy of simplicity, privacy, and mindful 
design. Every technical decision reinforces the product's mission to create 
a sanctuary for meditation practitioners in the digital world.
