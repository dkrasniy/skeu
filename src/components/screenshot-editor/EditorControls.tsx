'use client'

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { EditorState } from './types';

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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Frame</Label>
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

            <div className="space-y-2">
              <Label>Size</Label>
              <Slider
                value={[state.size]}
                onValueChange={([value]) => onChange({ size: value })}
                min={50}
                max={150}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Roundness</Label>
              <Slider
                value={[state.roundness]}
                onValueChange={([value]) => onChange({ roundness: value })}
                min={0}
                max={20}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Shadow</Label>
              <Slider
                value={[state.shadow]}
                onValueChange={([value]) => onChange({ shadow: value })}
                min={0}
                max={40}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Rotate</Label>
              <Slider
                value={[state.rotate]}
                onValueChange={([value]) => onChange({ rotate: value })}
                min={-180}
                max={180}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Tilt</Label>
              <Slider
                value={[state.tilt]}
                onValueChange={([value]) => onChange({ tilt: value })}
                min={-45}
                max={45}
                step={1}
              />
            </div>

            {/* Position Controls */}
            <div className="space-y-4">
              <Label>Position</Label>
              
              {/* 3x3 Grid Presets */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {GRID_POSITIONS.map((pos, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={`aspect-square ${
                      state.position.x === pos.x && state.position.y === pos.y
                        ? 'bg-primary/20'
                        : ''
                    }`}
                    onClick={() => onChange({ position: pos })}
                  />
                ))}
              </div>

              {/* X Position Slider */}
              <div className="space-y-2">
                <Label className="text-sm">X Position</Label>
                <Slider
                  value={[state.position.x]}
                  onValueChange={([x]) =>
                    onChange({ position: { ...state.position, x } })
                  }
                  min={-100}
                  max={100}
                  step={1}
                />
              </div>

              {/* Y Position Slider */}
              <div className="space-y-2">
                <Label className="text-sm">Y Position</Label>
                <Slider
                  value={[state.position.y]}
                  onValueChange={([y]) =>
                    onChange({ position: { ...state.position, y } })
                  }
                  min={-100}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label>Background</Label>
          <Tabs 
            defaultValue={state.background.type} 
            className="mt-2"
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
                className="w-full h-10 rounded cursor-pointer"
              />
              <div className="flex items-center justify-between">
                <Label>Sunburst Pattern</Label>
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
                  <SelectValue placeholder="Select gradient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear-gradient(45deg, #f3ec78, #af4261)">
                    Sunset
                  </SelectItem>
                  <SelectItem value="linear-gradient(45deg, #00c6fb, #005bea)">
                    Ocean
                  </SelectItem>
                  <SelectItem value="linear-gradient(45deg, #84fab0, #8fd3f4)">
                    Mint
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <Label>Sunburst Pattern</Label>
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
        </CardContent>
      </Card>
    </div>
  );
} 