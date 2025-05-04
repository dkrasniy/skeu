'use client'

import React from 'react';

interface BrowserFrameProps {
  imageUrl: string;
  size: number;
  roundness: number;
  shadow: number;
  style?: React.CSSProperties;
}

export function BrowserFrame({ imageUrl, size, roundness, shadow, style }: BrowserFrameProps) {
  return (
    <div 
      className="overflow-hidden bg-white"
      style={{
        ...style,
        borderRadius: `${roundness}px`,
      }}
    >
      <div className="h-10 flex items-center gap-2 px-3 bg-[#f1f3f4] border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-2">
          <div className="h-6 bg-white rounded-md px-3 text-sm flex items-center text-gray-600">
            
          </div>
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