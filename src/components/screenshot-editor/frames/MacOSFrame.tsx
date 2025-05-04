'use client'

import React from 'react';

interface MacOSFrameProps {
  children: React.ReactNode;
  variant?: 'light' | 'dark';
}

export function MacOSFrame({ children, variant = 'light' }: MacOSFrameProps) {
  const isDark = variant === 'dark';

  return (
    <div className={`overflow-hidden rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
      <div className={`h-7 flex items-center gap-1.5 px-3 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
} 