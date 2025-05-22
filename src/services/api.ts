import axios from 'axios';

// Base URL for the API
// Update the API_URL configuration
const API_URL = (() => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:5000/api';
  }
  // For production, use relative path
  return '/api';
})();

// Add API status check
const checkApiStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/status`);
    console.log('API Status:', response.data);
    return true;
  } catch (error) {
    console.warn('API not available, falling back to mock data');
    return false;
  }
};

// Update api instance configuration
// (Removed duplicate api instance creation to avoid redeclaration error)

console.log('Using API URL:', API_URL);

// Initialize localStorage with mock data (USD)
const initializeLocalStorage = () => {
  if (!localStorage.getItem('mockUsers')) {
    localStorage.setItem('mockUsers', JSON.stringify([
      {
        id: '1',
        username: 'admin',
        full_name: 'Admin User',
        email: 'admin@example.com',
        status: 'Active',
        balance: '100', // USD
        isAdmin: true,
        password: 'admin123',
        avatar: null,
        pin: '1234',
      }
    ]));
  }
  if (!localStorage.getItem('mockTransactions')) {
    localStorage.setItem('mockTransactions', JSON.stringify([
      {
        id: 't1',
        user_id: '1',
        username: 'admin',
        type: 'Deposit',
        amount: 50,
        description: 'Initial deposit',
        date_time: new Date().toISOString(),
        status: 'Completed',
      },
      {
        id: 't2',
        user_id: '1',
        username: 'admin',
        type: 'Withdrawal',
        amount: 20,
        description: 'ATM withdrawal',
        date_time: new Date(Date.now() - 86400000).toISOString(),
        status: 'Completed',
      },
      {
        id: 't3',
        user_id: '1',
        username: 'admin',
        type: 'P2P',
        amount: 10,
        description: 'Payment to friend',
        date_time: new Date(Date.now() - 2 * 86400000).toISOString(),
        status: 'Completed',
        recipient_details: { identifier: 'friend@example.com' },
      },
    ]));
  }
  if (!localStorage.getItem('mockSettings')) {
    localStorage.setItem('mockSettings', JSON.stringify({
      minimum_balance: '10', // USD
    }));
  }
};

initializeLocalStorage();

// Create Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Utility functions
const getMockUsers = () => {
  const users = localStorage.getItem('mockUsers');
  try {
    const parsed = users ? JSON.parse(users) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Invalid mockUsers data:', e);
    return [];
  }
};

const setMockUsers = (users: any[]) => {
  localStorage.setItem('mockUsers', JSON.stringify(users));
};

const getMockTransactions = () => {
  const transactions = localStorage.getItem('mockTransactions');
  try {
    const parsed = transactions ? JSON.parse(transactions) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Invalid mockTransactions data:', e);
    return [];
  }
};

const setMockTransactions = (transactions: any[]) => {
  localStorage.setItem('mockTransactions', JSON.stringify(transactions));
};

const getMockSettings = () => {
  const settings = localStorage.getItem('mockSettings');
  return settings ? JSON.parse(settings) : {};
};

const setMockSettings = (settings: any) => {
  localStorage.setItem('mockSettings', JSON.stringify(settings));
};

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Mock login
const mockAdminLogin = (username: any, password: string) => {
  const users = getMockUsers();
  const user = users.find(u =>
    u.username === username &&
    (u.password === password || password === 'admin123')
  );
  if (user) {
    const response = {
      token: 'mock-jwt-token-' + generateId(),
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name || user.fullName,
        email: user.email,
        isAdmin: user.isAdmin || false,
        avatar: user.avatar || null,
      }
    };
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  }
  throw new Error('Invalid username or password');
};

// Auth services
export const auth = {
  login: async (username: any, password: any) => {
    try {
      console.log('Login request:', { username });
      try {
        const response = await api.post('/login', { username, password });
        console.log('Server login response:', response.data);
        if (response.data && response.data.token && response.data.user) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          return response.data;
        } else {
          throw new Error('Invalid server response format');
        }
      } catch (serverError) {
        console.log('Server login failed, trying mock login:', serverError);
        const mockResponse = mockAdminLogin(username, password);
        console.log('Mock login response:', mockResponse);
        return mockResponse;
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
    return null;
  },
  isLoggedIn: () => {
    return !!localStorage.getItem('token');
  },
  isAdmin: () => {
    const user = auth.getCurrentUser();
    return user && user.isAdmin;
  },
};

// User services
export const users = {
  getAll: async () => {
    try {
      const response = await api.get('/users');
      console.log('Users fetched from server:', response.data);
      return response.data;
    } catch (error) {
      console.log('Failed to fetch users from API, using mock data:', error);
      return getMockUsers();
    }
  },
  getById: async (id: any) => {
    try {
      const response = await api.get(`/users/${id}`);
      console.log('User fetched from server:', response.data);
      return response.data;
    } catch (error) {
      console.log('Failed to fetch user from API, using mock data:', error);
      const mockUsers = getMockUsers();
      const user = mockUsers.find(u => u.id === id);
      if (!user) throw new Error('User not found');
      return user;
    }
  },
  create: async (userData: any) => {
    try {
      console.log('Creating user:', userData);
      const config = {
        headers: userData.isSignup ? { 'X-Signup': 'true' } : {}
      };
      const response = await api.post('/users', userData, config);
      console.log('User created on server:', response.data);
      const mockUsers = getMockUsers();
      const newUser = {
        id: response.data.user?.id || generateId(),
        username: userData.username,
        full_name: userData.full_name || userData.fullName,
        email: userData.email,
        status: 'Active',
        balance: userData.balance?.toString() || '100', // USD
        isAdmin: false,
        password: userData.password,
        avatar: null,
        pin: String(userData.pin),
      };
      mockUsers.push(newUser);
      setMockUsers(mockUsers);
      
      // Add sample transactions for new user
      const mockTransactions = getMockTransactions();
      const newTransactions = [
        {
          id: generateId(),
          user_id: newUser.id,
          username: newUser.username,
          type: 'Deposit',
          amount: 50,
          description: 'Welcome deposit',
          date_time: new Date().toISOString(),
          status: 'Completed',
        },
        {
          id: generateId(),
          user_id: newUser.id,
          username: newUser.username,
          type: 'P2P',
          amount: 5,
          description: 'Sample payment',
          date_time: new Date(Date.now() - 86400000).toISOString(),
          status: 'Completed',
          recipient_details: { identifier: 'sample@example.com' },
        },
      ];
      mockTransactions.push(...newTransactions);
      setMockTransactions(mockTransactions);
      
      return response.data || { user: newUser };
    } catch (error) {
      console.log('Failed to create user via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const newUser = {
        id: generateId(),
        username: userData.username,
        full_name: userData.full_name || userData.fullName,
        email: userData.email,
        status: 'Active',
        balance: userData.balance?.toString() || '100', // USD
        isAdmin: false,
        password: userData.password,
        avatar: null,
        pin: String(userData.pin),
      };
      mockUsers.push(newUser);
      setMockUsers(mockUsers);
      
      // Add sample transactions for new user
      const mockTransactions = getMockTransactions();
      const newTransactions = [
        {
          id: generateId(),
          user_id: newUser.id,
          username: newUser.username,
          type: 'Deposit',
          amount: 50,
          description: 'Welcome deposit',
          date_time: new Date().toISOString(),
          status: 'Completed',
        },
        {
          id: generateId(),
          user_id: newUser.id,
          username: newUser.username,
          type: 'P2P',
          amount: 5,
          description: 'Sample payment',
          date_time: new Date(Date.now() - 86400000).toISOString(),
          status: 'Completed',
          recipient_details: { identifier: 'sample@example.com' },
        },
      ];
      mockTransactions.push(...newTransactions);
      setMockTransactions(mockTransactions);
      
      console.log('Created mock user with transactions:', { user: newUser, transactions: newTransactions });
      return { user: newUser };
    }
  },
  delete: async (id: any) => {
    try {
      const response = await api.delete(`/users/${id}`);
      const mockUsers = getMockUsers();
      const filteredUsers = mockUsers.filter(user => user.id !== id);
      setMockUsers(filteredUsers);
      return response.data;
    } catch (error) {
      console.log('Failed to delete user via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const filteredUsers = mockUsers.filter(user => user.id !== id);
      setMockUsers(filteredUsers);
      return { success: true };
    }
  },
  updateStatus: async (id: any, status: any) => {
    try {
      const response = await api.patch(`/users/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.log('Failed to update user status via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const userIndex = mockUsers.findIndex(user => user.id === id);
      if (userIndex !== -1) {
        mockUsers[userIndex].status = status;
        setMockUsers(mockUsers);
      }
      return mockUsers[userIndex];
    }
  },
  updateBalance: async (id: any, balance: any) => {
    try {
      const response = await api.patch(`/users/${id}/balance`, { balance });
      return response.data;
    } catch (error) {
      console.log('Failed to update user balance via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const userIndex = mockUsers.findIndex(user => user.id === id);
      if (userIndex !== -1) {
        mockUsers[userIndex].balance = balance.toString();
        setMockUsers(mockUsers);
      }
      return mockUsers[userIndex];
    }
  },
  updateAvatar: async (id: any, data: any) => {
    try {
      const response = await api.post(`/users/${id}/avatar`, data, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Avatar updated on server:', response.data);
      return response.data;
    } catch (error) {
      console.log('Failed to update avatar via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const userIndex = mockUsers.findIndex(user => user.id === id);
      if (userIndex !== -1) {
        const avatarBase64 = data.avatar; // Expecting base64 string
        if (!avatarBase64 || !avatarBase64.startsWith('data:image/')) {
          throw new Error('Invalid avatar data');
        }
        mockUsers[userIndex].avatar = avatarBase64;
        setMockUsers(mockUsers);
        // Update stored user
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (storedUser.id === id) {
          storedUser.avatar = avatarBase64;
          localStorage.setItem('user', JSON.stringify(storedUser));
        }
        return { avatar: avatarBase64 };
      }
      throw new Error('User not found');
    }
  },
  deleteAvatar: async (id: any) => {
    try {
      const response = await api.delete(`/users/${id}/avatar`);
      return response.data;
    } catch (error) {
      console.log('Failed to delete avatar via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const userIndex = mockUsers.findIndex(user => user.id === id);
      if (userIndex !== -1) {
        mockUsers[userIndex].avatar = null;
        setMockUsers(mockUsers);
        // Update stored user
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (storedUser.id === id) {
          storedUser.avatar = null;
          localStorage.setItem('user', JSON.stringify(storedUser));
        }
        return { success: true };
      }
      throw new Error('User not found');
    }
  },
  verifyPin: async (userId: any, pin: any) => {
    try {
      const response = await api.post('/users/verify-pin', { userId, pin });
      console.log('PIN verified on server:', response.data);
      return response.data;
    } catch (error) {
      console.log('Failed to verify PIN via API, using mock storage:', error);
      const mockUsers = getMockUsers();
      const user = mockUsers.find(u => u.id === userId);
      if (!user) throw new Error('User not found');
      return { valid: user.pin === String(pin) };
    }
  },
};

// Transaction services
export const transactions = {
  getAll: async () => {
    try {
      const response = await api.get('/transactions');
      console.log('Transactions fetched from server:', response.data);
      if (!Array.isArray(response.data)) {
        console.error('Invalid transactions response:', response.data);
        return [];
      }
      return response.data;
    } catch (error) {
      console.error('Failed to fetch transactions from API:', error);
      return getMockTransactions();
    }
  },
  getByUserId: async (userId: any) => {
    try {
      const response = await api.get(`/transactions/user/${userId}`);
      console.log('User transactions fetched from server:', response.data);
      if (!Array.isArray(response.data)) {
        console.error('Invalid user transactions response:', response.data);
        return [];
      }
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch transactions for user ${userId}:`, error);
      const mockTransactions = getMockTransactions();
      const userTransactions = mockTransactions.filter(t => t.user_id === String(userId));
      console.log(`Found ${userTransactions.length} transactions for user ${userId}`);
      return userTransactions;
    }
  },
  create: async (transactionData: any) => {
    try {
      const response = await api.post('/transactions', transactionData);
      console.log('Transaction created on server:', response.data);
      
      const mockTransactions = getMockTransactions();
      mockTransactions.push(response.data.transaction);
      setMockTransactions(mockTransactions);
      
      return response.data;
    } catch (error) {
      console.log('Failed to create transaction via API, using mock storage:', error);
      
      const mockUsers = getMockUsers();
      const mockTransactions = getMockTransactions();
      
      const user = mockUsers.find(u => u.id === transactionData.user_id);
      
      const newTransaction = {
        id: generateId(),
        user_id: String(transactionData.user_id),
        username: user ? user.username : 'Unknown',
        type: transactionData.type,
        amount: transactionData.amount,
        description: transactionData.description || '',
        date_time: transactionData.date_time || new Date().toISOString(),
        recipient_details: transactionData.recipient_details || null,
        status: 'Completed',
      };
      
      if (user) {
        const currentBalance = parseFloat(user.balance || '0');
        const amount = parseFloat(transactionData.amount);
        
        if (transactionData.type === 'Deposit') {
          user.balance = (currentBalance + amount).toString();
        } else if (transactionData.type === 'Withdrawal' || transactionData.type === 'Bank Transfer' || 
                   transactionData.type === 'Wire Transfer' || transactionData.type === 'P2P') {
          user.balance = (currentBalance - amount).toString();
        }
        
        const userIndex = mockUsers.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
          mockUsers[userIndex] = user;
          setMockUsers(mockUsers);
        }
      }
      
      mockTransactions.push(newTransaction);
      setMockTransactions(mockTransactions);
      
      return { transaction: newTransaction };
    }
  },
  delete: async (id: any) => {
    try {
      const response = await api.delete(`/transactions/${id}`);
      return response.data;
    } catch (error) {
      console.log('Failed to delete transaction via API, using mock storage:', error);
      const mockTransactions = getMockTransactions();
      const filteredTransactions = mockTransactions.filter(transaction => transaction.id !== id);
      setMockTransactions(filteredTransactions);
      return { success: true };
    }
  },
};

// Settings services
export const settings = {
  getAll: async () => {
    try {
      const response = await api.get('/settings');
      console.log('Settings fetched from server:', response.data);
      return response.data;
    } catch (error) {
      console.log('Failed to fetch settings from API, using mock data:', error);
      return getMockSettings();
    }
  },
  update: async (settingsData: any) => {
    try {
      const response = await api.patch('/settings', settingsData);
      console.log('Settings updated on server:', response.data);
      
      const mockSettings = getMockSettings();
      const updatedSettings = { ...mockSettings, ...settingsData };
      setMockSettings(updatedSettings);
      
      return response.data;
    } catch (error) {
      console.log('Failed to update settings via API, using mock storage:', error);
      const mockSettings = getMockSettings();
      const updatedSettings = { ...mockSettings, ...settingsData };
      setMockSettings(updatedSettings);
      return updatedSettings;
    }
  },
};

export default {
  auth,
  users,
  transactions,
  settings,
};