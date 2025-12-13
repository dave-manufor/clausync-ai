/**
 * Verify Email Page
 * 
 * Shown to users who have registered with email/password but haven't verified their email.
 * Provides resend verification email functionality.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, RefreshCw, Loader2, LogOut, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';

export function VerifyEmailPage() {
  const { user, resendVerificationEmail, signOut, isEmailVerified } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const navigate = useNavigate();

  // Automatically check verification status periodically
  useEffect(() => {
    if (!user) return;

    const checkVerification = async () => {
      try {
        // Reload the user to get latest email_verified status
        await user.reload();
        
        if (user.emailVerified) {
          // Force token refresh to get new claims
          await user.getIdToken(true);
          toast.success('Email verified! Redirecting...');
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking verification:', error);
      }
    };

    // Check immediately
    checkVerification();

    // Then check every 3 seconds
    const interval = setInterval(checkVerification, 3000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  // If user is verified, redirect to dashboard
  if (isEmailVerified) {
    navigate('/');
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendVerificationEmail();
      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      toast.error('Failed to send verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      // Reload user from Firebase to get latest email_verified status
      await user.reload();
      
      // Get the updated user (reload mutates in place but we need fresh reference)
      const currentUser = auth.currentUser;
      
      if (currentUser?.emailVerified) {
        // Force token refresh to get new token with email_verified: true
        await currentUser.getIdToken(true);
        toast.success('Email verified! Redirecting to dashboard...');
        navigate('/');
      } else {
        toast.error('Email not verified yet. Please check your inbox and click the verification link.');
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      toast.error('Failed to check verification status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#0a0520] to-[#0d0825]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            We've sent a verification email to:
            <br />
            <span className="font-medium text-white">{user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-surface-2 border border-border">
            <h3 className="font-medium mb-2">Next steps:</h3>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Open the email we sent you</li>
              <li>Click the verification link</li>
              <li>Come back here - we'll detect it automatically!</li>
            </ol>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleCheckVerification} 
              className="w-full"
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              I've verified my email
            </Button>

            <Button
              variant="outline"
              onClick={handleResend}
              disabled={isResending}
              className="w-full"
            >
              {isResending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Resend verification email
            </Button>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out and use a different account
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            We'll automatically detect when you verify. If it doesn't work, click the button above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
