export interface EditorState {
  image: File | null;
  frame: 'none' | 'macOS Light' | 'macOS Dark' | 'Windows' | 'Browser';
  size: number;
  roundness: number;
  shadow: number;
  rotate: number;
  tilt: number;
  background: {
    type: 'none' | 'solid' | 'gradient';
    color?: string;
    gradient?: string;
    showSunburst?: boolean;
  };
  position: {
    x: number;
    y: number;
  };
} 