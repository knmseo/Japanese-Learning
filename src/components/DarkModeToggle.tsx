type Props = {
  dark: boolean
  onToggle: () => void
}

/** Ported from Nihongo Listen.dc.html's switchStyle/knobStyle. */
export function DarkModeToggle({ dark, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle dark mode"
      className="box-border flex h-7 w-12 flex-none items-center justify-start rounded-full p-1 transition-colors"
      style={{
        border: '1px solid var(--color-accent-500)',
        background: dark ? 'var(--color-accent-500)' : 'transparent',
      }}
    >
      <span
        className="flex size-5 items-center justify-center rounded-full transition-transform"
        style={{ background: 'var(--color-bg)', transform: dark ? 'translateX(18px)' : 'translateX(0px)' }}
      >
        {dark ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z" fill="var(--color-accent-500)" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.5" fill="var(--color-accent-500)" />
            <g stroke="var(--color-accent-500)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="12" y1="1.5" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22.5" />
              <line x1="1.5" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22.5" y2="12" />
              <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
              <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
              <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
              <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
            </g>
          </svg>
        )}
      </span>
    </button>
  )
}
