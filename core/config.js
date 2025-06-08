// Configuration for StillMind app
export const config = {
  // API endpoint - uses relative URL to work with nginx proxy
  API_BASE_URL: '/api',
  
  // Authentication endpoints
  AUTH_REQUEST_URL: '/api/auth/request',
  AUTH_VERIFY_URL: '/api/auth/verify',
  
  // Entries endpoints
  ENTRIES_URL: '/api/entries',
  
  // Sync settings
  SYNC_ENABLED: true,
  SYNC_INTERVAL: 30000, // 30 seconds
  
  // Development mode
  isDevelopment: window.location.hostname === 'localhost',
  
  // Feature flags
  features: {
    cloudSync: true,
    offlineMode: true,
    encryption: false // Can be enabled later
  }
};

// Helper function to build API URLs
export function buildApiUrl(path) {
  return `${config.API_BASE_URL}${path}`;
}