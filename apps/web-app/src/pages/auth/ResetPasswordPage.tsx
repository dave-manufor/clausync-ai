import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Mail, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@clausync/ui'
import { Input } from '@clausync/ui'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@clausync/ui'
import { useAuth } from '@/hooks/useAuth'

// Schema for requesting reset email
const requestResetSchema = z.object({
  email: z.string().email('Please enter a valid email'),
})

// Schema for setting new password
const newPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RequestResetForm = z.infer<typeof requestResetSchema>
type NewPasswordForm = z.infer<typeof newPasswordSchema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const oobCode = searchParams.get('oobCode')
  
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [passwordReset, setPasswordReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const { sendPasswordResetEmail, confirmPasswordReset } = useAuth()

  // Form for requesting reset email
  const requestForm = useForm<RequestResetForm>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: '' },
  })

  // Form for setting new password
  const passwordForm = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  // Handle request for reset email
  async function onRequestReset(data: RequestResetForm) {
    setIsLoading(true)
    setError(null)
    try {
      await sendPasswordResetEmail(data.email)
      setEmailSent(true)
    } catch {
      // Don't reveal if email exists - always show success for security
      setEmailSent(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle setting new password
  async function onSetNewPassword(data: NewPasswordForm) {
    if (!oobCode) return
    
    setIsLoading(true)
    setError(null)
    try {
      await confirmPasswordReset(oobCode, data.password)
      setPasswordReset(true)
    } catch (err: any) {
      // Handle specific Firebase errors
      if (err.code === 'auth/expired-action-code') {
        setError('This password reset link has expired. Please request a new one.')
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This password reset link is invalid. Please request a new one.')
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.')
      } else {
        setError('An error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Password reset success view
  if (passwordReset) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-safe/10 mx-auto">
          <CheckCircle className="h-8 w-8 text-safe" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Password reset successful</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Your password has been changed. You can now sign in with your new password.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  // If we have an oobCode, show the new password form
  if (oobCode) {
    return (
      <div className="space-y-6">
        <Link
          to="/reset-password"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Request new link
        </Link>

        <div>
          <h2 className="text-2xl font-semibold">Set new password</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Enter your new password below
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onSetNewPassword)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Reset password
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    )
  }

  // Email sent success view
  if (emailSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-safe/10 mx-auto">
          <CheckCircle className="h-8 w-8 text-safe" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground text-sm mt-2">
            If an account exists with {requestForm.getValues('email')}, you'll receive a password reset link.
          </p>
        </div>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link to="/login">Return to sign in</Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setEmailSent(false)}
          >
            Try a different email
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn't receive the email? Check your spam folder.
        </p>
      </div>
    )
  }

  // Default: Request reset email form
  return (
    <div className="space-y-6">
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      <div>
        <h2 className="text-2xl font-semibold">Reset password</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <Form {...requestForm}>
        <form onSubmit={requestForm.handleSubmit(onRequestReset)} className="space-y-4">
          <FormField
            control={requestForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send reset link
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
