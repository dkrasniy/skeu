'use client'
import React, { useState } from 'react';
import { ImageDropzone } from './ImageDropzone';
import { EditorControls } from './EditorControls';
import { FramePreview } from './FramePreview';
import { ExportOptions } from './ExportOptions';
import { SunburstPattern } from './SunburstPattern';
import { EditorState } from './types';

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
        <div className="relative mt-2 lg:mb-5 lg:mx-0 overflow-hidden w-full flex-1 flex flex-col items-stretch max-h-[90vh] h-full relative">
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