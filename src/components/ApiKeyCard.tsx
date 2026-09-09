import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { setApiKey } from '@/lib/apiKey'

type Props = {
  onSaved: () => void
  onCancel: () => void
}

export function ApiKeyCard({ onSaved, onCancel }: Props) {
  const [value, setValue] = useState('')

  async function handleSave() {
    await setApiKey(value.trim())
    onSaved()
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col gap-3 py-5">
        <p className="text-muted-foreground text-sm">
          Paste your Anthropic API key — it stays in this browser. To skip this permanently, put{' '}
          <code className="text-xs">VITE_ANTHROPIC_API_KEY</code> in <code className="text-xs">.env.local</code>.
        </p>
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-..."
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
