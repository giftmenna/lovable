import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  avatar?: string; // Added avatar property as optional
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  isAdmin: boolean;
  updateCurrentUser: (user: User) => void; // <-- Add this
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => ({}),
  logout: () => {},
  isAdmin: false,
  updateCurrentUser: () => {}, // <-- Add this
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Enhanced user session check on app initialization
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        // Check if user is already logged in
        const user = auth.getCurrentUser();
        
        if (user) {
          console.log('Found user in localStorage:', user);
          setCurrentUser(user);
        } else {
          console.log('No user found in localStorage');
        }
      } catch (err) {
        console.error('Authentication check error:', err);
        // Handle invalid tokens by logging out
        auth.logout();
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      console.log('Attempting login for user:', username);
      
      const response = await auth.login(username, password);
      
      // Check if we have a response and it contains a user object
      if (response && response.user) {
        console.log('Login successful:', response);
        setCurrentUser(response.user);
        
        const displayName = response.user.fullName || response.user.username;
        toast.success(`Welcome back, ${displayName}!`);
        
        // Add a slight delay before redirecting to allow toast to be seen
        setTimeout(() => {
          if (response.user.isAdmin) {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }, 500);
        
        return response;
      } else {
        console.error('Invalid login response structure:', response);
        throw new Error('Invalid login response structure');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please try again.';
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    auth.logout();
    setCurrentUser(null);
    toast.info('You have been logged out.');
    navigate('/login');
  };

  // Add this function to allow updating the user from anywhere (e.g., avatar)
  const updateCurrentUser = (user: User) => {
    setCurrentUser(user);
    // Optionally update localStorage or wherever your auth.getCurrentUser() reads from
    localStorage.setItem('user', JSON.stringify(user));
  };

  const value = {
    currentUser,
    loading,
    login,
    logout,
    isAdmin: currentUser?.isAdmin || false,
    updateCurrentUser, // <-- Add this
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};