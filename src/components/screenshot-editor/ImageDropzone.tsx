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
      className={`h-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
        isDragActive 
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' 
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <input {...getInputProps()} />
      <div className={`p-4 rounded-full mb-6 transition-colors ${
        isDragActive 
          ? 'bg-blue-100 dark:bg-blue-900/30' 
          : 'bg-gray-100 dark:bg-gray-700'
      }`}>
        <Upload className={`w-8 h-8 transition-colors ${
          isDragActive 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-gray-500 dark:text-gray-400'
        }`} />
      </div>
      <div className="text-center space-y-3">
        <p className={`text-xl font-semibold transition-colors ${
          isDragActive 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-gray-700 dark:text-gray-300'
        }`}>
          {isDragActive ? 'Drop your image here' : 'Drag-n-drop your image here'}
        </p>
        <p className="text-sm text-muted-foreground">
          or use <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-md font-mono text-xs">⌘V</kbd> to paste from clipboard
        </p>
      </div>
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Supports PNG, JPG, GIF and WebP up to 10MB
        </p>
      </div>
    </div>
  );
} 