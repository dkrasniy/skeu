import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface CustomSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export function CustomSlider({ value, onChange, min, max, step, unit = '' }: CustomSliderProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        min={min}
        max={max}
        step={step}
        className="flex-1"
      />
      <div className="flex items-center">
        <Input
          type="number"
          value={value}
          onChange={handleInputChange}
          className="w-16 h-8 text-right"
          min={min}
          max={max}
          step={step}
        />
        {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
} 