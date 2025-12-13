/**
 * Protected Route Component
 * 
 * Guards routes that require authentication.
 * Redirects to login if not authenticated.
 * Redirects to verify-email if email not verified (email/password users only).
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const { isAuthenticated, loading, requiresVerification } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to verify email page if verification required
  if (requiresVerification) {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  // Render protected content
  return <Outlet />;
}

/**
 * Auth Redirect Component
 * 
 * Redirects authenticated users away from auth pages (login, register).
 * Useful to prevent already logged-in users from seeing login forms.
 */
export function AuthRedirect() {
  const { isAuthenticated, loading, requiresVerification } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If authenticated but needs verification, go to verify page
  if (isAuthenticated && requiresVerification) {
    return <Navigate to="/verify-email" replace />;
  }

  // If authenticated and verified, go to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Not authenticated, render auth page
  return <Outlet />;
}
