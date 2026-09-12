/**
 * The Iconsax (vuesax) *linear* glyphs the Figma file uses, replacing Lucide
 * on the screens the mockup covers.
 *
 * Path data is copied verbatim from the file's own SVG exports — Figma's
 * asset URLs expire after about a week, so the geometry has to live here
 * rather than being fetched. Every glyph is a 24×24 viewBox stroked at 1.5.
 *
 * The exports carry baked-in stroke colours (#82C8CC on the card icons,
 * #171717 on the two toggle icons). Those are dropped for `currentColor` so
 * the glyph inherits from whatever renders it and dark mode works at all;
 * callers set the designed colour via `color`. Nothing about the geometry
 * changes.
 */
type IconProps = {
  className?: string
  /** Square size in px. The file draws every one of these at 24. */
  size?: number
  style?: React.CSSProperties
}

function Svg({ className, size = 24, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** Save / bookmark — the sentence card's top-left control. */
export function ArchiveAdd(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 10.65H9.5" strokeMiterlimit={10} />
      <path d="M12 8.21V13.21" strokeMiterlimit={10} />
      <path d="M16.82 2H7.18C5.05 2 3.32 3.74 3.32 5.86V19.95C3.32 21.75 4.61 22.51 6.19 21.64L11.07 18.93C11.59 18.64 12.43 18.64 12.94 18.93L17.82 21.64C19.4 22.52 20.69 21.76 20.69 19.95V5.86C20.68 3.74 18.95 2 16.82 2Z" />
    </Svg>
  )
}

/** Audio replay — the sentence card's top-right control. */
export function VolumeHigh(props: IconProps) {
  return (
    <Svg {...props}>
      {/* The body of the speaker is stroked without caps in the export. */}
      <path
        d="M2 10V14C2 16 3 17 5 17H6.43C6.8 17 7.17 17.11 7.49 17.3L10.41 19.13C12.93 20.71 15 19.56 15 16.59V7.41C15 4.43 12.93 3.29 10.41 4.87L7.49 6.7C7.17 6.89 6.8 7 6.43 7H5C3 7 2 8 2 10Z"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path d="M18 8C19.78 10.37 19.78 13.63 18 16" />
      <path d="M19.83 5.5C22.72 9.35 22.72 14.65 19.83 18.5" />
    </Svg>
  )
}

/** The Study side of the bottom screen toggle. */
export function Note2(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21.66 10.44L20.68 14.62C19.84 18.23 18.18 19.69 15.06 19.39C14.56 19.35 14.02 19.26 13.44 19.12L11.76 18.72C7.59 17.73 6.3 15.67 7.28 11.49L8.26 7.3C8.46 6.45 8.7 5.71 9 5.1C10.17 2.68 12.16 2.03 15.5 2.82L17.17 3.21C21.36 4.19 22.64 6.26 21.66 10.44Z" />
      <path d="M15.06 19.39C14.44 19.81 13.66 20.16 12.71 20.47L11.13 20.99C7.16 22.27 5.07 21.2 3.78 17.23L2.5 13.28C1.22 9.31 2.28 7.21 6.25 5.93L7.83 5.41C8.24 5.28 8.63 5.17 9 5.1C8.7 5.71 8.46 6.45 8.26 7.3L7.28 11.49C6.3 15.67 7.59 17.73 11.76 18.72L13.44 19.12C14.02 19.26 14.56 19.35 15.06 19.39Z" />
      <path d="M12.64 8.53L17.49 9.76" />
      <path d="M11.66 12.4L14.56 13.14" />
    </Svg>
  )
}

/** The Browse side of the bottom screen toggle. */
export function SearchStatus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11C20 15.97 15.97 20 11 20C6.03 20 2 15.97 2 11C2 6.03 6.03 2 11 2" />
      <path d="M18.9299 20.6898C19.4599 22.2898 20.6699 22.4498 21.5999 21.0498C22.4499 19.7698 21.8899 18.7198 20.3499 18.7198C19.2099 18.7098 18.5699 19.5998 18.9299 20.6898Z" />
      <path d="M14 5H20" />
      <path d="M14 8H17" />
    </Svg>
  )
}
