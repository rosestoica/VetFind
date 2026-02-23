import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '../services/api';
import {
  User,
  AuthContextType,
  LoginCredentials,
  SignupData
} from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  LOGIN_ERROR: 'vetfind_loginError'
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      return window.sessionStorage.getItem(STORAGE_KEYS.LOGIN_ERROR);
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user && !!accessToken;
  const clearLoginError = () => {
    setLoginError(null);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try { window.sessionStorage.removeItem(STORAGE_KEYS.LOGIN_ERROR); } catch (_) {}
    }
  };

  // Check authentication on app startup
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Load tokens and user data from storage
      const [storedAccessToken, storedRefreshToken, storedUserData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA)
      ]);

      if (!storedAccessToken || !storedRefreshToken || !storedUserData) {
        console.log('No stored auth data found, user is not authenticated');
        setIsLoading(false);
        return;
      }

      const userData = JSON.parse(storedUserData);

      // Verify access token with backend (with timeout)
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth verification timeout')), 5000)
        );

        const verifiedUser = await Promise.race([
          ApiService.verifyToken(storedAccessToken),
          timeoutPromise
        ]);

        // Token is valid, restore auth state
        setUser(verifiedUser as any);
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        console.log('Auth verified successfully');
        setIsLoading(false);
      } catch (error) {
        console.log('Auth verification failed:', error);
        // Access token invalid or timeout, try to refresh
        try {
          const tokens = await ApiService.refreshToken(storedRefreshToken);

          // Store new tokens
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
            AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
          ]);

          // Verify new access token
          const verifiedUser = await ApiService.verifyToken(tokens.accessToken);

          setUser(verifiedUser);
          setAccessToken(tokens.accessToken);
          setRefreshToken(tokens.refreshToken);
          console.log('Token refreshed successfully');
          setIsLoading(false);
        } catch (refreshError) {
          console.log('Token refresh failed:', refreshError);
          // Both tokens invalid, clear everything
          await clearAuthData();
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await clearAuthData();
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);

      const response = await ApiService.login(credentials);

      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken),
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user))
      ]);

      // Also store in localStorage for web compatibility
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem('userData', JSON.stringify(response.user));
      }

      setLoginError(null);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try { window.sessionStorage.removeItem(STORAGE_KEYS.LOGIN_ERROR); } catch (_) {}
      }
      // Set user state first, then loading state
      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      
      // Small delay to ensure state is propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsLoading(false);
    } catch (error: any) {
      console.error('Login failed:', error);
      const msg = error?.message ?? 'Login failed';
      setLoginError(msg);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try { window.sessionStorage.setItem(STORAGE_KEYS.LOGIN_ERROR, msg); } catch (_) {}
      }
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (data: SignupData) => {
    try {
      setIsLoading(true);

      const response = await ApiService.signup(data);

      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken),
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user))
      ]);

      // Also store in localStorage for web compatibility
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem('userData', JSON.stringify(response.user));
      }

      // Set user state first, then loading state
      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      
      // Small delay to ensure state is propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsLoading(false);
    } catch (error) {
      console.error('Signup failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await clearAuthData();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateUser = async (data: Partial<User>): Promise<User> => {
    if (!user) throw new Error('Not authenticated');
    if (!accessToken) throw new Error('No access token available');

    try {
      setIsLoading(true);
      const updated = await ApiService.updateUser(user.id, data, accessToken);

      // Persist updated user
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updated)),
      ]);
      if (typeof window !== 'undefined') {
        localStorage.setItem('userData', JSON.stringify(updated));
      }

      setUser(updated);
      setIsLoading(false);
      return updated;
    } catch (error) {
      console.error('Update user failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const tokens = await ApiService.refreshToken(refreshToken);

      // Store new tokens
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
      ]);

      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      await clearAuthData();
      throw error;
    }
  };

  const clearAuthData = async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA)
    ]);

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    isAuthenticated,
    loginError,
    clearLoginError,
    login,
    signup,
    updateUser,
    logout,
    refreshAccessToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
