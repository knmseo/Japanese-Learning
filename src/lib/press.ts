import type { CSSProperties } from 'react'

const PRESS_TRANSITION =
  'box-shadow 260ms var(--ease-damped), transform 260ms var(--ease-damped), background-color 260ms var(--ease-damped)'

/**
 * The chunky "thick bottom border" affordance used throughout the app
 * (rating buttons, deck cards, saved-set rows) is rendered as a box-shadow
 * slab beneath the element's normal 1px border, NOT as a real
 * border-bottom-width. box-shadow never participates in layout — a real
 * border-bottom-width change shrinks the element's actual box height, and
 * because these buttons sit in height-driven containers (a grid row sized
 * to its tallest cell, itself bottom-anchored), thinning just the pressed
 * button's border reflowed the whole row: every sibling shifted down, and
 * the pressed button itself moved by the transform *and* the reflow,
 * overshooting past where its bottom edge should have stayed.
 *
 * The default pressed fill is `--color-press` (#FFE500). That comes straight
 * from the mockup's `Resources` frame, which draws rest and pressed side by
 * side against a baseline rule: white/4px-slab at y, then yellow/no-slab at
 * y+4. Toggles that stay held in (a selected deck) pass their own fill
 * instead, since a persistent yellow would read as a permanent button press.
 *
 * `restDepthPx` is the shadow's resting depth — how far the "thick" bottom
 * extends past the normal 1px border. Pressing collapses the shadow to 0
 * and translates the button down by exactly that amount, so the visible
 * bottom edge (border, former-shadow, all of it) never moves — the border
 * just thins into it. Both directions interpolate on the shared damped
 * easing (classical.css's --ease-damped).
 */
export function pressStyle(
  pressed: boolean,
  restDepthPx: number,
  shadowColor: string,
  pressedBackground = 'var(--color-press)',
): CSSProperties {
  if (!pressed) {
    return {
      boxShadow: `0 ${restDepthPx}px 0 0 ${shadowColor}`,
      transform: 'translateY(0px)',
      transition: PRESS_TRANSITION,
    }
  }
  return {
    boxShadow: `0 0px 0 0 ${shadowColor}`,
    transform: `translateY(${restDepthPx}px)`,
    background: pressedBackground,
    transition: PRESS_TRANSITION,
  }
}
