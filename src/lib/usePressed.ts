import { useCallback, useEffect, useRef, useState } from 'react'

/** How long a pointerup waits for the click that normally follows it before
 * releasing anyway. Covers gestures that end on the button without producing a
 * click — a drag that scrolled the deck rail, a text selection. Comfortably
 * longer than the browser's own pointerup→click gap, short enough that a
 * stuck-looking button is never perceptible. */
const CLICK_GRACE_MS = 300

/**
 * Tracks whether a pointer is currently down on an element, for the
 * pressStyle() tactile-press effect (§ UI pass). Releases on pointercancel and
 * on pointerleave — without the leave case, dragging a finger off a pressed
 * button while still touching would leave it stuck looking pressed.
 *
 * pointerup deliberately does *not* release immediately: see onPointerUp.
 */
export function usePressed() {
  const [pressed, setPressed] = useState(false)
  /** Whether the pointer is still down. pointerleave only releases while it is —
   * touch pointers fire pointerleave right *after* pointerup (the pointer is
   * destroyed), which would otherwise cut the grace period below short. */
  const down = useRef(false)
  const grace = useRef<number | null>(null)

  const clearGrace = () => {
    if (grace.current !== null) {
      clearTimeout(grace.current)
      grace.current = null
    }
  }

  useEffect(() => clearGrace, [])

  const release = useCallback(() => {
    down.current = false
    clearGrace()
    setPressed(false)
  }, [])

  const onPointerDown = useCallback(() => {
    clearGrace()
    down.current = true
    setPressed(true)
  }, [])

  /**
   * Hold the pressed look past pointerup and let the click release it instead.
   * A button whose own click puts it into the held `depressed` state — a deck
   * card being selected — otherwise springs back up for a frame or two in
   * between, because `pressed` falls on pointerup while `depressed` only
   * arrives with the click. That reads as a bounce.
   */
  const onPointerUp = useCallback(() => {
    down.current = false
    clearGrace()
    grace.current = window.setTimeout(() => setPressed(false), CLICK_GRACE_MS)
  }, [])

  const onPointerLeave = useCallback(() => {
    if (down.current) release()
  }, [release])

  return {
    pressed,
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerCancel: release,
      onPointerLeave,
    },
    /** Call from the click handler, after the consumer's own onClick, so the
     * release batches into the same render as whatever that click changed. */
    release,
  }
}
