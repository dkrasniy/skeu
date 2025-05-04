'use client'

import React, { useEffect, useRef, useState } from 'react';
import { MacOSFrame } from './frames/MacOSFrame';
import { WindowsFrame } from './frames/WindowsFrame';
import { BrowserFrame } from './frames/BrowserFrame';
import { SunburstPattern } from './SunburstPattern';

interface FramePreviewProps {
  state: {
    image: File | null;
    frame: 'none' | 'macOS Light' | 'macOS Dark' | 'Windows' | 'Browser';
    size: number;
    roundness: number;
    shadow: number;
    rotate: number;
    tilt: number;
    background: {
      type: 'none' | 'solid' | 'gradient';
      color?: string;
      gradient?: string;
      showSunburst?: boolean;
    };
    position: {
      x: number;
      y: number;
    };
  };
}

export function FramePreview({ state }: FramePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (state.image) {
      const url = URL.createObjectURL(state.image);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [state.image]);

  const getFrameComponent = () => {
    const commonProps = {
      imageUrl,
      size: state.size,
      roundness: state.roundness,
      shadow: state.shadow,
      
    };

    switch (state.frame) {
      case 'macOS Light':
        return <MacOSFrame {...commonProps} variant="light" />;
      case 'macOS Dark':
        return <MacOSFrame {...commonProps} variant="dark" />;
      case 'Windows':
        return <WindowsFrame {...commonProps} />;
      case 'Browser':
        return <BrowserFrame {...commonProps} />;
      default:
        return (
          <div
            className="relative rounded-lg overflow-hidden"
          >
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
        );
    }
  };

  const containerStyle: React.CSSProperties = {
    background: state.background.type === 'none'
      ? 'transparent'
      : state.background.type === 'solid'
      ? state.background.color
      : state.background.gradient,
  };

  const frameStyle: React.CSSProperties = {
    transform: `
      scale(${state.size / 100})
      rotate(${state.rotate}deg)
      perspective(1000px)
      rotateX(${state.tilt}deg)
      translate(${state.position.x}px, ${state.position.y}px)
    `,
    borderRadius: `${state.roundness}px`,
    boxShadow: state.shadow > 0
      ? `0 ${state.shadow * 0.5}px ${state.shadow * 2}px rgba(0, 0, 0, 0.2)`
      : 'none',
  };

  if (!imageUrl) {
    return null;
  }

  const getBackgroundColor = () => {
    if (state.background.type === 'solid') {
      return state.background.color || '#000000';
    } else if (state.background.type === 'gradient') {
      // Extract the last color from gradient
      const match = state.background.gradient?.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
      return match ? match[match.length - 1] : '#000000';
    }
    return '#000000';
  };

  return (
    <div
      ref={containerRef}
      className="screenshot-preview relative w-full h-full flex items-center justify-center overflow-hidden"
      style={containerStyle}
    >
      {state.background.showSunburst && (
        <div className="absolute inset-0 pointer-events-none">
          <SunburstPattern color={getBackgroundColor()} />
        </div>
      )}
      
      <div
        className="relative transition-transform duration-200 ease-out"
        style={frameStyle}
      >
        {getFrameComponent()}
      </div>
    </div>
  );
} 