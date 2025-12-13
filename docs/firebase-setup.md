# Firebase Authentication Setup Guide

This guide explains how to configure Firebase/Identity Platform authentication for Clausync.

---

## Prerequisites

- Google Cloud Platform account
- Firebase project (or GCP project with Identity Platform enabled)

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Create a project** (or use existing GCP project)
3. Follow the wizard to create your project

---

## Step 2: Enable Authentication Providers

1. In Firebase Console, go to **Authentication > Sign-in method**
2. Enable the following providers:

### Email/Password
- Click **Email/Password**
- Toggle **Enable** on
- Toggle **Email link (passwordless sign-in)** off (unless you want it)
- Click **Save**

### Google
- Click **Google**
- Toggle **Enable** on
- Enter your **Project support email**
- Click **Save**

### Microsoft (Coming Soon)
- Will be implemented in a future release
- When ready, click **Microsoft** and follow the OAuth setup

---

## Step 3: Get Firebase Web Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Under **Your apps**, click **Add app** > **Web** (</> icon)
3. Register your app with a nickname (e.g., "Clausync Web")
4. Copy the `firebaseConfig` object values

You'll get something like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
};
```

---

## Step 4: Configure Frontend Environment

Create/update `apps/web-app/.env`:

```bash
# API Configuration
VITE_API_URL=http://localhost:8080

# Firebase Configuration (from Step 3)
VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123...
```

---

## Step 5: Configure Backend Environment

Update `apps/api/.env`:

```bash
# GCP Project ID (same as Firebase Project ID)
GCP_PROJECT_ID=your-project-id

# Identity Platform Audience (usually the GCP Project ID)
IDENTITY_PLATFORM_AUDIENCE=your-project-id

# Super Admin Emails (bypass email verification)
SUPER_ADMIN_EMAILS=admin@yourcompany.com,cto@yourcompany.com
```

---

## Step 6: Configure Authorized Domains

1. In Firebase Console, go to **Authentication > Settings > Authorized domains**
2. Add your domains:
   - `localhost` (for development)
   - Your production domain (e.g., `app.clausync.io`)

---

## Step 7: Test the Setup

1. Start the backend:
   ```bash
   docker-compose up -d
   # or
   cd apps/api && npm run dev
   ```

2. Start the frontend:
   ```bash
   cd apps/web-app && npm run dev
   ```

3. Navigate to `http://localhost:5173/register`

4. Test registration flows:
   - **Google SSO**: Should redirect to Google, then to dashboard (auto-verified)
   - **Email/Password**: Should create account, send verification email, redirect to verify page

---

## Email Verification Behavior

| Sign-up Method | Verification Required | Backend Enforcement |
|----------------|----------------------|---------------------|
| Email/Password | ✅ Yes | ✅ 403 until verified |
| Google SSO | ❌ No (auto-verified) | ✅ Allowed |
| Microsoft SSO | ❌ No (auto-verified) | ✅ Allowed |
| Super Admin | ❌ Bypass | ✅ Allowed |

---

## Troubleshooting

### "Missing Firebase config" error
- Ensure all `VITE_FIREBASE_*` environment variables are set
- Restart the dev server after changing `.env`

### "Invalid token" in backend
- Check that `GCP_PROJECT_ID` matches your Firebase project ID
- Ensure `IDENTITY_PLATFORM_AUDIENCE` is set correctly

### Google sign-in popup closes immediately
- Add your domain to Firebase Authorized Domains
- Check browser console for CORS or popup-blocked errors

### "Email verification required" error (403)
- User needs to verify their email
- Check spam folder for verification email
- Use resend button on verify-email page

---

## Production Checklist

- [ ] All Firebase config values set in production environment
- [ ] Production domain added to Authorized Domains
- [ ] `SUPER_ADMIN_EMAILS` set for initial admin access
- [ ] Email templates customized in Firebase Console
- [ ] Rate limiting configured in Firebase Console
