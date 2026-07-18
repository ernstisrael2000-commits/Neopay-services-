/**
 * LazyImg — drop-in <img> replacement with:
 *   - loading="lazy" (native browser lazy-loading)
 *   - decoding="async" (non-blocking decode)
 *   - Skeleton placeholder while loading
 *   - Graceful fallback on error
 *
 * Replace heavy <img src="..." /> tags with <LazyImg src="..." alt="..." />
 * to save bandwidth and improve LCP on mobile.
 */
import React, { useState, ImgHTMLAttributes } from 'react';

interface LazyImgProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  skeletonClassName?: string;
}

export default function LazyImg({
  src,
  alt = '',
  fallback = '/placeholder.svg',
  className = '',
  skeletonClassName = '',
  ...rest
}: LazyImgProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const imgSrc = errored ? fallback : src;

  return (
    <span className="relative inline-block" style={{ display: 'contents' }}>
      {!loaded && (
        <span
          className={`block bg-gray-100 animate-pulse rounded ${skeletonClassName}`}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0 }}
        />
      )}
      <img
        {...rest}
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
        onLoad={() => setLoaded(true)}
        onError={() => { setErrored(true); setLoaded(true); }}
      />
    </span>
  );
}
