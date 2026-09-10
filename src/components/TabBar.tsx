type Screen = 'study' | 'browse'

type Props = {
  screen: Screen
  onChange: (screen: Screen) => void
}

/** Ported from Nihongo Listen.dc.html's studyFabStyle/browseFabStyle FABs. Browse has no
 * functionality yet — this is just the tab shell (deliberately, per the roadmap). */
export function TabBar({ screen, onChange }: Props) {
  return (
    <div className="flex flex-none items-center justify-center gap-4 pt-3 pb-7">
      <button
        type="button"
        onClick={() => onChange('study')}
        aria-label="Study"
        aria-current={screen === 'study'}
        className="flex size-13 items-center justify-center rounded-full transition-colors"
        style={{
          background: screen === 'study' ? 'var(--color-accent-500)' : 'color-mix(in srgb, var(--color-accent-500) 16%, transparent)',
          color: screen === 'study' ? 'var(--color-bg)' : 'var(--color-accent-700)',
        }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path d="M3 14v-2a9 9 0 1118 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="2" y="14" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="17" y="14" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('browse')}
        aria-label="Browse"
        aria-current={screen === 'browse'}
        className="flex size-13 items-center justify-center rounded-full transition-colors"
        style={{
          background: screen === 'browse' ? 'var(--color-neutral-900)' : 'var(--color-neutral-200)',
          color: screen === 'browse' ? 'var(--color-bg)' : 'var(--color-neutral-500)',
        }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5v-17z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M4 4.5v17" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
    </div>
  )
}
