/**
 * Light/dark palette overrides for the `.classical` design system. The base
 * token set (fonts, spacing, radius, per-component depths, the full light
 * palette) lives in src/styles/classical.css; this file only carries what
 * differs between the two themes.
 *
 * Light is the Figma file, value for value — see DESIGN.md. Dark is NOT in
 * the Figma file: there are no dark frames, so the dark set below is derived
 * from the light tokens rather than specified, and is the one part of the
 * palette that is judgement rather than design.
 */
const LIGHT_VARS: Record<string, string> = {
  /** Every 2px outline, and the slab under cards, tiles and saved rows. */
  '--color-ink': '#020005',
  /** The slab under the rating pills — genuinely a different value in the file. */
  '--color-shadow': '#312F2A',
  '--color-bg': '#F5EDE7',
  '--color-surface': '#FFFFFF',
  '--color-text': '#020005',
  '--color-divider': 'color-mix(in srgb, #020005 16%, transparent)',
  '--color-icon': '#82C8CC',
  '--color-press': '#FFE500',
  '--color-accent': '#99C2C4',
  '--color-accent-500': '#99C2C4',
  '--color-stat-teal': 'rgba(153, 194, 196, 0.6)',
  '--color-stat-salmon': 'rgba(246, 150, 135, 0.6)',
  '--color-stat-green': 'rgba(178, 217, 131, 0.6)',
  '--color-stat-yellow': 'rgba(255, 229, 0, 0.6)',
  '--color-stat-edge': '#444144',
  '--color-stat-figure': '#444144',
  '--color-error': '#A43D2C',
  '--color-toggle-edge': '#EBEBED',
  '--color-toggle-glyph': '#171717',
}

const DARK_VARS: Record<string, string> = {
  // Near-black would read as a hole punched in a dark ground, so outline and
  // slab both lift to #4F6260 — the value chosen for the previous dark theme,
  // kept because the mockup says nothing about dark and this was a deliberate
  // decision. Outline and shadow are the same colour here by design.
  '--color-ink': '#4F6260',
  '--color-shadow': '#4F6260',
  '--color-bg': '#2D383F',
  // The mockup's cards are white; on a dark ground that becomes the raised
  // surface instead, so components read `--color-surface`, never `white`.
  '--color-surface': '#374349',
  '--color-text': '#EDF2EF',
  '--color-divider': 'rgba(129,147,136,0.45)',
  '--color-neutral-100': '#333F46',
  '--color-neutral-200': '#3D4A52',
  '--color-neutral-300': '#4C5A62',
  '--color-neutral-400': '#62717A',
  '--color-neutral-500': '#819388',
  '--color-neutral-600': '#9AAA9E',
  '--color-neutral-700': '#B7C4BB',
  '--color-neutral-800': '#D3DBD3',
  '--color-neutral-900': '#EDF2EF',
  // The teal reads well on both grounds, so the accent carries over unchanged
  // and selected states stay recognisably the same colour across themes.
  '--color-icon': '#82C8CC',
  '--color-press': '#FFE500',
  '--color-accent': '#99C2C4',
  '--color-accent-100': '#1F3233',
  '--color-accent-200': '#2A4446',
  '--color-accent-300': '#3A5D5F',
  '--color-accent-400': '#5E8E90',
  '--color-accent-500': '#99C2C4',
  '--color-accent-600': '#AFD0D2',
  '--color-accent-700': '#C6DEDF',
  '--color-accent-800': '#DCEBEC',
  '--color-accent-900': '#EFF7F7',
  // The stat hues need less alpha over a dark ground than over the paper one,
  // or they wash out to four indistinguishable greys.
  '--color-stat-teal': 'rgba(153, 194, 196, 0.42)',
  '--color-stat-salmon': 'rgba(246, 150, 135, 0.42)',
  '--color-stat-green': 'rgba(178, 217, 131, 0.42)',
  '--color-stat-yellow': 'rgba(255, 229, 0, 0.42)',
  '--color-stat-edge': '#4F6260',
  // On the dark ground the darkened salmon goes muddy; the tile hue itself
  // reads correctly there.
  '--color-error': '#F69687',
  // Light mode sets the figures to #444144, matching the tile outline. Carrying
  // that literal value into dark would put a near-black numeral on an already
  // dim tile, so dark takes the text colour instead — the intent (a figure that
  // reads quietly against its tile) rather than the hex.
  '--color-stat-figure': '#EDF2EF',
  // A near-white track edge would glare on a dark ground; the toggle takes the
  // same lifted outline everything else does. The knob stays teal, so its glyph
  // keeps the near-black that reads against it in both themes.
  '--color-toggle-edge': '#4F6260',
  '--color-toggle-glyph': '#171717',
}

export function getThemeVars(dark: boolean): React.CSSProperties {
  return (dark ? DARK_VARS : LIGHT_VARS) as React.CSSProperties
}
