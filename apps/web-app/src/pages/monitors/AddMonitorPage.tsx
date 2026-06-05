import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@clausync/ui'
import { Input } from '@clausync/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@clausync/ui'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@clausync/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@clausync/ui'
import { useCreateMonitor } from '@/lib/api-hooks'
import { toast } from 'sonner'

const addMonitorSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  frequency: z.string().default('6h'),
})

type AddMonitorForm = z.infer<typeof addMonitorSchema>

export function AddMonitorPage() {
  const navigate = useNavigate()
  const createMonitor = useCreateMonitor()

  const form = useForm<AddMonitorForm>({
    resolver: zodResolver(addMonitorSchema),
    defaultValues: {
      url: '',
      name: '',
      frequency: '6h',
    },
  })

  async function onSubmit(data: AddMonitorForm) {
    try {
      await createMonitor.mutateAsync({
        url: data.url,
        name: data.name || undefined,
      })
      toast.success('Monitor created successfully!')
      navigate('/monitors')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create monitor')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        to="/monitors"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Monitors
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Add New Monitor</h1>
        <p className="text-muted-foreground">
          Start tracking changes to a service agreement or legal document
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Monitor Configuration</CardTitle>
          <CardDescription>
            Enter the URL of the page you want to monitor for changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL *</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com/terms-of-service"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The full URL of the page you want to monitor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="AWS Terms of Service"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name for this monitor (auto-generated if empty)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Frequency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1h">Every hour</SelectItem>
                        <SelectItem value="6h">Every 6 hours</SelectItem>
                        <SelectItem value="12h">Every 12 hours</SelectItem>
                        <SelectItem value="24h">Once daily</SelectItem>
                        <SelectItem value="168h">Once weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to check for changes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/monitors')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMonitor.isPending} className="flex-1">
                  {createMonitor.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Create Monitor'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
