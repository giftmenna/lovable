import axios from 'axios';

// Base URL configuration - use Vite proxy in development
const API_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api');

// Configure a reusable axios instance with sensible defaults
// including JSON content‑type and a timeout.  `withCredentials: true`
// tells axios to send cookies automatically, which we’ll rely on when
// the server sets an httpOnly cookie on login.
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
  validateStatus: (status) => status < 500,
});

// Global response interceptor for error handling.  If a 401 is
// encountered we redirect to the login page.  All other errors are
// logged and rethrown.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

// User model/type definition
export type User = {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  full_name?: string;
  status?: string;
  balance?: number;
  // Add other fields as needed
};

/**
 * Authentication API methods.  Note that the login method relies
 * on the server to set a httpOnly cookie containing the JWT token.
 * Because `withCredentials: true` is set on our axios instance,
 * subsequent requests will automatically include the cookie and
 * authenticate the user.  No token is stored in localStorage or
 * sessionStorage on the client.
 */
export const auth = {
  login: async (username: string, password: string) => {
    try {
      console.log('🔍 [FRONTEND] Login attempt for:', username);
      const response = await api.post('/login', { username, password });
      // The backend returns the user object and sets a cookie.  We
      // return the response data to the caller so they can obtain
      // information about the logged in user if needed.
      return response.data;
    } catch (error: any) {
      console.error('❌ [FRONTEND] Login error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Login failed. Please try again.');
    }
  },

  logout: async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/me');
      return response.data.user;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      throw error;
    }
  },

  isLoggedIn: async () => {
    try {
      const response = await api.get('/session');
      return response.data.isLoggedIn;
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  },

  updateUser: async (userId: string, updates: Partial<User>) => {
    try {
      const response = await api.patch(`/users/${userId}`, updates);
      return response.data.user;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  },
};

/**
 * User management API methods.  The `create` function supports both
 * public sign‑up and admin‑only user creation.  If the caller sets
 * `isSignup: true` on the payload, the request will be sent to
 * `/api/signup`, which is unauthenticated and inserts a new user
 * record.  Otherwise, it sends a POST to `/api/users`, which is
 * protected by the admin token.
 */
export const users = {
  create: async (userData: any) => {
    try {
      const isSignup = userData.isSignup;
      if (isSignup) {
        // Remove the marker from the payload and convert camelCase
        // fields to snake_case as the server expects.  E.g. `fullName`
        // becomes `full_name`.
        delete userData.isSignup;
        if (userData.fullName && !userData.full_name) {
          userData.full_name = userData.fullName;
          delete userData.fullName;
        }
        const response = await axios.post(`${API_URL}/signup`, userData, {
          headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
      }
      // Admin creation requires authentication.  Use the shared
      // axios instance so cookies are attached.
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create user:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create user');
    }
  },

  getAll: async () => {
    try {
      const response = await api.get('/users');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  },

  delete: async (userId: string) => {
    try {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  },

  updateStatus: async (userId: string, status: string) => {
    try {
      const response = await api.patch(`/users/${userId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Failed to update user status:', error);
      throw error;
    }
  },

  updateBalance: async (userId: string, balance: number) => {
    try {
      const response = await api.patch(`/users/${userId}/balance`, { balance });
      return response.data;
    } catch (error) {
      console.error('Failed to update user balance:', error);
      throw error;
    }
  },

  /**
   * Fetch a single user by ID.  Requires authentication.  Returns
   * public user fields (no password).
   */
  getById: async (userId: string) => {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user by ID:', error);
      throw error;
    }
  },

  /**
   * Update a user's avatar.  Expects an object with `avatar` property
   * containing base64 image data.  Returns updated avatar.
   */
  updateAvatar: async (userId: string, data: { avatar: string }) => {
    try {
      console.log('🔄 [FRONTEND] Updating avatar for user:', userId);
      const response = await api.patch(`/users/${userId}/avatar`, data);
      console.log('✅ [FRONTEND] Avatar update response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [FRONTEND] Failed to update avatar:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to update avatar');
    }
  },

  /**
   * Delete a user's avatar.  Returns a success message.
   */
  deleteAvatar: async (userId: string) => {
    try {
      const response = await api.delete(`/users/${userId}/avatar`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete avatar:', error);
      throw error;
    }
  },
};

/**
 * Transactions API methods.  All requests are authenticated via
 * cookies set on login.
 */
export const transactions = {
  getAll: async () => {
    try {
      const response = await api.get('/transactions');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  },

  create: async (transactionData: any) => {
    try {
      const response = await api.post('/transactions', transactionData);
      return response.data;
    } catch (error) {
      console.error('Failed to create transaction:', error);
      throw error;
    }
  },

  delete: async (id: string) => {
    try {
      const response = await api.delete(`/transactions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      throw error;
    }
  },

  /**
   * Fetch transactions belonging to a specific user.  Admins can
   * request any user’s transactions; regular users can only request
   * their own.  Returns an array of transaction records.
   */
  getByUserId: async (userId: string) => {
    try {
      const response = await api.get(`/users/${userId}/transactions`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch transactions for user:', error);
      throw error;
    }
  },
};

/**
 * Settings API methods.
 */
export const settings = {
  getAll: async () => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      throw error;
    }
  },

  update: async (settingsData: any) => {
    try {
      const response = await api.patch('/settings', settingsData);
      return response.data;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },
};

export default {
  auth,
  users,
  settings,
  transactions,
  baseURL: API_URL,
};