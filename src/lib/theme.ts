import { db } from './db'

/**
 * Light/dark palette overrides for the `.classical` design system. The base
 * token set (fonts, spacing, radius, per-component depths, the full light
 * palette) lives in src/styles/classical.css; this file only carries what
 * differs between the two themes.
 *
 * Both sets are the Figma file, value for value — light from the plain frames,
 * dark from the `/ Dark` ones. See DESIGN.md.
 *
 * The dark theme does NOT darken the app. It darkens the *paper* (#2A3840) and
 * turns every surface mid-grey (#909EA6), which is why so little else moves:
 * outlines, slabs, the accent, the stat tiles and the whole neutral ramp are
 * type and trim sitting *on* those surfaces, and they read the same against a
 * grey card as against a white one. Only the ground, the type on the ground,
 * and the sentence card's own outline actually change.
 */
const LIGHT_VARS: Record<string, string> = {
  /** Every outline and the slab under cards, tiles and saved rows. */
  '--color-ink': '#020005',
  /** The slab under the rating pills — genuinely a different value in the file. */
  '--color-shadow': '#312F2A',
  '--color-card-edge': '#020005',
  '--color-bg': '#F5EDE7',
  '--color-surface': '#FFFFFF',
  '--color-text': '#020005',
  '--color-on-surface': '#020005',
  '--color-text-muted': '#797979',
  '--color-divider': 'color-mix(in srgb, #020005 16%, transparent)',
  '--color-icon': '#82C8CC',
  '--color-press': '#FFE500',
  '--color-accent': '#99C2C4',
  '--color-accent-500': '#99C2C4',
  '--color-toggle-track': '#FFFFFF',
  '--color-toggle-edge': '#EBEBED',
  '--color-toggle-glyph': '#171717',
  '--color-stat-teal': 'rgba(153, 194, 196, 0.6)',
  '--color-stat-salmon': 'rgba(246, 150, 135, 0.6)',
  '--color-stat-green': 'rgba(178, 217, 131, 0.6)',
  '--color-stat-yellow': 'rgba(255, 229, 0, 0.6)',
  '--color-stat-edge': '#444144',
  '--color-stat-figure': '#444144',
  '--color-error': '#A43D2C',
}

/**
 * Only the overrides. Anything absent here keeps the light value from
 * classical.css, which for this palette is the correct answer rather than an
 * oversight — see the note above.
 */
const DARK_VARS: Record<string, string> = {
  '--color-bg': '#2A3840',
  '--color-surface': '#909EA6',
  /** Type on the paper goes light; `--color-on-surface` deliberately does not. */
  '--color-text': '#ECF2EF',
  '--color-text-muted': '#7D9587',
  '--color-divider': 'rgba(236, 242, 239, 0.35)',
  /** The sentence card alone lifts its outline off near-black. */
  '--color-card-edge': '#4A6460',
  /** The toggle darkens with the paper rather than tracking --color-surface;
   * its edge and dot lift to the same value the sentence card's outline takes. */
  '--color-toggle-track': '#35434B',
  '--color-toggle-edge': '#4A6460',
  /** Salmon darkened for light type goes muddy on the dark paper; the tile hue
   * itself reads correctly there. */
  '--color-error': '#F69687',
}

export function getThemeVars(dark: boolean): React.CSSProperties {
  return (dark ? { ...LIGHT_VARS, ...DARK_VARS } : LIGHT_VARS) as React.CSSProperties
}

const DARK_SETTING_KEY = 'darkMode'

/** The chosen theme, persisted in the same `settings` table as the study source
 * and the API key, so it survives a reload. Absent means light. */
export async function getDarkMode(): Promise<boolean> {
  return (await db.settings.get(DARK_SETTING_KEY))?.value === 'true'
}

export async function setDarkMode(dark: boolean): Promise<void> {
  await db.settings.put({ key: DARK_SETTING_KEY, value: String(dark) })
}
