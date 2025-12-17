/**
 * Firebase Configuration
 * 
 * This file initializes Firebase for authentication.
 * Configure the environment variables in .env file.
 */
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider,
  connectAuthEmulator,
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate required config
const requiredKeys = ['apiKey', 'authDomain', 'projectId'] as const;
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0 && import.meta.env.PROD) {
  throw new Error(`Missing Firebase config: ${missingKeys.join(', ')}`);
}

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Connect to emulator in development if configured
  if (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST) {
    connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST);
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

// Auth providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// TODO: Implement Microsoft SSO later
// import { OAuthProvider } from 'firebase/auth';
// export const microsoftProvider = new OAuthProvider('microsoft.com');
// microsoftProvider.setCustomParameters({
//   prompt: 'select_account',
//   tenant: 'common', // or specific tenant ID
// });

export { app, auth };
export default app;
