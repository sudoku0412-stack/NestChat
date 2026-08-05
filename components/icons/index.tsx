import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../../lib/theme';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const DEFAULT_SIZE = 24;
const DEFAULT_COLOR = colors.text;

export function ChatBubbleIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 3v-3H5.5C4.67 16 4 15.33 4 14.5v-9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function StatusRingIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={7.5} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={12} r={2} fill={color} />
    </Svg>
  );
}

export function GearIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4.2} stroke={color} strokeWidth={strokeWidth} />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <G key={deg} rotation={deg} origin="12,12">
          <Rect x={10.7} y={2.3} width={2.6} height={4} rx={1} fill={color} />
        </G>
      ))}
    </Svg>
  );
}

export function CameraIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5.5 8 7H5.5A1.5 1.5 0 0 0 4 8.5v9A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18.5 7H16l-1-1.5H9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12.5} r={3.2} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ImageIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={14} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={9} cy={10} r={1.6} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5 16l4.5-4.5a1.5 1.5 0 0 1 2.1 0L15 15l1.2-1.2a1.5 1.5 0 0 1 2.1 0L20 15.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DocumentIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.5h7l3.5 3.5v12A1 1 0 0 1 16.5 20h-9A1 1 0 0 1 6.5 19V4.5A1 1 0 0 1 7 3.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M14 3.5V7h3.5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Line x1={9} y1={11} x2={15} y2={11} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={9} y1={14} x2={15} y2={14} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function PersonIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.2} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M5.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LocationPinIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.5s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 9.5c0 4.9 6.5 11 6.5 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9.5} r={2.2} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function PlusIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ReplyIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 6 4.5 12 11 18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.5 12h9.5a5.5 5.5 0 0 1 5.5 5.5V19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CopyIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={8.5} y={8.5} width={11} height={11} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M15.5 8.5V6.5A2 2 0 0 0 13.5 4.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StarIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8, filled = false }: IconProps & { filled?: boolean }) {
  const d = 'M12 4.5l2.2 4.9 5.3.6-4 3.7 1.1 5.3-4.6-2.7-4.6 2.7 1.1-5.3-4-3.7 5.3-.6L12 4.5Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function PinIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 3.5l6 6-2.3 2.3-1-.3-3.3 3.3.6 3-1.4 1.4-3.2-3.2-4 4-1-1 4-4-3.2-3.2 1.4-1.4 3 .6 3.3-3.3-.3-1 2.4-2.3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function TrashIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Line x1={10} y1={10.5} x2={10.3} y2={17} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={14} y1={10.5} x2={13.7} y2={17} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function StickerIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={7.5} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={9.3} cy={10} r={1.1} fill={color} />
      <Circle cx={14.7} cy={10} r={1.1} fill={color} />
      <Path
        d="M8.5 13.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
