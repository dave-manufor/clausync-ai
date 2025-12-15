/**
 * Authentication Hook
 * 
 * Provides Firebase authentication methods and state management.
 * Implements email/password and Google SSO authentication.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendResetEmail,
  confirmPasswordReset as firebaseConfirmReset,
  sendEmailVerification,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User, UserCredential } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuthStore } from '@/stores';
import { setAuthToken, clearAuthToken } from '@/lib/api-client';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface UseAuthReturn extends AuthState {
  // Email/Password
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signUp: (email: string, password: string) => Promise<UserCredential>;
  
  // SSO
  signInWithGoogle: () => Promise<UserCredential>;
  // TODO: Implement Microsoft SSO later
  // signInWithMicrosoft: () => Promise<UserCredential>;
  
  // Account management
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  
  // State
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  requiresVerification: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { setUser: setStoreUser, clearUser } = useAuthStore();

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // Get ID token and store it
        try {
          const token = await firebaseUser.getIdToken();
          setAuthToken(token);
          setStoreUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            emailVerified: firebaseUser.emailVerified,
          });
        } catch (err) {
          console.error('Failed to get ID token:', err);
        }
      } else {
        clearAuthToken();
        clearUser();
      }
    });

    return () => unsubscribe();
  }, [setStoreUser, clearUser]);

  // Refresh token periodically (tokens expire after 1 hour)
  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      try {
        const token = await user.getIdToken(true); // Force refresh
        setAuthToken(token);
      } catch (err) {
        console.error('Token refresh failed:', err);
      }
    };

    // Refresh every 55 minutes
    const interval = setInterval(refreshToken, 55 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const signIn = useCallback(async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Send verification email for email/password signups
      if (result.user) {
        await sendEmailVerification(result.user);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<UserCredential> => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Google SSO users are automatically verified
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      clearAuthToken();
      clearUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    }
  }, [clearUser]);

  const sendPasswordResetEmail = useCallback(async (email: string): Promise<void> => {
    setError(null);
    try {
      await firebaseSendResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    }
  }, []);

  const confirmPasswordReset = useCallback(async (oobCode: string, newPassword: string): Promise<void> => {
    setError(null);
    try {
      await firebaseConfirmReset(auth, oobCode, newPassword);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    setError(null);
    if (!user) {
      throw new Error('No user logged in');
    }
    try {
      await sendEmailVerification(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    }
  }, [user]);

  // Computed state
  const isAuthenticated = !!user;
  const isEmailVerified = user?.emailVerified ?? false;
  
  // User requires verification if:
  // 1. They are authenticated
  // 2. They are NOT verified
  // 3. They signed up with email/password (not SSO)
  const isEmailPasswordUser = user?.providerData.some(
    p => p.providerId === 'password'
  ) ?? false;
  const requiresVerification = isAuthenticated && !isEmailVerified && isEmailPasswordUser;

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    sendPasswordResetEmail,
    confirmPasswordReset,
    resendVerificationEmail,
    isAuthenticated,
    isEmailVerified,
    requiresVerification,
  };
}
