import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Props = {
  providerLabel: string
  envVarName: string
  placeholder: string
  onSave: (value: string) => Promise<void>
  onSaved: () => void
  onCancel: () => void
}

export function ApiKeyCard({ providerLabel, envVarName, placeholder, onSave, onSaved, onCancel }: Props) {
  const [value, setValue] = useState('')

  async function handleSave() {
    await onSave(value.trim())
    onSaved()
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col gap-3 py-5">
        <p className="text-muted-foreground text-sm">
          Paste your {providerLabel} API key — it stays in this browser. To skip this permanently, put{' '}
          <code className="text-xs">{envVarName}</code> in <code className="text-xs">.env.local</code>.
        </p>
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={!value.trim()} className="flex-1">
            Save key
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
