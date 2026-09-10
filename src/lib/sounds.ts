/**
 * Tiny synthesised UI sounds. Deliberately not audio files: these are short
 * blips, so generating them with an oscillator keeps the bundle unchanged, adds
 * no dependency, and needs no network — which matters for §9's commute case.
 *
 * Kept well clear of the study audio path (§8): this never touches
 * useAudioPlayer, so a UI blip can't interrupt or be interrupted by TTS.
 */

type Blip = {
  /** Start frequency in Hz. */
  freq: number
  /** Optional end frequency — glides from `freq` to this over the sound. */
  toFreq?: number
  durationMs: number
  /** Peak gain. These stay low; UI sound should be felt more than heard. */
  gain: number
  type?: OscillatorType
}

const SOUNDS = {
  /** Any chunky button press — ratings, deck cards, saved rows. */
  press: { freq: 320, toFreq: 200, durationMs: 70, gain: 0.055, type: 'triangle' },
  /** Revealing the translation — a soft upward tick. */
  reveal: { freq: 420, toFreq: 620, durationMs: 130, gain: 0.045, type: 'sine' },
  /** Saving a word (segment tap). */
  wordSave: { freq: 660, toFreq: 880, durationMs: 90, gain: 0.04, type: 'sine' },
  /** Un-saving a word — same shape, downward. */
  wordUnsave: { freq: 660, toFreq: 440, durationMs: 90, gain: 0.035, type: 'sine' },
  /** Starring a sentence — a touch fuller than a word. */
  sentenceSave: { freq: 520, toFreq: 780, durationMs: 150, gain: 0.05, type: 'triangle' },
  /** Un-starring. */
  sentenceUnsave: { freq: 520, toFreq: 340, durationMs: 130, gain: 0.04, type: 'triangle' },
} satisfies Record<string, Blip>

export type SoundName = keyof typeof SOUNDS

const MUTED_KEY = 'ui-sound-muted'

let ctx: AudioContext | null = null

function muted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    // Private mode / blocked storage — default to audible rather than failing.
    return false
  }
}

export function setSoundMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, value ? '1' : '0')
  } catch {
    // Nothing to do — the setting just won't persist.
  }
}

export function isSoundMuted(): boolean {
  return muted()
}

/**
 * Plays a UI blip. Safe to call from any handler: it never throws, and it's a
 * no-op before the first user gesture (browsers suspend AudioContext until
 * then) or when the device/browser has no Web Audio at all.
 */
export function playSound(name: SoundName): void {
  if (muted()) return

  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    // Created suspended when no gesture has happened yet; resuming inside a
    // real gesture (which every caller is) is what unlocks it on iOS.
    if (ctx.state === 'suspended') void ctx.resume()

    const { freq, toFreq, durationMs, gain, type } = SOUNDS[name]
    const now = ctx.currentTime
    const seconds = durationMs / 1000

    const osc = ctx.createOscillator()
    osc.type = type ?? 'sine'
    osc.frequency.setValueAtTime(freq, now)
    if (toFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(toFreq, now + seconds)

    // Short attack, exponential decay — a click rather than a beep. Ramping to
    // a tiny non-zero value because exponentialRamp can't reach 0.
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(gain, now + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, now + seconds)

    osc.connect(env).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + seconds + 0.02)
  } catch {
    // UI sound is a nicety — never let it break an interaction.
  }
}
