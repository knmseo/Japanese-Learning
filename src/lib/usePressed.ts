import { useCallback, useState } from 'react'

/**
 * Tracks whether a pointer is currently down on an element, for the
 * pressStyle() tactile-press effect (§ UI pass). Releases on pointerup,
 * pointercancel, *and* pointerleave — without the leave case, dragging a
 * finger off a pressed button while still touching would leave it stuck
 * looking pressed.
 */
export function usePressed() {
  const [pressed, setPressed] = useState(false)
  const onPointerDown = useCallback(() => setPressed(true), [])
  const release = useCallback(() => setPressed(false), [])

  return {
    pressed,
    handlers: {
      onPointerDown,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
    },
  }
}
