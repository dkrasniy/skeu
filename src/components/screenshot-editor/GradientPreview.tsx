import React from 'react';

interface GradientPreviewProps {
  gradient: string;
  label: string;
}

export function GradientPreview({ gradient, label }: GradientPreviewProps) {
  return (
    <div className="flex items-center gap-3">
      <div 
        className="w-8 h-8 rounded-md"
        style={{ background: gradient }}
      />
      <span>{label}</span>
    </div>
  );
} 