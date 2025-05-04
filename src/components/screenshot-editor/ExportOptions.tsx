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

export function ExportOptions({ state }: ExportOptionsProps) {
  const handleExport = async () => {
    const container = document.querySelector('.screenshot-preview');
    if (!container) {
      toast.error("Nothing to save, make sure to add a screenshot first!");
      return;
    }

    const savingToast = toast.loading("Exporting image...");

    try {
      const scale = window.devicePixelRatio;
      const element = container as HTMLElement;

      // Create high-resolution image
      const data = await domtoimage.toPng(element, {
        height: element.offsetHeight * scale,
        width: element.offsetWidth * scale,
        style: {
          transform: "scale(" + scale + ")",
          transformOrigin: "top left",
          width: element.offsetWidth + "px",
          height: element.offsetHeight + "px",
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
      const scale = window.devicePixelRatio;
      const element = container as HTMLElement;

      const blob = await domtoimage.toBlob(element, {
        height: element.offsetHeight * scale,
        width: element.offsetWidth * scale,
        style: {
          transform: "scale(" + scale + ")",
          transformOrigin: "top left",
          width: element.offsetWidth + "px",
          height: element.offsetHeight + "px",
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
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={copyToClipboard}
          disabled={!state.image}
        >
          Copy
        </Button>
        <Button
          className="flex-1"
          onClick={handleExport}
          disabled={!state.image}
        >
          <Download className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
} 