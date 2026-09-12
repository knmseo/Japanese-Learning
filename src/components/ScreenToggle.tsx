import { Note2, SearchStatus } from '@/components/icons'

type Screen = 'study' | 'browse'

type Props = {
  screen: Screen
  onChange: (screen: Screen) => void
}

/* Geometry from the `Toggle_1` / `Toggle_2` frames (DESIGN.md → Screen toggle).
 * The track is a 112×56 pill; the 46px knob rests 5px in from whichever end is
 * active, so its centre sits at 28 or 84. The inactive end shows a small dot at
 * the centre position the knob has vacated. */
const TRACK_W = 112
const TRACK_H = 56
const TRACK_BORDER = 2
const KNOB = 46
/** Measured from the track's OUTER edge, as the frame draws it — so the padding
 * below has to give back the border, which sits inside the 112px box. */
const KNOB_INSET = 5
const KNOB_PAD = KNOB_INSET - TRACK_BORDER
const DOT = 10
const KNOB_TRAVEL = TRACK_W - TRACK_BORDER * 2 - KNOB_PAD * 2 - KNOB

/**
 * Study/Browse switch: a pill bottom-right, sized for a one-handed thumb tap.
 * The whole pill is a single <button> — there's no separate hit target for the
 * knob — so a press anywhere on it toggles the screen.
 *
 * Unlike the rest of the app's controls this one carries a soft ambient shadow
 * rather than a hard slab (the frame's own drop shadow: 4px down, ~6px blur,
 * black at 25%), because it floats over the scrolling screen instead of sitting
 * on the paper.
 */
export function ScreenToggle({ screen, onChange }: Props) {
  const isBrowse = screen === 'browse'

  return (
    <button
      type="button"
      onClick={() => onChange(isBrowse ? 'study' : 'browse')}
      aria-label={isBrowse ? 'Switch to Study' : 'Switch to Browse'}
      className="fixed z-20 box-border flex flex-none items-center"
      style={{
        // 23px in from the right, ~60px up — the frame's position, with the
        // home indicator accounted for rather than hard-coded.
        right: 23,
        bottom: 'calc(26px + env(safe-area-inset-bottom))',
        width: TRACK_W,
        height: TRACK_H,
        padding: KNOB_PAD,
        borderRadius: TRACK_H / 2,
        border: `${TRACK_BORDER}px solid var(--color-toggle-edge)`,
        background: 'var(--color-surface)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* The dot marking the end the knob isn't on. Sits at that end's knob
          centre, so the two halves read as one track with a single occupant. */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: DOT,
          height: DOT,
          background: 'var(--color-neutral-300)',
          left: isBrowse ? KNOB_PAD + KNOB / 2 - DOT / 2 : KNOB_PAD + KNOB_TRAVEL + KNOB / 2 - DOT / 2,
          transition: 'left 420ms var(--ease-damped)',
        }}
      />

      <span
        className="relative flex flex-none items-center justify-center rounded-full"
        style={{
          width: KNOB,
          height: KNOB,
          background: 'var(--color-accent-500)',
          // Slower than the dark-mode toggle's transition — this is a rarer,
          // more deliberate action, so the motion can afford to read.
          transition: 'transform 420ms var(--ease-damped)',
          transform: isBrowse ? `translateX(${KNOB_TRAVEL}px)` : 'translateX(0px)',
        }}
      >
        {/* The glyph names the screen you are on, not the one you'd switch to. */}
        {isBrowse ? (
          <SearchStatus size={24} style={{ color: 'var(--color-toggle-glyph)' }} />
        ) : (
          <Note2 size={24} style={{ color: 'var(--color-toggle-glyph)' }} />
        )}
      </span>
    </button>
  )
}
