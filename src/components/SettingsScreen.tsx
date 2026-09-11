import { Check, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PressableButton } from '@/components/PressableButton'
import { clearAccessToken, getAccessToken } from '@/lib/accessToken'
import { clearOpenAiApiKey, getOpenAiApiKey, setOpenAiApiKey } from '@/lib/apiKey'

type Props = {
  visible: boolean
}

/** Outline + heavy bottom edge share one token, so dark mode shifts both
 * off near-black together (#312F2A light, #4F6260 dark). */
const STROKE = 'var(--color-shadow)'

/** Set at build time; when present it wins over anything saved in the browser. */
const ENV_KEY = import.meta.env.VITE_OPENAI_API_KEY?.trim()

/**
 * Where the OpenAI key is entered. Before this existed the app told you to "add
 * an OpenAI key in settings" with no settings anywhere — the old ApiKeyCard was
 * dropped from the study card during the §16 rewrite and never re-homed, so on
 * a deployed build there was no way to enter a key at all.
 *
 * The key is stored in IndexedDB on this device only (§2: client-side, no
 * backend). That is deliberately the recommended route for a public deploy —
 * a build-time env var gets compiled into the bundle for anyone to read.
 */
export function SettingsScreen({ visible }: Props) {
  const [saved, setSaved] = useState<boolean | null>(null)
  const [invited, setInvited] = useState(false)
  const [value, setValue] = useState('')
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void getOpenAiApiKey().then((k) => {
      if (!cancelled) setSaved(!!k)
    })
    void getAccessToken().then((t) => {
      if (!cancelled) setInvited(!!t)
    })
    return () => {
      cancelled = true
    }
  }, [visible])

  async function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) return
    await setOpenAiApiKey(trimmed)
    setValue('')
    setSaved(true)
    setNote('Key saved on this device.')
  }

  async function handleClear() {
    await clearOpenAiApiKey()
    setSaved(false)
    setNote('Key removed from this device.')
  }

  return (
    <div className="flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="pt-2 pb-3">
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>
          Voice
        </h2>
      </div>

      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-neutral-600)' }}>
        Sentence audio uses OpenAI's voice when a key is saved, and your device's built-in
        Japanese voice otherwise. The built-in voice is free and works offline — a key
        mainly buys better pronunciation, and is what "Prepare for offline" downloads.
      </p>

      {invited && (
        <div
          className="mt-4 rounded-md px-3 py-2.5"
          style={{ border: '1px solid var(--color-divider)' }}
        >
          <p className="flex items-center gap-2 text-[13px]">
            <Check className="size-4 flex-none" style={{ color: 'var(--color-accent-700)' }} />
            Shared voice active — you were invited, so audio works with no key of your own.
          </p>
          <button
            type="button"
            onClick={() => void clearAccessToken().then(() => setInvited(false))}
            className="mt-2 text-[12px] underline"
            style={{ color: 'var(--color-neutral-500)' }}
          >
            Stop using the shared voice
          </button>
        </div>
      )}

      {ENV_KEY ? (
        <p
          className="mt-4 text-[12px] leading-relaxed"
          style={{ color: 'var(--color-accent-700)' }}
        >
          A key is currently baked into this build via <code>VITE_OPENAI_API_KEY</code>. On a
          public URL that key is readable by anyone who opens the site — unset it in your host's
          build settings and save it here instead.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {saved ? (
              <>
                <Check className="size-4" style={{ color: 'var(--color-accent-700)' }} />
                <span className="text-[14px]">Key saved on this device</span>
              </>
            ) : (
              <>
                <KeyRound className="size-4" style={{ color: 'var(--color-neutral-500)' }} />
                <span className="text-[14px]" style={{ color: 'var(--color-neutral-600)' }}>
                  {saved === null ? 'Checking…' : 'No key saved — using the built-in voice'}
                </span>
              </>
            )}
          </div>

          <input
            type="password"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setNote(null)
            }}
            placeholder={saved ? 'Replace key (sk-…)' : 'sk-…'}
            aria-label="OpenAI API key"
            className="w-full rounded-md px-3 py-2.5 text-[14px]"
            style={{
              border: `1px solid ${STROKE}`,
              background: 'var(--color-bg)',
              fontFamily: 'var(--font-body)',
            }}
          />

          <div className="flex gap-2.5">
            <PressableButton
              type="button"
              onClick={() => void handleSave()}
              disabled={!value.trim()}
              className="btn btn-secondary flex-1 disabled:opacity-50"
              restDepthPx={3}
              shadowColor="var(--color-shadow)"
              style={{ borderColor: STROKE, background: 'var(--color-bg)' }}
            >
              {saved ? 'Replace key' : 'Save key'}
            </PressableButton>
            {saved && (
              <PressableButton
                type="button"
                onClick={() => void handleClear()}
                className="btn btn-secondary"
                restDepthPx={3}
                shadowColor="var(--color-shadow)"
                style={{ borderColor: STROKE, background: 'var(--color-bg)' }}
              >
                Remove
              </PressableButton>
            )}
          </div>

          {note && (
            <p className="text-[12px]" style={{ color: 'var(--color-neutral-500)' }}>
              {note}
            </p>
          )}
        </div>
      )}

      <p className="mt-6 text-[11px] leading-relaxed" style={{ color: 'var(--color-neutral-400)' }}>
        Stored in this browser's local database only — never uploaded, never in the app bundle,
        and not shared with your other devices.
      </p>
    </div>
  )
}
