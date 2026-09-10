import { useCallback, useRef, useState } from 'react'
import { getOpenAiApiKey } from './apiKey'
import { getAudioForSentence } from './tts'
import { speakWithWebSpeech, stopWebSpeech } from './webSpeech'

/**
 * Browsers refuse audio playback until the page has had a user gesture. So
 * autoplay must not fire until the user has actually interacted, or the
 * request is simply wasted (and, for a paid TTS call, wasted money).
 */
let userHasActivated = false

if (typeof window !== 'undefined') {
  const markActivated = () => {
    userHasActivated = true
  }
  for (const event of ['pointerdown', 'touchstart', 'click', 'keydown']) {
    window.addEventListener(event, markActivated, { once: true, capture: true })
  }
}

export type AudioEngine = 'openai' | 'webspeech'
/** Why the free voice was used: no key saved at all, vs. a saved/configured key that didn't work
 * (e.g. no billing credits) — worth distinguishing so the hint text doesn't say "add a key" to
 * someone who already has one. */
export type FallbackReason = 'no-key' | 'openai-failed' | null

/**
 * Plays sentence audio (§8): real neural TTS, cached by sentence-text hash,
 * when an OpenAI key is saved and working; the free browser voice otherwise.
 * A missing OR failing OpenAI call (e.g. no billing credits) both fall back
 * silently — no key, and a key with no credits, are both "TTS isn't
 * available right now," not something to interrupt the user over.
 */
export function useAudioPlayer() {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [lastEngine, setLastEngine] = useState<AudioEngine | null>(null)
  const [fallbackReason, setFallbackReason] = useState<FallbackReason>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    stopWebSpeech()
    setIsPlaying(false)
  }, [])

  const playViaOpenAi = useCallback(async (text: string, rate: number) => {
    const blob = await getAudioForSentence(text)
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url

    const audio = new Audio(url)
    audio.playbackRate = rate
    audio.onplay = () => setIsPlaying(true)
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)

    audioRef.current = audio
    await audio.play()
  }, [])

  const playViaWebSpeech = useCallback(async (text: string, rate: number) => {
    setIsPlaying(true)
    try {
      await speakWithWebSpeech(text, rate)
    } finally {
      setIsPlaying(false)
    }
  }, [])

  const play = useCallback(
    async (text: string, rate: number = 1) => {
      stop()
      setIsLoading(true)
      try {
        const hasKey = !!(await getOpenAiApiKey())

        if (hasKey) {
          try {
            await playViaOpenAi(text, rate)
            setLastEngine('openai')
            setFallbackReason(null)
            return
          } catch {
            // Falls through to the free voice below — a bad/uncredited key
            // shouldn't block playback, just downgrade it.
          }
        }

        setLastEngine('webspeech')
        setFallbackReason(hasKey ? 'openai-failed' : 'no-key')
        try {
          await playViaWebSpeech(text, rate)
        } catch {
          // Last resort in the chain — if the free voice fails too there's
          // nothing left to fall back to, and §8 says audio degrades silently.
          // Swallowing here is what keeps play() from rejecting at all, so no
          // caller (least of all fire-and-forget autoplay) can leak it.
        }
      } finally {
        setIsLoading(false)
      }
    },
    [stop, playViaOpenAi, playViaWebSpeech],
  )

  /** Effect-driven playback: a silent no-op until the user has interacted. */
  const autoplay = useCallback(
    (text: string, rate: number = 1) => {
      if (!userHasActivated) return
      // Fire-and-forget, so it needs its own catch: `void` doesn't handle a
      // rejection. play() shouldn't reject any more, but the settings read at
      // its top isn't inside its catch, and an unhandled rejection here would
      // surface in the console on every card.
      play(text, rate).catch(() => {})
    },
    [play],
  )

  return { play, autoplay, stop, isLoading, isPlaying, lastEngine, fallbackReason }
}
