'use client'
import React, { useState } from 'react';
import { ImageDropzone } from './ImageDropzone';
import { EditorControls } from './EditorControls';
import { FramePreview } from './FramePreview';
import { ExportOptions } from './ExportOptions';
import { SunburstPattern } from './SunburstPattern';

interface EditorState {
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
}

export function ScreenshotEditor() {
  const [editorState, setEditorState] = useState<EditorState>({
    image: null,
    frame: 'macOS Light',
    size: 80,
    roundness: 8,
    shadow: 10,
    rotate: 0,
    tilt: 0,
    background: {
      type: 'gradient',
      gradient: 'linear-gradient(45deg, #f3ec78, #af4261)',
      showSunburst: false,
    },
    position: { x: 0, y: 0 },
  });

  const handleImageDrop = (file: File) => {
    setEditorState((prev) => ({ ...prev, image: file }));
  };

  const updateEditorState = (updates: Partial<EditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }));
  };

  // Extract the main color from background for sunburst
  const getBackgroundColor = () => {
    if (editorState.background.type === 'solid') {
      return editorState.background.color || '#000000';
    } else if (editorState.background.type === 'gradient') {
      // Extract the last color from gradient
      const match = editorState.background.gradient?.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
      return match ? match[match.length - 1] : '#000000';
    }
    return '#000000';
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-background rounded-lg border">
      <div className="flex gap-6">
        {/* Preview Area */}
        <div className="flex-1 min-h-[600px] max-h-[80vh] bg-muted rounded-lg relative">
          <div className="relative h-full">
            <div className="absolute inset-0 pointer-events-none">
              {editorState.background.showSunburst && (
                <SunburstPattern 
                  color={getBackgroundColor()} 
                />
              )}
            </div>
            {editorState.image ? (
              <FramePreview state={editorState} />
            ) : (
              <ImageDropzone onDrop={handleImageDrop} />
            )}
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="w-80 flex flex-col gap-4">
          <EditorControls 
            state={editorState}
            onChange={updateEditorState}
          />
          <ExportOptions state={editorState} />
        </div>
      </div>
    </div>
  );
} 