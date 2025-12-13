import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useAuth } from '@/hooks/useAuth'

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email'),
})

type ResetForm = z.infer<typeof resetSchema>

export function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { sendPasswordResetEmail } = useAuth()

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: ResetForm) {
    setIsLoading(true)
    try {
      await sendPasswordResetEmail(data.email)
      setIsSuccess(true)
    } catch (error: any) {
      // Don't reveal if email exists or not for security
      // Show success regardless to prevent email enumeration
      setIsSuccess(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#2ED573]/10 mx-auto">
          <CheckCircle className="h-8 w-8 text-[#2ED573]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground text-sm mt-2">
            If an account exists with {form.getValues('email')}, you'll receive a password reset link.
          </p>
        </div>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link to="/login">Return to sign in</Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setIsSuccess(false)}
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
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
