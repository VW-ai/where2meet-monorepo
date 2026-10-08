import { Coffee } from 'lucide';
import { ACCENT, MUTED, MapCard, renderShareCard } from '@/lib/og/share-card';
import { SHARE_IMAGE, SITE_CONFIG } from '@/lib/seo/metadata';

export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return renderShareCard({
    card: <MapCard pin={{ icon: Coffee, label: 'Coffee' }} />,
    text: (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            marginTop: 36,
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          {SITE_CONFIG.tagline}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            lineHeight: 1.35,
            color: MUTED,
            textWrap: 'balance',
          }}
        >
          {SITE_CONFIG.pitch}
        </div>
        <div style={{ marginTop: 32, fontSize: 26, fontWeight: 600, color: ACCENT }}>
          {new URL(SITE_CONFIG.url).host}
        </div>
      </div>
    ),
  });
}
