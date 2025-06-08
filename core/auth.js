import { config, buildApiUrl } from './config.js';
import { db } from './db.js';

// Token management
const TOKEN_KEY = 'stillmind_auth_token';
const USER_KEY = 'stillmind_user';

export class AuthService {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
    this.user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Get auth token for API requests
  getToken() {
    return this.token;
  }

  // Request magic link
  async requestMagicLink(email) {
    try {
      const response = await fetch(buildApiUrl('/auth/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send magic link');
      }

      return data;
    } catch (error) {
      console.error('Magic link request failed:', error);
      throw error;
    }
  }

  // Handle auth callback
  async handleAuthCallback() {
    // Check for auth token in URL
    const hash = window.location.hash;
    const match = hash.match(/auth-success\?token=([^&]+)/);
    
    if (!match) {
      return false;
    }

    const token = match[1];
    
    // Store token and user info
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
    
    // Decode JWT to get user info (basic decode, validation happens server-side)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.user = {
        id: payload.userId,
        email: payload.email
      };
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    } catch (error) {
      console.error('Failed to decode token:', error);
    }
    
    // Clean up URL
    window.location.hash = '#today';
    
    return true;
  }

  // Logout
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Clear any cached data
    db.clearUserData().catch(console.error);
    
    // Redirect to home
    window.location.hash = '#today';
  }

  // Make authenticated API request
  async authenticatedFetch(url, options = {}) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.token}`
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle token expiration
    if (response.status === 401 || response.status === 403) {
      this.logout();
      throw new Error('Session expired. Please login again.');
    }

    return response;
  }
}

// Create singleton instance
export const auth = new AuthService();

// Handle auth callback on page load
if (window.location.hash.includes('auth-success')) {
  auth.handleAuthCallback();
}