import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { pressStyle } from '@/lib/press'
import { playSound } from '@/lib/sounds'
import { usePressed } from '@/lib/usePressed'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** How far the thick-bottom box-shadow extends past the element's normal 1px
   * border at rest — owned by pressStyle(), which collapses it on press. */
  restDepthPx: number
  /** The border/shadow color — same value passed as `borderColor` in `style`. */
  shadowColor: string
  pressedBackground?: string
  /**
   * Hold the button in its pressed state, for toggles where "selected" should
   * read as "stays pushed in" — the selected deck, for instance. Distinct from
   * the momentary `pressed` that tracks the pointer.
   */
  depressed?: boolean
  children: ReactNode
}

/**
 * A <button> with the app's thick-bottom-border "press" affordance: on press
 * the box-shadow that renders the thick bottom collapses to 0 while the
 * button sinks by the same amount, so its visible bottom edge holds still,
 * plus a background swap — both on the shared damped easing. See
 * lib/press.ts for why this is a box-shadow and not a real
 * border-bottom-width. Used everywhere that border language reads as a
 * button: rating buttons, deck cards, saved-set rows.
 */
export function PressableButton({
  restDepthPx,
  shadowColor,
  pressedBackground,
  depressed = false,
  style,
  children,
  ...rest
}: Props) {
  const { pressed, handlers } = usePressed()

  return (
    <button
      {...rest}
      {...handlers}
      // On press-down, not on click — the sound should land with the finger,
      // matching the moment the button visually sinks.
      onPointerDown={(e) => {
        if (!rest.disabled) playSound('press')
        handlers.onPointerDown()
        rest.onPointerDown?.(e)
      }}
      style={
        { ...style, ...pressStyle(pressed || depressed, restDepthPx, shadowColor, pressedBackground) } as CSSProperties
      }
    >
      {children}
    </button>
  )
}
