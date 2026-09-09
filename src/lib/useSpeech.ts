import { useCallback, useRef, useState } from 'react'

/**
 * Browsers refuse speechSynthesis until the page has had a user gesture, and a
 * refused call leaves the queue wedged — every later utterance is then dropped
 * silently, including ones the user explicitly asked for. So autoplay must not
 * fire until the user has actually interacted.
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

/**
 * Placeholder TTS via the browser's Web Speech API. Real neural TTS with
 * hash-based audio caching is Phase 4 (§8) — this just makes the
 * audio-first reveal flow (§1) work now.
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  // Chrome garbage-collects an utterance nothing references, cutting playback off silently.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback((text: string, rate: number = 1) => {
    const synth = window.speechSynthesis
    if (!synth) return

    synth.cancel()
    if (synth.paused) synth.resume()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = rate
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    // Stays in the gesture's own call stack on purpose — Safari and iOS ignore a deferred speak().
    synth.speak(utterance)
  }, [])

  /** Effect-driven playback: a no-op until the user has interacted, so it can never wedge the queue. */
  const autoplay = useCallback(
    (text: string, rate: number = 1) => {
      if (!userHasActivated) return
      speak(text, rate)
    },
    [speak],
  )

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, autoplay, stop, isSpeaking }
}
