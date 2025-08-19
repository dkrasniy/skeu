'use client'

import React, { useState, useCallback, DragEvent } from 'react';
import { ImageDropzone } from './ImageDropzone';
import { EditorControls } from './EditorControls';
import { FramePreview } from './FramePreview';
import { ExportOptions } from './ExportOptions';
import { SunburstPattern } from './SunburstPattern';
import { EditorState } from './types';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';

export function ScreenshotEditor({
  userData
}: {
  userData: any
}) {
  const [editorState, setEditorState] = useState<EditorState>({
    image: null,
    frame: 'macOS Light',
    size: 80,
    roundness: 8,
    shadow: 10,
    rotate: 0,
    tilt: 5,
    background: {
      type: 'gradient',
      gradient: 'linear-gradient(45deg, #f3ec78, #af4261)',
      showSunburst: true,
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
      className="flex flex-col gap-8 p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-screen relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-lg flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-600">
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
              {editorState.image ? 'Drop to replace image' : 'Drop to add image'}
            </p>
            <p className="text-sm text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
      )}
      
      <div className="flex gap-8 max-w-7xl mx-auto w-full">
        {/* Preview Area */}
        <div className="flex-1 min-h-[600px]">
          <div className="relative h-full rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
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
        <div className="w-80 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <EditorControls 
              state={editorState}
              onChange={updateEditorState}
            />
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <ExportOptions state={editorState} />
          </div>
          
          {userData ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-muted-foreground mb-3">Signed in as</div>
              <div className="font-medium mb-4">{userData?.email}</div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // Logout functionality temporarily disabled
                }}
              >
                Logout
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">Sign in to save your work</p>
                <Button asChild className="w-full">
                  <Link href="/auth/login">Login</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 