'use client'

import React from 'react';

interface WindowsFrameProps {
  imageUrl: string;
  size: number;
  roundness: number;
  shadow: number;
  style?: React.CSSProperties;
}

export function WindowsFrame({ imageUrl, size, roundness, shadow, style }: WindowsFrameProps) {
  return (
    <div 
      className="overflow-hidden bg-[#303030]"
      style={{
        ...style,
        borderRadius: `${roundness}px`,
      }}
    >
      <div className="h-8 flex items-center justify-between px-3 bg-[#303030]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#555555]" />
          <div className="w-3 h-3 rounded-sm bg-[#555555]" />
          <div className="w-3 h-3 rounded-sm bg-[#555555]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#555555]" />
          <div className="w-3 h-3 rounded-sm bg-[#555555]" />
          <div className="w-3 h-3 rounded-sm bg-[#E81123]" />
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