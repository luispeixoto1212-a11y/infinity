import type { SVGProps } from 'react';

/** Ícones de traço fino e consistente (24×24, stroke 1,6). Decorativos por omissão. */
const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <><path d="M8.5 5.5v13" /><path d="M15.5 5.5v13" /></>,
  slower: <><path d="M11.5 6.5 6 12l5.5 5.5" /><path d="M18 6.5 12.5 12l5.5 5.5" /></>,
  faster: <><path d="M12.5 6.5 18 12l-5.5 5.5" /><path d="M6 6.5 11.5 12 6 17.5" /></>,
  reverse: <><path d="M4.5 9h11a4 4 0 0 1 0 8H9" /><path d="m8 5.5-3.5 3.5L8 12.5" /></>,
  now: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  orbit: <><ellipse cx="12" cy="12" rx="9" ry="4.5" /><circle cx="12" cy="12" r="1.8" /><circle cx="19.6" cy="9.6" r="1.1" /></>,
  label: <><path d="M4 7.5h10.5l5 4.5-5 4.5H4z" /></>,
  view: <><path d="M4.5 8.5h3l1.6-2.2h5.8l1.6 2.2h3v10h-15z" /><circle cx="12" cy="13.3" r="3.2" /></>,
  recenter: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>,
  fullscreen: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  exitFullscreen: <><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />,
  back: <><path d="M19 12H5.5" /><path d="m11 6-6 6 6 6" /></>,
  external: <><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5 11 13" /><path d="M18 14v5.5H4.5V6H10" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.5" cy="6.5" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17.5" r="1" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><path d="M12 7.6v.01" /></>,
  keyboard: <><rect x="3" y="6.5" width="18" height="11" rx="2" /><path d="M7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17 10.5h.01M8 14h8" /></>,
  layers: <><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /></>,
  chevron: <path d="m9.5 6 6 6-6 6" />,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  filled?: boolean;
  title?: string;
}

export function Icon({ name, size = 20, filled = false, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
