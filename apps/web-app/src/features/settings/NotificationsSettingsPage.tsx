import { useEffect } from 'react'
import { Mail, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/lib/api-hooks'
import { useState } from 'react'

export function NotificationsSettingsPage() {
  const { data: prefsResponse, isLoading, error } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()
  
  // Local state for form
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [digestFrequency, setDigestFrequency] = useState<'instant' | 'daily' | 'weekly'>('instant')
  const [riskThreshold, setRiskThreshold] = useState(5)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Extract preferences from response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = prefsResponse as any
  const prefs = rawData?.data ?? rawData
  
  // Sync state with API data when loaded
  useEffect(() => {
    if (prefs) {
      setEmailEnabled(prefs.emailEnabled ?? true)
      setDigestFrequency(prefs.digestFrequency ?? 'instant')
      setRiskThreshold(prefs.riskThreshold ?? 5)
      setHasChanges(false)
    }
  }, [prefs])

  function handleChange<T>(setter: (val: T) => void, value: T) {
    setter(value)
    setHasChanges(true)
  }

  async function handleSave() {
    try {
      await updatePrefs.mutateAsync({
        emailEnabled,
        digestFrequency,
        riskThreshold,
      })
      setHasChanges(false)
      toast.success('Notification preferences saved')
    } catch (error) {
      toast.error('Failed to save notification preferences')
      console.error('Update preferences error:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load notification preferences</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Enable or disable email notifications for changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="email-notifications">Email notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email alerts when changes are detected
                </p>
              </div>
            </div>
            <Switch
              id="email-notifications"
              checked={emailEnabled}
              onCheckedChange={(val) => handleChange(setEmailEnabled, val)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Digest Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>Digest Frequency</CardTitle>
          <CardDescription>
            Choose how often you want to receive notification digests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="digest-frequency">Send digest</Label>
            <Select 
              value={digestFrequency} 
              onValueChange={(val) => handleChange(setDigestFrequency, val as 'instant' | 'daily' | 'weekly')}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Risk Threshold */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Threshold</CardTitle>
          <CardDescription>
            Only notify for changes above this risk level (1-10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="risk-threshold">Minimum risk level</Label>
            <Select 
              value={riskThreshold.toString()} 
              onValueChange={(val) => handleChange(setRiskThreshold, parseInt(val))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {riskThreshold <= 3 ? 'All changes' : 
               riskThreshold <= 6 ? 'Medium+ risk' : 
               'High risk only'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={updatePrefs.isPending || !hasChanges}
        >
          {updatePrefs.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
