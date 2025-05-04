'use client'

import React from 'react';

interface MacOSFrameProps {
  variant?: 'light' | 'dark';
  imageUrl: string;
  size: number;
  roundness: number;
  shadow: number;
  style?: React.CSSProperties;
}

export function MacOSFrame({ imageUrl, size, roundness, shadow, style, variant = 'light' }: MacOSFrameProps) {
  const isDark = variant === 'dark';

  return (
    <div 
      className={`overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}
      style={{
        ...style,
        borderRadius: `${roundness}px`,
      }}
    >
      <div className={`h-8 flex items-center gap-1.5 px-3 ${isDark ? 'bg-zinc-900' : 'bg-white'} border-b`}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
      </div>
      <div className="relative">
        <img
          src={imageUrl}
          alt="Preview"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
} 