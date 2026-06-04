import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// In production, this uses Application Default Credentials (ADC)
// In development, it can use a service account key file via GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  });
}

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '').split(',').filter(Boolean);

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  signInProvider?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to verify Firebase ID tokens.
 * In development with emulator, falls back to mock user if no token.
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // Development fallback: allow requests without auth in dev mode
    // if (process.env.NODE_ENV === 'development' || process.env.PUBSUB_EMULATOR_HOST) {
    //   req.user = { 
    //     uid: 'dev-user-001', 
    //     email: 'dev@localhost',
    //     emailVerified: true,
    //     signInProvider: 'password',
    //   };
    //   return next();
    // }
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      emailVerified: decodedToken.email_verified ?? false,
      signInProvider: decodedToken.firebase?.sign_in_provider || 'password',
    };

    next();
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to require email verification.
 * - Super admins bypass verification check
 * - SSO users (google.com, microsoft.com) bypass verification check
 * - Email/password users MUST be verified
 */
export const requireEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Super admins bypass verification
  if (SUPER_ADMIN_EMAILS.includes(user.email)) {
    return next();
  }

  // SSO providers are automatically verified
  const ssoProviders = ['google.com', 'microsoft.com', 'oidc.'];
  const isSSO = ssoProviders.some(provider => 
    user.signInProvider?.includes(provider)
  );

  if (isSSO) {
    return next();
  }

  // Email/password users must be verified
  if (!user.emailVerified) {
    res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before continuing.',
    });
    return;
  }

  next();
};
