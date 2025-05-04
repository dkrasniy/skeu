'use client'

import React from 'react';
import { Circle } from 'lucide-react';

interface BrowserFrameProps {
  children: React.ReactNode;
}

export function BrowserFrame({ children }: BrowserFrameProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-white border border-gray-200">
      <div className="h-10 flex items-center gap-2 px-4 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500" />
          <Circle className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
          <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
        </div>
        <div className="flex-1 mx-4">
          <div className="w-full h-6 px-3 bg-white rounded flex items-center text-sm text-gray-500">
            example.com
          </div>
        </div>
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
} 