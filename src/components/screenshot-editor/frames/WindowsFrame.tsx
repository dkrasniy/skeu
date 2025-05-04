'use client'

import React from 'react';
import { X, Minus, Square } from 'lucide-react';

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
      className="overflow-hidden rounded-lg bg-white border border-gray-200"
      style={style}
    >
      <div className="h-8 flex items-center justify-between px-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3" />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-gray-100 rounded">
            <Minus className="w-3 h-3 text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded">
            <Square className="w-3 h-3 text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded">
            <X className="w-3 h-3 text-gray-600" />
          </button>
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