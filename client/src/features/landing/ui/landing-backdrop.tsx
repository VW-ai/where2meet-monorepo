/**
 * Animated page background for the landing: a faint city-block map that drifts
 * slowly, with three glows in the participant colors easing toward the middle
 * and back. Only `transform` animates, so it stays on the compositor.
 *
 * It also carries the page background color, so it shows through without the
 * page root needing its own stacking context.
 */

const TILE = 288;

// 3×3 blocks per tile, with merged blocks and a park so the repeat isn't obvious.
const tile = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>
<g fill='#e4e8ed'>
<rect x='7' y='7' width='82' height='82' rx='12'/>
<rect x='103' y='7' width='178' height='82' rx='12'/>
<rect x='7' y='103' width='82' height='178' rx='12'/>
<rect x='199' y='103' width='82' height='82' rx='12'/>
<rect x='103' y='199' width='82' height='82' rx='12'/>
<rect x='199' y='199' width='82' height='82' rx='12'/>
</g>
<rect x='103' y='103' width='82' height='82' rx='12' fill='#dbe9da'/>
</svg>`;

const tileUrl = `url("data:image/svg+xml,${encodeURIComponent(tile.replace(/\n/g, ''))}")`;

const css = `
  .backdrop-map {
    position: absolute;
    inset: 0;
    overflow: hidden;
    -webkit-mask-image: radial-gradient(140% 100% at 50% 35%, #000 35%, transparent 80%);
    mask-image: radial-gradient(140% 100% at 50% 35%, #000 35%, transparent 80%);
    opacity: 0.45;
  }
  .backdrop-tiles {
    position: absolute;
    inset: -${TILE}px;
    background-image: ${tileUrl};
    background-size: ${TILE}px ${TILE}px;
    animation: backdrop-pan 90s linear infinite;
    will-change: transform;
  }
  @keyframes backdrop-pan {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(${TILE}px, ${TILE}px, 0); }
  }
  .backdrop-glow {
    position: absolute;
    width: 70vmax;
    height: 70vmax;
    border-radius: 50%;
    animation: 18s ease-in-out infinite alternate;
    will-change: transform;
  }
  .backdrop-glow-a {
    left: -32vmax;
    top: -30vmax;
    background: radial-gradient(closest-side, rgba(255, 107, 107, 0.26), transparent);
    animation-name: backdrop-glow-a;
  }
  .backdrop-glow-b {
    right: -32vmax;
    top: -22vmax;
    background: radial-gradient(closest-side, rgba(77, 150, 255, 0.24), transparent);
    animation-name: backdrop-glow-b;
    animation-delay: -6s;
  }
  .backdrop-glow-c {
    left: calc(50% - 35vmax);
    bottom: -46vmax;
    background: radial-gradient(closest-side, rgba(107, 203, 119, 0.24), transparent);
    animation-name: backdrop-glow-c;
    animation-delay: -12s;
  }
  @keyframes backdrop-glow-a { to { transform: translate3d(14vmax, 10vmax, 0) scale(1.08); } }
  @keyframes backdrop-glow-b { to { transform: translate3d(-14vmax, 12vmax, 0) scale(1.08); } }
  @keyframes backdrop-glow-c { to { transform: translate3d(0, -14vmax, 0) scale(1.08); } }
  @media (prefers-reduced-motion: reduce) {
    .backdrop-tiles, .backdrop-glow { animation: none; }
  }
`;

export function LandingBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef1f4]"
    >
      <div className="backdrop-map">
        <div className="backdrop-tiles" />
      </div>
      <div className="backdrop-glow backdrop-glow-a" />
      <div className="backdrop-glow backdrop-glow-b" />
      <div className="backdrop-glow backdrop-glow-c" />
      <style>{css}</style>
    </div>
  );
}
