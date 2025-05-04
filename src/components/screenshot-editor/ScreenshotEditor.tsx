'use client'
import React, { useState, useCallback, DragEvent } from 'react';
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

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleImageDrop = (file: File) => {
    setEditorState((prev) => ({ ...prev, image: file }));
    setIsDraggingOver(false);
  };

  const updateEditorState = (updates: Partial<EditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }));
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageDrop(file);
    }
    setIsDraggingOver(false);
  }, []);

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
    <div 
      className="flex flex-col gap-6 p-6 bg-background rounded-lg border relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg border-2 border-dashed border-primary">
          <div className="text-center">
            <p className="text-lg font-medium">
              {editorState.image ? 'Drop to replace image' : 'Drop to add image'}
            </p>
            <p className="text-sm text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
      )}
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