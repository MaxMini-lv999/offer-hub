import type { CSSProperties } from 'react';
import { assets, type AssetId } from './assets';

type Common = { id: AssetId; base?: string; variant?: 'desktop' | 'mobile'; decorative?: boolean; className?: string };
const resolve = (base: string, src: string) => base.replace(/\/$/, '') + '/' + src;

export function ArtImage({ id, base = '/offer-hub-assets', variant = 'desktop', decorative = true, className, priority = false }: Common & { priority?: boolean }) {
  const asset = assets.find(item => item.id === id)!;
  const image = asset.variants[variant];
  return <img className={className} src={resolve(base, image.src)}
    width={image.width} height={image.height}
    alt={decorative ? '' : asset.title}
    aria-hidden={decorative || undefined}
    loading={priority ? 'eager' : 'lazy'}
    decoding="async" style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />;
}

/** Atlases are static state choices, not frame-by-frame animations. */
export function AtlasSprite({ id, index = 0, size = 80, base = '/offer-hub-assets', variant = 'mobile', decorative = true, className }: Common & { index?: number; size?: number }) {
  const asset = assets.find(item => item.id === id)!;
  if (!('atlas' in asset)) throw new Error(id + ' is not a sprite atlas');
  const frame = asset.atlas.frames[Math.max(0, Math.min(5, Math.floor(index)))];
  const style: CSSProperties = {
    display: 'inline-block', flexShrink: 0, width: size, height: size,
    backgroundImage: 'url("' + resolve(base, asset.variants[variant].src) + '")',
    backgroundSize: '300% 200%', backgroundPosition: frame.backgroundPosition,
    backgroundRepeat: 'no-repeat'
  };
  return <span className={className} style={style}
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : asset.title + ' · ' + frame.name}
    aria-hidden={decorative || undefined} />;
}

