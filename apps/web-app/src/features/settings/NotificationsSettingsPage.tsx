import { useState } from 'react'
import { Mail, Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface NotificationSetting {
  id: string
  label: string
  description: string
  email: boolean
  push: boolean
}

export function NotificationsSettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [digestFrequency, setDigestFrequency] = useState('daily')
  const [notifications, setNotifications] = useState<NotificationSetting[]>([
    {
      id: 'high_risk',
      label: 'High Risk Changes',
      description: 'Immediate alerts for critical changes',
      email: true,
      push: true,
    },
    {
      id: 'medium_risk',
      label: 'Medium Risk Changes',
      description: 'Changes that may need attention',
      email: true,
      push: false,
    },
    {
      id: 'low_risk',
      label: 'Low Risk Changes',
      description: 'Minor updates and corrections',
      email: false,
      push: false,
    },
    {
      id: 'new_monitor',
      label: 'Monitor Activity',
      description: 'When monitors are added or removed',
      email: true,
      push: false,
    },
    {
      id: 'weekly_digest',
      label: 'Weekly Summary',
      description: 'Weekly overview of all changes',
      email: true,
      push: false,
    },
  ])

  function toggleNotification(id: string, type: 'email' | 'push') {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, [type]: !n[type] } : n
      )
    )
  }

  async function handleSave() {
    setIsLoading(true)
    console.log('Save notifications:', { notifications, digestFrequency })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    toast.success('Notification preferences saved')
  }

  return (
    <div className="space-y-6">
      {/* Email Digest */}
      <Card>
        <CardHeader>
          <CardTitle>Email Digest</CardTitle>
          <CardDescription>
            Receive a summary of changes on a regular schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="digest-frequency">Send digest</Label>
            <Select value={digestFrequency} onValueChange={setDigestFrequency}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">Real-time</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose how you want to be notified about different events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex-1" />
              <div className="w-20 text-center flex items-center justify-center gap-1">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div className="w-20 text-center flex items-center justify-center gap-1">
                <Bell className="h-4 w-4" />
                Push
              </div>
            </div>

            <Separator />

            {/* Notification rows */}
            {notifications.map((notification, index) => (
              <div key={notification.id}>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{notification.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.description}
                    </p>
                  </div>
                  <div className="w-20 flex justify-center">
                    <Switch
                      checked={notification.email}
                      onCheckedChange={() => toggleNotification(notification.id, 'email')}
                    />
                  </div>
                  <div className="w-20 flex justify-center">
                    <Switch
                      checked={notification.push}
                      onCheckedChange={() => toggleNotification(notification.id, 'push')}
                    />
                  </div>
                </div>
                {index < notifications.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
