import { Check, Download, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBundleStatus, prepareBundle, type BundleStatus } from '@/lib/commuteBundle'
import type { Sentence } from '@/lib/types'

type Props = {
  sentences: Sentence[]
}

const MUTED = 'var(--color-neutral-500)'

/**
 * §9's "prepare session" control. Downloading TTS audio costs money per
 * sentence, so this never runs on its own — it stays a deliberate tap, and it
 * says how many sentences it's about to fetch before the user commits.
 */
export function OfflineBundleControl({ sentences }: Props) {
  const [status, setStatus] = useState<BundleStatus | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const key = sentences.map((s) => s.id).join(',')

  useEffect(() => {
    setNote(null)
    setProgress(null)
    let cancelled = false
    void getBundleStatus(sentences).then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  async function handlePrepare() {
    if (!navigator.onLine) {
      setNote("You're offline — reconnect to download the rest.")
      return
    }
    setNote(null)
    setProgress({ done: 0, total: sentences.length })
    const result = await prepareBundle(sentences, (done, total) => setProgress({ done, total }))
    setProgress(null)
    setStatus(await getBundleStatus(sentences))

    if (result.missingKey) {
      setNote('Add an OpenAI key under Browse → Settings to download audio.')
    } else if (result.failed > 0) {
      setNote(`${result.failed} couldn't be downloaded — the rest are ready.`)
    }
  }

  if (!status || status.total === 0) return null

  if (progress) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] tabular-nums" style={{ color: MUTED }}>
        <Loader2 className="size-3 animate-spin" />
        Preparing {progress.done} / {progress.total}
      </p>
    )
  }

  if (status.complete) {
    return (
      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: MUTED }}>
        <Check className="size-3" style={{ color: 'var(--color-accent-700)' }} />
        Ready offline
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void handlePrepare()}
        className="flex items-center gap-1.5 text-[11px] tabular-nums"
        style={{ color: MUTED }}
      >
        <Download className="size-3" />
        Prepare for offline · {status.total - status.ready} to download
      </button>
      {note && (
        <p className="text-[11px]" style={{ color: MUTED }}>
          {note}
        </p>
      )}
    </div>
  )
}
