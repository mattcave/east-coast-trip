// The site's mark: a small Class C motorhome (a cab with a bunk over it, a
// side window and two wheels), facing right. Drawn on lucide's 24px grid
// with the same 2px round-capped stroke, so it sits alongside the other
// icons. src/app/icon.svg is the same drawing, as the favicon. Decorative:
// it always sits next to the site or trip name.
export default function MotorhomeIcon({ size = 24, className = "", strokeWidth = 2 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {MOTORHOME_PATHS}
    </svg>
  );
}

// Body and bunk over the cab, then the windscreen and bonnet; the outline
// breaks where the wheels are
const MOTORHOME_PATHS = (
  <>
    <path d="M5 18H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4l3 4h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1" />
    <path d="M9 18h6" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
    <rect x="5" y="7" width="5" height="4" rx="1" />
  </>
);
