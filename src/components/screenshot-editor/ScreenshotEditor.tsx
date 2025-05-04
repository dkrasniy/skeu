'use client'
import React, { useState } from 'react';
import { ImageDropzone } from './ImageDropzone';
import { EditorControls } from './EditorControls';
import { FramePreview } from './FramePreview';
import { ExportOptions } from './ExportOptions';

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
    },
    position: { x: 0, y: 0 },
  });

  const handleImageDrop = (file: File) => {
    setEditorState((prev) => ({ ...prev, image: file }));
  };

  const updateEditorState = (updates: Partial<EditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-background rounded-lg border">
      <div className="flex gap-6">
        {/* Preview Area */}
        <div className="flex-1 min-h-[600px]  max-h-[80vh] bg-muted rounded-lg">
          {editorState.image ? (
            <FramePreview state={editorState} />
          ) : (
            <ImageDropzone onDrop={handleImageDrop} />
          )}
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