'use client'

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EditorControlsProps {
  state: {
    frame: string;
    size: number;
    roundness: number;
    shadow: number;
    rotate: number;
    tilt: number;
    background: {
      type: string;
      color?: string;
      gradient?: string;
    };
  };
  onChange: (updates: Partial<typeof state>) => void;
}

export function EditorControls({ state, onChange }: EditorControlsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Frame</Label>
              <Select
                value={state.frame}
                onValueChange={(value) => onChange({ frame: value })}
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label>Background</Label>
          <Tabs defaultValue={state.background.type} className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="none">None</TabsTrigger>
              <TabsTrigger value="solid">Solid</TabsTrigger>
              <TabsTrigger value="gradient">Gradient</TabsTrigger>
            </TabsList>
            <TabsContent value="solid" className="mt-4">
              <input
                type="color"
                value={state.background.color || '#ffffff'}
                onChange={(e) =>
                  onChange({
                    background: { type: 'solid', color: e.target.value },
                  })
                }
                className="w-full h-10 rounded cursor-pointer"
              />
            </TabsContent>
            <TabsContent value="gradient" className="mt-4">
              <Select
                value={state.background.gradient}
                onValueChange={(value) =>
                  onChange({
                    background: { type: 'gradient', gradient: value },
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 