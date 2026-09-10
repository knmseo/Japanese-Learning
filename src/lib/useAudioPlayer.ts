import { useCallback, useRef, useState } from 'react'
import { getOpenAiApiKey } from './apiKey'
import { getAudioForSentence } from './tts'
import { speakWithWebSpeech, stopWebSpeech } from './webSpeech'

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
 *
 * There is no autoplay — `play()` only ever fires from an explicit user tap
 * (the replay button), by design: every call is a real TTS request, and
 * autoplaying on every card would burn API usage just for looking at it.
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
          // Swallowing here is what keeps play() from rejecting at all.
        }
      } finally {
        setIsLoading(false)
      }
    },
    [stop, playViaOpenAi, playViaWebSpeech],
  )

  return { play, stop, isLoading, isPlaying, lastEngine, fallbackReason }
}
