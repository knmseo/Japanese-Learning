/**
 * Free fallback when no OpenAI key is saved or working — the same
 * browser-native voice Phase 0 used before real TTS existed. Not neural TTS
 * and not cacheable as an audio file (§8 wants both), but it's zero-cost
 * and zero-setup.
 */
export function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** speechSynthesis can wedge its queue (a known Chrome issue) and never fire
 * onend/onerror — without a timeout that hangs the caller's promise forever,
 * which for a Play button means it stays disabled forever. */
const WEDGED_QUEUE_TIMEOUT_MS = 8000

export function speakWithWebSpeech(text: string, rate: number = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis
    if (!synth) {
      reject(new Error('Web Speech is not supported in this browser.'))
      return
    }

    synth.cancel()
    if (synth.paused) synth.resume()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = rate

    const timeoutId = setTimeout(() => {
      synth.cancel()
      reject(new Error('Web Speech did not respond — the browser speech queue may be stuck.'))
    }, WEDGED_QUEUE_TIMEOUT_MS)

    utterance.onend = () => {
      clearTimeout(timeoutId)
      resolve()
    }
    utterance.onerror = (e) => {
      clearTimeout(timeoutId)
      reject(new Error(`Web Speech failed: ${e.error}`))
    }

    // Kept alive by this closure over `utterance` — an unreferenced utterance can be
    // garbage-collected mid-speech in Chrome, silently cutting playback off.
    synth.speak(utterance)
  })
}

export function stopWebSpeech(): void {
  window.speechSynthesis?.cancel()
}
