'use client'

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { EditorState } from './types';
import { CustomSlider } from '@/components/ui/custom-slider';
import {
  WindowIcon,
  ArrowsPointingOutIcon,
  Square2StackIcon,
  ArrowPathIcon,
  CubeTransparentIcon,
  ArrowsUpDownIcon,
  SwatchIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { GradientPreview } from './GradientPreview';

interface EditorControlsProps {
  state: EditorState;
  onChange: (updates: Partial<EditorState>) => void;
}

// Grid positions for the 3x3 preset grid
const GRID_POSITIONS = [
  { x: -100, y: -100 }, { x: 0, y: -100 }, { x: 100, y: -100 },
  { x: -100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 },
  { x: -100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 100 },
];

const GRADIENTS = [
  {
    value: 'linear-gradient(45deg, #f3ec78, #af4261)',
    label: 'Sunset',
  },
  {
    value: 'linear-gradient(45deg, #00c6fb, #005bea)',
    label: 'Ocean',
  },
  {
    value: 'linear-gradient(45deg, #84fab0, #8fd3f4)',
    label: 'Mint',
  },
  {
    value: 'linear-gradient(45deg, #a18cd1, #fbc2eb)',
    label: 'Lavender',
  },
  {
    value: 'linear-gradient(45deg, #fad0c4, #ff9a9e)',
    label: 'Peach',
  },
  {
    value: 'linear-gradient(45deg, #ffecd2, #fcb69f)',
    label: 'Warm Flame',
  },
  {
    value: 'linear-gradient(45deg, #ff9a9e, #fecfef)',
    label: 'Lady Lips',
  },
  {
    value: 'linear-gradient(45deg, #a8edea, #fed6e3)',
    label: 'Cotton Candy',
  },
  {
    value: 'linear-gradient(45deg, #5ee7df, #b490ca)',
    label: 'Magic Lake',
  },
  {
    value: 'linear-gradient(45deg, #d299c2, #fef9d7)',
    label: 'Young Passion',
  },
  {
    value: 'linear-gradient(45deg, #667eea, #764ba2)',
    label: 'Deep Blue',
  },
  {
    value: 'linear-gradient(45deg, #89f7fe, #66a6ff)',
    label: 'Aqua Splash',
  },
];

export function EditorControls({ state, onChange }: EditorControlsProps) {
  const handleBackgroundTypeChange = (type: 'none' | 'solid' | 'gradient') => {
    const newBackground = {
      ...state.background,
      type,
      // Keep existing color/gradient if available, or set defaults
      color: type === 'solid' ? (state.background.color || '#ffffff') : undefined,
      gradient: type === 'gradient' ? (state.background.gradient || 'linear-gradient(45deg, #f3ec78, #af4261)') : undefined,
    };
    onChange({ background: newBackground });
  };

  const ControlLabel = ({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>, children: React.ReactNode }) => (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <Label>{children}</Label>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Background Controls */}
      <div className="space-y-3">
        <ControlLabel icon={SwatchIcon}>Background</ControlLabel>
        <Tabs 
          defaultValue={state.background.type} 
          className="w-full"
          onValueChange={(value: string) => handleBackgroundTypeChange(value as 'none' | 'solid' | 'gradient')}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="none">None</TabsTrigger>
            <TabsTrigger value="solid">Solid</TabsTrigger>
            <TabsTrigger value="gradient">Gradient</TabsTrigger>
          </TabsList>
          <TabsContent value="solid" className="mt-4 space-y-4">
            <input
              type="color"
              value={state.background.color || '#ffffff'}
              onChange={(e) =>
                onChange({
                  background: { 
                    ...state.background,
                    type: 'solid', 
                    color: e.target.value 
                  },
                })
              }
              className="w-full h-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
            />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Sunburst Pattern</Label>
              <Switch
                checked={state.background.showSunburst}
                onCheckedChange={(checked) =>
                  onChange({
                    background: {
                      ...state.background,
                      showSunburst: checked,
                    },
                  })
                }
              />
            </div>
          </TabsContent>
            <TabsContent value="gradient" className="mt-4 space-y-4">
              <Select
                value={state.background.gradient}
                onValueChange={(value) =>
                  onChange({
                    background: { 
                      ...state.background,
                      type: 'gradient', 
                      gradient: value 
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {state.background.gradient ? (
                      <GradientPreview 
                        gradient={state.background.gradient}
                        label={GRADIENTS.find(g => g.value === state.background.gradient)?.label || 'Custom'}
                      />
                    ) : (
                      'Select gradient'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GRADIENTS.map((gradient) => (
                    <SelectItem key={gradient.value} value={gradient.value}>
                      <GradientPreview 
                        gradient={gradient.value}
                        label={gradient.label}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Sunburst Pattern</Label>
                <Switch
                  checked={state.background.showSunburst}
                  onCheckedChange={(checked) =>
                    onChange({
                      background: {
                        ...state.background,
                        showSunburst: checked,
                      },
                    })
                  }
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Frame Controls */}
        <div className="space-y-3">
          <ControlLabel icon={WindowIcon}>Frame</ControlLabel>
          <Select
            value={state.frame}
            onValueChange={(value: typeof state.frame) => onChange({ frame: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frame style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Frame</SelectItem>
              <SelectItem value="macOS Light">macOS Light</SelectItem>
              <SelectItem value="macOS Dark">macOS Dark</SelectItem>
              <SelectItem value="Windows">Windows</SelectItem>
              <SelectItem value="Browser">Browser</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Size Controls */}
        <div className="space-y-3">
          <ControlLabel icon={ArrowsPointingOutIcon}>Size</ControlLabel>
          <CustomSlider
            value={state.size}
            onChange={(value) => onChange({ size: value })}
            min={50}
            max={150}
            step={1}
            unit="%"
          />
        </div>

        {/* Roundness Controls */}
        <div className="space-y-3">
          <ControlLabel icon={Square2StackIcon}>Roundness</ControlLabel>
          <CustomSlider
            value={state.roundness}
            onChange={(value) => onChange({ roundness: value })}
            min={0}
            max={20}
            step={1}
            unit="px"
          />
        </div>

        {/* Shadow Controls */}
        <div className="space-y-3">
          <ControlLabel icon={CubeTransparentIcon}>Shadow</ControlLabel>
          <CustomSlider
            value={state.shadow}
            onChange={(value) => onChange({ shadow: value })}
            min={0}
            max={40}
            step={1}
            unit="px"
          />
        </div>

        {/* Rotate Controls */}
        <div className="space-y-3">
          <ControlLabel icon={ArrowPathIcon}>Rotate</ControlLabel>
          <CustomSlider
            value={state.rotate}
            onChange={(value) => onChange({ rotate: value })}
            min={-180}
            max={180}
            step={1}
            unit="°"
          />
        </div>

        {/* Tilt Controls */}
        <div className="space-y-3">
          <ControlLabel icon={ArrowsUpDownIcon}>Tilt</ControlLabel>
          <CustomSlider
            value={state.tilt}
            onChange={(value) => onChange({ tilt: value })}
            min={-45}
            max={45}
            step={1}
            unit="°"
          />
        </div>

        {/* Position Controls */}
        <div className="space-y-3">
          <ControlLabel icon={ArrowsRightLeftIcon}>Position</ControlLabel>
          
          {/* 3x3 Grid Presets */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-1">
              {GRID_POSITIONS.map((pos, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className={`h-8 w-8 p-0 rounded-md transition-colors ${
                    state.position.x === pos.x && state.position.y === pos.y
                      ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => onChange({ position: pos })}
                />
              ))}
            </div>
          </div>

          {/* X Position Slider */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">X Position</Label>
            <CustomSlider
              value={state.position.x}
              onChange={(x) => onChange({ position: { ...state.position, x } })}
              min={-100}
              max={100}
              step={1}
              unit="px"
            />
          </div>

          {/* Y Position Slider */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Y Position</Label>
            <CustomSlider
              value={state.position.y}
              onChange={(y) => onChange({ position: { ...state.position, y } })}
              min={-100}
              max={100}
              step={1}
              unit="px"
            />
          </div>
        </div>
    </div>
  );
} 