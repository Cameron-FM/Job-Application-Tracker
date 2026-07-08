import { useState } from 'react';

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function domainFrom(website) {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Tries the company's real favicon (keyed off their website domain), then
// falls back to a colored initial — never a broken image. (Clearbit's free
// logo API, once the obvious first choice here, was discontinued — Google's
// favicon service is the reliable option that's still around.)
export default function CompanyLogo({ name = '', website, size = 20 }) {
  const domain = domainFrom(website);
  const [failed, setFailed] = useState(false);

  if (!domain || failed) {
    return (
      <span
        className="company-logo company-logo-fallback"
        style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.55 }}
      >
        {name.trim()[0]?.toUpperCase() || '?'}
      </span>
    );
  }

  return (
    <img
      className="company-logo"
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
