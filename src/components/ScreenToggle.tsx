type Screen = 'study' | 'browse'

type Props = {
  screen: Screen
  onChange: (screen: Screen) => void
}

/** Icon glyphs lifted from the old TabBar's study/browse SVGs. */
function StudyGlyph({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M3 14v-2a9 9 0 1118 0v2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <rect x="2" y="14" width="5" height="7" rx="1.5" stroke={color} strokeWidth="2" />
      <rect x="17" y="14" width="5" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function BrowseGlyph({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5v-17z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M4 4.5v17" stroke={color} strokeWidth="2" />
    </svg>
  )
}

// Container inner width (w-28=112 minus p-1.5=6px each side) minus the knob
// (size-11=44px) — how far the knob travels between its two resting positions.
const KNOB_TRAVEL_PX = 112 - 6 * 2 - 44

/**
 * Study/Browse switch, styled after DarkModeToggle's sliding-knob pattern
 * but bottom-right, horizontal, and sized for a one-handed thumb tap. The
 * whole pill is a single <button> — there's no separate hit target for the
 * knob — so a press anywhere on it toggles the screen, not just the knob.
 */
export function ScreenToggle({ screen, onChange }: Props) {
  const isBrowse = screen === 'browse'

  return (
    <button
      type="button"
      onClick={() => onChange(isBrowse ? 'study' : 'browse')}
      aria-label={isBrowse ? 'Switch to Study' : 'Switch to Browse'}
      className="fixed right-4 bottom-5 z-20 box-border flex h-14 w-28 flex-none items-center rounded-full p-1.5"
      style={{
        border: '1px solid var(--color-accent-500)',
        background: 'var(--color-surface)',
      }}
    >
      <span
        className="flex size-11 flex-none items-center justify-center rounded-full"
        style={{
          background: 'var(--color-accent-500)',
          // Slower than the dark-mode toggle's default-duration transition — this
          // is a rarer, more deliberate action, so the motion can afford to read.
          transition: 'transform 420ms var(--ease-damped)',
          transform: isBrowse ? `translateX(${KNOB_TRAVEL_PX}px)` : 'translateX(0px)',
        }}
      >
        {isBrowse ? <BrowseGlyph color="var(--color-bg)" /> : <StudyGlyph color="var(--color-bg)" />}
      </span>
    </button>
  )
}
