import { useState } from 'react';

interface ParallaxVisualProps {
  src: string;
  alt: string;
  className?: string;
  fit?: 'cover' | 'contain';
  position?: 'center' | 'bottom';
  scale?: number;
}

export default function ParallaxVisual({ src, alt, className = '', fit = 'cover', position = 'center', scale = 1 }: ParallaxVisualProps) {
  const [broken, setBroken] = useState(false);

  return (
    <div className={`overflow-hidden rounded-lg ${className}`}>
      {!broken ? (
        <img
          src={src}
          alt={alt}
          onError={() => setBroken(true)}
          className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${position === 'bottom' ? 'object-bottom' : 'object-center'}`}
          style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: position === 'bottom' ? 'bottom' : 'center' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/20 via-accent/10 to-primary/10 text-primary/40 text-xs text-center px-4">
          Drop an image at public{src} to fill this visual
        </div>
      )}
    </div>
  );
}
