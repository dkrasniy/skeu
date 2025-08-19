'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import domtoimage from 'dom-to-image';
import toast from 'react-hot-toast';
import { EditorState } from './types';

interface ExportOptionsProps {
  state: EditorState;
}

// Fixed export dimensions for consistent output regardless of window size
const EXPORT_CONFIG = {
  baseWidth: 1200,
  baseHeight: 800,
  scale: 2, // High resolution multiplier
};

export function ExportOptions({ state }: ExportOptionsProps) {
  // Smart export dimensions based on image content and consistent scaling
const getExportDimensions = async () => {
  if (state.image) {
    // Create a temporary image to get natural dimensions
    return new Promise<{width: number, height: number, cssWidth: number, cssHeight: number, scale: number}>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Use the original image dimensions as base, scaled appropriately
        const maxBaseSize = 1200;
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        
        let baseWidth, baseHeight;
        if (img.naturalWidth > img.naturalHeight) {
          baseWidth = Math.min(maxBaseSize, img.naturalWidth);
          baseHeight = baseWidth / aspectRatio;
        } else {
          baseHeight = Math.min(maxBaseSize, img.naturalHeight);
          baseWidth = baseHeight * aspectRatio;
        }
        
        // Add padding for frame and effects (approximate)
        const paddingFactor = 1.4; // Accounts for frame, shadow, padding
        const finalWidth = baseWidth * paddingFactor;
        const finalHeight = baseHeight * paddingFactor;
        
        const scale = 2; // High resolution multiplier
        
        resolve({
          width: finalWidth * scale,
          height: finalHeight * scale,
          cssWidth: finalWidth,
          cssHeight: finalHeight,
          scale
        });
      };
      img.src = URL.createObjectURL(state.image);
    });
  } else {
    // Fallback dimensions
    const width = 1200;
    const height = 800;
    const scale = 2;
    
    return Promise.resolve({
      width: width * scale,
      height: height * scale,
      cssWidth: width,
      cssHeight: height,
      scale
    });
  }
};

  const handleExport = async () => {
    const container = document.querySelector('.screenshot-preview');
    if (!container) {
      toast.error("Nothing to save, make sure to add a screenshot first!");
      return;
    }

    const savingToast = toast.loading("Exporting image...");

    try {
      const element = container as HTMLElement;
      const { width, height, cssWidth, cssHeight, scale } = await getExportDimensions();

      // Create high-resolution image with smart dimensions
      const data = await domtoimage.toPng(element, {
        width: width,
        height: height,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${cssWidth}px`,
          height: `${cssHeight}px`,
        },
      });

      // Create download link
      const a = document.createElement("a");
      a.href = data;
      a.download = `screenshot-${new Date().toISOString()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("Image exported!", { id: savingToast });
    } catch (error) {
      console.error('Failed to export image:', error);
      toast.error("Failed to export image", { id: savingToast });
    }
  };

  const copyToClipboard = async () => {
    if (!state.image) {
      toast.error("Nothing to copy, make sure to add a screenshot first!");
      return;
    }

    const container = document.querySelector('.screenshot-preview');
    if (!container) return;

    try {
      const element = container as HTMLElement;
      const { width, height, cssWidth, cssHeight, scale } = await getExportDimensions();

      const blob = await domtoimage.toBlob(element, {
        width: width,
        height: height,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${cssWidth}px`,
          height: `${cssHeight}px`,
        },
      });

      // Handle different browser compatibilities
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator?.userAgent);
      const isFirefox = navigator.userAgent.indexOf("Firefox") > -1;

      if (isFirefox) {
        toast.error("Firefox does not support this functionality");
        return;
      }

      if (isSafari) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
      }

      toast.success("Image copied to clipboard!");
    } catch (error) {
      console.error('Failed to copy image:', error);
      toast.error("Failed to copy image to clipboard");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export</h3>
      <div className="space-y-3">
        <Button
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          onClick={copyToClipboard}
          disabled={!state.image}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy to Clipboard
        </Button>
        <Button
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
          onClick={handleExport}
          disabled={!state.image}
        >
          <Download className="w-5 h-5 mr-2" />
          Save as PNG
        </Button>
      </div>
      {!state.image && (
        <p className="text-sm text-muted-foreground text-center">
          Upload an image to enable export options
        </p>
      )}
    </div>
  );
} 