/**
 * CountryFlag - small flag(s) for the free-text Country field (Oct 24
 * meeting, item 9).
 *
 * SVG flags from flag-icons (MIT), because Windows does not draw flag emoji.
 * Each flag is its own small file, downloaded only when a regulation from that
 * country is on screen (?no-inline keeps them out of the main bundle).
 *
 * A flag sits beside the country name, never instead of it (WCAG 1.1.1,
 * 1.4.1): decorative by default (aria-hidden). Where the name isn't shown as
 * text next to it, pass `labelled` and the flag carries the country name.
 */
import { countryCodes } from '../utils/countries';

const FLAG_URLS = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  query: '?no-inline',
  import: 'default',
});

const URL_BY_CODE = Object.fromEntries(
  Object.entries(FLAG_URLS).map(([path, url]) => [path.split('/').pop().replace('.svg', ''), url])
);

export default function CountryFlag({ country, labelled = false, className = '' }) {
  const codes = countryCodes(country).filter((code) => URL_BY_CODE[code]);
  if (codes.length === 0) return null;

  return (
    <span
      className={`inline-flex flex-none items-center gap-0.5 ${className}`}
      {...(labelled ? { role: 'img', 'aria-label': `Country: ${country}` } : { 'aria-hidden': 'true' })}
      title={country}
    >
      {codes.map((code) => (
        <img
          key={code}
          src={URL_BY_CODE[code]}
          alt=""
          width="16"
          height="12"
          loading="lazy"
          className="w-4 h-3 rounded-[2px] ring-1 ring-black/10 dark:ring-white/20 object-cover"
        />
      ))}
    </span>
  );
}
