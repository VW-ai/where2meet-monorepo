'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  CAT_BRIM,
  CAT_EYE_LEFT,
  CAT_EYE_RIGHT,
  CAT_HAT,
  CAT_HAT_FILL,
  CAT_HEAD,
  CAT_MOUTH,
  LOGO_POINTS,
} from '../lib/cat-paths';
import {
  DURATIONS,
  openTime,
  portalFrame,
  portalGeometry,
  type PortalGeometry,
} from '../lib/timeline';
import { usePortalStore } from '../model/portal-store';
import './cat-portal.css';

const COVER = '#eef1f4';
const BADGE = '#ffffff';

/**
 * Full-screen overlay for the create-meeting → map transition. Mounted once in
 * the root layout so it survives the route change from / to /meet/[id].
 */
export function CatPortal() {
  const status = usePortalStore((state) => state.status);
  return status === 'idle' ? null : <PortalOverlay />;
}

function PortalOverlay() {
  const maskId = `cat-portal-hole-${useId().replace(/:/g, '')}`;
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coverRef = useRef<SVGRectElement>(null);
  const holeRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const catRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGPathElement>(null);
  const hatRef = useRef<SVGGElement>(null);
  const hatPathRef = useRef<SVGPathElement>(null);
  const featuresRef = useRef<SVGGElement>(null);
  const eyeLeftRef = useRef<SVGPathElement>(null);
  const eyeRightRef = useRef<SVGPathElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const root = rootRef.current;
    const svg = svgRef.current;
    const head = headRef.current;
    if (!root || !svg || !head) return;

    const base = portalGeometry(viewport, usePortalStore.getState().from);
    const geo: PortalGeometry = { ...base, kEnd: coverScale(svg, head, base) };
    let openAt: number | null = null;
    let frame = 0;
    let caption = '';

    const tick = () => {
      const state = usePortalStore.getState();
      const now = performance.now();
      const t = now - state.startedAt;

      if (openAt === null && state.createdAt !== null) {
        const fallback = now - state.createdAt >= DURATIONS.mapFallback ? now : null;
        const readyAt = state.mapReadyAt ?? fallback;
        if (readyAt !== null) openAt = openTime(readyAt - state.startedAt, state.reduced);
      }

      const f = portalFrame(t, { reduced: state.reduced, openAt, hasPin: state.hasPin }, geo);
      const leaving =
        state.status === 'failed' && state.failedAt !== null
          ? Math.min(1, (now - state.failedAt) / DURATIONS.failFade)
          : 0;

      // Cat
      const { cat } = f;
      const transform =
        `translate(${cat.x} ${cat.y}) rotate(${cat.rotate}) ` +
        `scale(${cat.k * cat.sx} ${cat.k * cat.sy}) translate(${-geo.anchor.x} ${-geo.anchor.y})`;
      const catEl = catRef.current!;
      catEl.setAttribute('transform', transform);
      catEl.style.opacity = String(cat.opacity * (1 - leaving));
      headRef.current!.style.fillOpacity = String(cat.fill);
      hatPathRef.current!.style.fillOpacity = String(cat.fill);
      featuresRef.current!.style.opacity = String(cat.features);
      featuresRef.current!.style.fill = mix(BADGE, COVER, cat.featureTint);
      hatRef.current!.setAttribute(
        'transform',
        `rotate(${cat.hatRotate} ${LOGO_POINTS.hatPivot.x} ${LOGO_POINTS.hatPivot.y})`
      );
      for (const [eye, bottom] of [
        [eyeLeftRef.current!, LOGO_POINTS.eyeLeftBottom],
        [eyeRightRef.current!, LOGO_POINTS.eyeRightBottom],
      ] as const) {
        eye.setAttribute(
          'transform',
          cat.blink < 1
            ? `translate(0 ${bottom}) scale(1 ${cat.blink}) translate(0 ${-bottom})`
            : ''
        );
      }

      // Cover, with the cat's outline cut out while it grows
      const cover = coverRef.current!;
      cover.style.opacity = String(f.cover * (1 - leaving));
      if (f.hole) {
        cover.setAttribute('mask', `url(#${maskId})`);
        holeRef.current!.setAttribute('transform', transform);
      } else {
        cover.removeAttribute('mask');
      }

      const shadow = shadowRef.current!;
      shadow.style.opacity = String(0.13 * f.shadow * (1 - leaving));

      const pulse = pulseRef.current!;
      pulse.style.opacity = f.pulse ? String(f.pulse.opacity) : '0';
      if (f.pulse) {
        pulse.setAttribute(
          'transform',
          `translate(${geo.target.x} ${geo.target.y}) scale(${f.pulse.scale})`
        );
      }

      const captionEl = captionRef.current!;
      captionEl.style.opacity = String(f.caption * (1 - leaving));
      const text = state.createdAt === null ? 'Creating your meeting…' : 'Opening the map…';
      if (text !== caption) {
        captionEl.textContent = text;
        caption = text;
      }

      root.style.pointerEvents = f.passThrough || leaving > 0 ? 'none' : 'auto';

      // Hand the meeting page its cues: hide its controls under the cover, play
      // their entrances on settle, and zoom the map while it shows through the cat.
      if (state.status === 'failed' || f.chrome === 'done') {
        delete html.dataset.portal;
      } else {
        html.dataset.portal = f.chrome;
        html.style.setProperty('--portal-map-scale', String(f.mapScale));
        html.style.setProperty('--portal-map-origin', `${geo.target.x}px ${geo.target.y}px`);
      }

      if (f.done || leaving >= 1) {
        usePortalStore.getState().finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      delete html.dataset.portal;
      html.style.removeProperty('--portal-map-scale');
      html.style.removeProperty('--portal-map-origin');
    };
  }, [viewport, maskId]);

  const { width, height } = viewport;
  return (
    <div ref={rootRef} className="cat-portal">
      <svg
        ref={svgRef}
        className="cat-portal__stage"
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
            <rect width={width} height={height} fill="#fff" />
            <g ref={holeRef} fill="#000">
              <path d={CAT_HEAD + CAT_HAT} />
              <path d={CAT_HAT_FILL} />
            </g>
          </mask>
        </defs>
        <rect ref={coverRef} width={width} height={height} fill={COVER} style={{ opacity: 0 }} />
        <ellipse
          ref={shadowRef}
          cx={width / 2}
          {...shadowShape(viewport)}
          fill="#17252d"
          style={{ opacity: 0 }}
        />
        <circle ref={pulseRef} r="10" fill="rgba(239, 68, 68, 0.55)" style={{ opacity: 0 }} />
        <g ref={catRef} style={{ opacity: 0 }}>
          <path ref={headRef} d={CAT_HEAD} fill="#000" />
          <g ref={hatRef}>
            <path ref={hatPathRef} d={CAT_HAT} fill="#000" />
          </g>
          <g ref={featuresRef} style={{ fill: BADGE }}>
            <path ref={eyeLeftRef} d={CAT_EYE_LEFT} />
            <path ref={eyeRightRef} d={CAT_EYE_RIGHT} />
            <path d={CAT_MOUTH} />
            <path d={CAT_BRIM} />
          </g>
        </g>
      </svg>
      <p
        ref={captionRef}
        className="cat-portal__caption"
        role="status"
        style={{ top: portalGeometry(viewport, null).waitBottom + 26, opacity: 0 }}
      >
        Creating your meeting…
      </p>
    </div>
  );
}

function shadowShape(viewport: { width: number; height: number }) {
  const geo = portalGeometry(viewport, null);
  return { cy: geo.waitBottom + 10, rx: 34 * (geo.waitSize / 112), ry: 5 };
}

/** Smallest scale at which the cat's outline covers the screen around the target, plus a margin. */
function coverScale(svg: SVGSVGElement, head: SVGPathElement, geo: PortalGeometry): number {
  const fallback = 4.5;
  if (typeof head.isPointInFill !== 'function') return fallback;
  const point = svg.createSVGPoint();
  const samples: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    for (let j = 0; j <= 16; j++) samples.push([(i * geo.width) / 16, (j * geo.height) / 16]);
  }
  const covers = (k: number) =>
    samples.every(([x, y]) => {
      point.x = geo.anchor.x + (x - geo.target.x) / k;
      point.y = geo.anchor.y + (y - geo.target.y) / k;
      return head.isPointInFill(point);
    });
  try {
    let lo = 0.2;
    let hi = 60;
    if (!covers(hi)) return fallback;
    for (let i = 0; i < 30; i++) {
      const mid = Math.sqrt(lo * hi);
      if (covers(mid)) hi = mid;
      else lo = mid;
    }
    return hi * 1.12;
  } catch {
    return fallback;
  }
}

function mix(from: string, to: string, p: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * p);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
