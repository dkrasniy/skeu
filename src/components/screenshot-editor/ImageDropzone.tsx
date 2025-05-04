'use client'
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface ImageDropzoneProps {
  onDrop: (file: File) => void;
}

export function ImageDropzone({ onDrop }: ImageDropzoneProps) {
  const handleDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onDrop(acceptedFiles[0]);
    }
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors hover:bg-accent/50"
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">
          {isDragActive ? 'Drop your image here' : 'Drag-n-drop your image here'}
        </p>
        <p className="text-sm text-muted-foreground">
          or use <kbd className="px-2 py-1 bg-muted rounded">⌘V</kbd> to paste from clipboard
        </p>
      </div>
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Supports PNG, JPG, GIF and WebP
        </p>
      </div>
    </div>
  );
} 