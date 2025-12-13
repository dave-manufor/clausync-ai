import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Key, Copy, Trash2, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'


const createKeySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  scopes: z.array(z.string()).min(1, 'Select at least one scope'),
})

type CreateKeyForm = z.infer<typeof createKeySchema>

const availableScopes = [
  { id: 'monitors:read', label: 'Read Monitors', description: 'View monitor list and details' },
  { id: 'monitors:write', label: 'Write Monitors', description: 'Create, update, delete monitors' },
  { id: 'changes:read', label: 'Read Changes', description: 'View detected changes' },
  { id: 'analytics:read', label: 'Read Analytics', description: 'Access analytics data' },
]

// Mock data
const existingKeys = [
  {
    id: '1',
    name: 'Production API',
    keyPrefix: 'csk_live_abc123...',
    scopes: ['monitors:read', 'changes:read'],
    createdAt: '2024-12-01',
    lastUsedAt: '2 hours ago',
  },
  {
    id: '2',
    name: 'Development',
    keyPrefix: 'csk_test_xyz789...',
    scopes: ['monitors:read', 'monitors:write', 'changes:read', 'analytics:read'],
    createdAt: '2024-11-15',
    lastUsedAt: 'Never',
  },
]

export function ApiKeysSettingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const form = useForm<CreateKeyForm>({
    resolver: zodResolver(createKeySchema),
    defaultValues: {
      name: '',
      scopes: [],
    },
  })

  async function onSubmit(data: CreateKeyForm) {
    setIsLoading(true)
    console.log('Create API key:', data)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    // Mock response
    setNewKey('csk_live_' + Math.random().toString(36).substring(2, 15))
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('API key copied to clipboard')
    }
  }

  function handleDialogClose() {
    setIsDialogOpen(false)
    setNewKey(null)
    form.reset()
  }

  function revokeKey(keyId: string) {
    console.log('Revoke key:', keyId)
    toast.success('API key revoked')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Manage API keys for programmatic access
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {!newKey ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Generate a new API key with specific permissions
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Key Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Production API" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="scopes"
                        render={() => (
                          <FormItem>
                            <FormLabel>Permissions</FormLabel>
                            <div className="space-y-3">
                              {availableScopes.map((scope) => (
                                <FormField
                                  key={scope.id}
                                  control={form.control}
                                  name="scopes"
                                  render={({ field }) => (
                                    <FormItem className="flex items-start gap-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(scope.id)}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || []
                                            if (checked) {
                                              field.onChange([...current, scope.id])
                                            } else {
                                              field.onChange(current.filter((v) => v !== scope.id))
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <div className="space-y-0.5">
                                        <FormLabel className="font-normal">{scope.label}</FormLabel>
                                        <FormDescription className="text-xs">
                                          {scope.description}
                                        </FormDescription>
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Generate Key
                      </Button>
                    </form>
                  </Form>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>API Key Created</DialogTitle>
                    <DialogDescription>
                      Copy your API key now. You won't be able to see it again!
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        value={newKey}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopy}
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-amber-200">
                        Store this key securely. It will only be shown once.
                      </p>
                    </div>
                    <Button onClick={handleDialogClose} className="w-full">
                      Done
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{key.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm text-muted-foreground">{key.keyPrefix}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 2).map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope.split(':')[0]}
                        </Badge>
                      ))}
                      {key.scopes.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{key.scopes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{key.lastUsedAt}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeKey(key.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
