/**
 * Light/dark palette overrides for the `.classical` design system, ported
 * from the Claude Design import (`Nihongo Listen.dc.html`). The base token
 * set (fonts, spacing, radius, shadow, neutral ramp) lives in
 * src/styles/classical.css; only bg/surface/text/divider/accent swap here,
 * exactly as the source file scoped its own dark-mode override.
 */
const LIGHT_VARS: Record<string, string> = {
  '--color-bg': '#FFF6E1',
  '--color-surface': '#FCEFCB',
  '--color-text': '#201f1d',
  '--color-divider': 'color-mix(in srgb, #201f1d 16%, transparent)',
  '--color-accent': '#00A499',
  '--color-accent-100': '#E0F7F5',
  '--color-accent-200': '#B3ECE7',
  '--color-accent-300': '#80DFD7',
  '--color-accent-400': '#33C9BE',
  '--color-accent-500': '#00A499',
  '--color-accent-600': '#008C82',
  '--color-accent-700': '#00695F',
  '--color-accent-800': '#004F48',
  '--color-accent-900': '#003330',
}

const DARK_VARS: Record<string, string> = {
  '--color-bg': '#2D383F',
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
  '--color-accent': '#379F77',
  '--color-accent-100': '#123024',
  '--color-accent-200': '#1C4A38',
  '--color-accent-300': '#2A6B50',
  '--color-accent-400': '#318761',
  '--color-accent-500': '#379F77',
  '--color-accent-600': '#5FB897',
  '--color-accent-700': '#93D3B9',
  '--color-accent-800': '#BFE6D6',
  '--color-accent-900': '#E4F3EC',
}

export function getThemeVars(dark: boolean): React.CSSProperties {
  return (dark ? DARK_VARS : LIGHT_VARS) as React.CSSProperties
}
