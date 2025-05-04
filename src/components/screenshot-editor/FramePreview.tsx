'use client'

import React, { useEffect, useRef, useState } from 'react';
import { MacOSFrame } from './frames/MacOSFrame';
import { WindowsFrame } from './frames/WindowsFrame';
import { BrowserFrame } from './frames/BrowserFrame';

interface FramePreviewProps {
  state: {
    image: File;
    frame: string;
    size: number;
    roundness: number;
    shadow: number;
    rotate: number;
    tilt: number;
    background: {
      type: string;
      color?: string;
      gradient?: string;
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
    switch (state.frame) {
      case 'macOS Light':
        return MacOSFrame;
      case 'macOS Dark':
        return MacOSFrame;
      case 'Windows':
        return WindowsFrame;
      case 'Browser':
        return BrowserFrame;
      default:
        return null;
    }
  };

  const FrameComponent = getFrameComponent();

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
    `,
    borderRadius: `${state.roundness}px`,
    boxShadow: state.shadow > 0
      ? `0 ${state.shadow * 0.5}px ${state.shadow * 2}px rgba(0, 0, 0, 0.2)`
      : 'none',
  };

  if (!imageUrl) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="screenshot-preview relative w-full h-full flex items-center justify-center overflow-hidden"
      style={containerStyle}
    >
      <div
        className="relative transition-transform duration-200 ease-out"
        style={frameStyle}
      >
        {FrameComponent ? (
          <FrameComponent variant={state.frame === 'macOS Dark' ? 'dark' : 'light'}>
            <img
              src={imageUrl}
              alt="Preview"
              className="max-w-full h-auto"
              draggable={false}
            />
          </FrameComponent>
        ) : (
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full h-auto rounded-lg"
            draggable={false}
          />
        )}
      </div>
    </div>
  );
} 