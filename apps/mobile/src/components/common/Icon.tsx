import React from 'react';
import { Image } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Polyline,
  Polygon,
  G,
  Ellipse,
} from 'react-native-svg';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = '#4B5563',
  fill = 'none',
  strokeWidth = 2,
  style,
}) => {
  switch (name) {
    case 'phone':
    case 'Phone':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </Svg>
      );

    case 'phone-call':
    case 'PhoneCall':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          <Path d="M14 2a9 9 0 0 1 8 8" />
          <Path d="M14 6a5 5 0 0 1 4 4" />
        </Svg>
      );

    case 'video':
    case 'Video':
    case 'camera-video':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="23 7 16 12 23 17 23 7" />
          <Rect width={14} height={14} x={1} y={5} rx={2} ry={2} />
        </Svg>
      );

    case 'video-off':
    case 'VideoOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M10.66 5H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <Path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
          <Line x1={2} x2={22} y1={2} y2={22} />
        </Svg>
      );

    case 'mic':
    case 'Mic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <Line x1={12} x2={12} y1={19} y2={22} />
        </Svg>
      );

    case 'mic-off':
    case 'MicOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={2} x2={22} y1={2} y2={22} />
          <Path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
          <Path d="M5 10v2a7 7 0 0 0 12 5" />
          <Path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
          <Path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          <Line x1={12} x2={12} y1={19} y2={22} />
        </Svg>
      );

    case 'moon':
    case 'Moon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </Svg>
      );

    case 'smartphone':
    case 'Smartphone':
    case 'mobile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={14} height={20} x={5} y={2} rx={2} ry={2} />
          <Line x1={12} x2={12.01} y1={18} y2={18} />
        </Svg>
      );

    case 'wifi':
    case 'Wifi':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 20h.01" />
          <Path d="M2 8.82a15 15 0 0 1 20 0" />
          <Path d="M5 12.86a10 10 0 0 1 14 0" />
          <Path d="M8.5 16.43a5 5 0 0 1 7 0" />
        </Svg>
      );

    case 'database':
    case 'Database':
    case 'hard-drive':
    case 'HardDrive':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Ellipse cx={12} cy={5} rx={9} ry={3} />
          <Path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <Path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </Svg>
      );

    case 'sliders':
    case 'Sliders':
    case 'filter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={4} x2={4} y1={21} y2={14} />
          <Line x1={4} x2={4} y1={10} y2={3} />
          <Line x1={12} x2={12} y1={21} y2={12} />
          <Line x1={12} x2={12} y1={8} y2={3} />
          <Line x1={20} x2={20} y1={21} y2={16} />
          <Line x1={20} x2={20} y1={12} y2={3} />
          <Line x1={1} x2={7} y1={14} y2={14} />
          <Line x1={9} x2={15} y1={8} y2={8} />
          <Line x1={17} x2={23} y1={16} y2={16} />
        </Svg>
      );

    case 'zap':
    case 'Zap':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </Svg>
      );

    case 'trash-2':
    case 'Trash2':
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 6h18" />
          <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <Line x1={10} x2={10} y1={11} y2={17} />
          <Line x1={14} x2={14} y1={11} y2={17} />
        </Svg>
      );

    case 'flag':
    case 'Flag':
    case 'report':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <Line x1={4} x2={4} y1={22} y2={15} />
        </Svg>
      );

    case 'x':
    case 'X':
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={18} x2={6} y1={6} y2={18} />
          <Line x1={6} x2={18} y1={6} y2={18} />
        </Svg>
      );

    case 'clock':
    case 'Clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Polyline points="12 6 12 12 16 14" />
        </Svg>
      );

    case 'radio':
    case 'Radio':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <Path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <Circle cx={12} cy={12} r={2} />
          <Path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <Path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
        </Svg>
      );
    case 'company':
    case 'company-building':
    case 'studio':
    case 'studio-page':
    case 'building-2':
    case 'Building2':
      return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Path
            d="M15 85 H85 V30 C85 24, 80 20, 74 20 H50"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15 85 V25 C15 19, 20 15, 26 15 H50 V85"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Line x1="28" y1="30" x2="38" y2="30" stroke={color} strokeWidth="6" strokeLinecap="round" opacity={0.4} />
          <Line x1="28" y1="45" x2="38" y2="45" stroke={color} strokeWidth="6" strokeLinecap="round" opacity={0.4} />
          <Line x1="28" y1="60" x2="38" y2="60" stroke={color} strokeWidth="6" strokeLinecap="round" opacity={0.4} />
          <Line x1="62" y1="35" x2="72" y2="35" stroke={color} strokeWidth="6" strokeLinecap="round" opacity={0.4} />
          <Line x1="62" y1="50" x2="72" y2="50" stroke={color} strokeWidth="6" strokeLinecap="round" opacity={0.4} />
          <Path
            d="M42 85 V70 C42 66, 45 62, 50 62 C55 62, 58 66, 58 70 V85"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M26 15 V8" stroke={color} strokeWidth="5" strokeLinecap="round" />
          <Circle cx="26" cy="5" r="3" fill={color} />
        </Svg>
      );

    case 'vendor':
    case 'vendor-store':
    case 'store':
    case 'Store':
      return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Path
            d="M15 42 V80 C15 88, 20 93, 28 93 H65"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            d="M85 42 V55"
          />
          <Path
            d="M10 25 H90 V38 C90 44, 85 48, 80 48 C75 48, 70 44, 70 38 C70 44, 65 48, 60 48 C55 48, 50 44, 50 38 C50 44, 45 48, 40 48 C35 48, 30 44, 30 38 V45 C30 45, 10 45, 10 38 Z"
            stroke={color}
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <G transform="translate(75, 78)">
            <Circle cx="0" cy="-18" r="12" stroke={color} strokeWidth="7" fill="#FFFFFF" />
            <Path d="M-20 12 C-20 -2, 20 -2, 20 12" stroke={color} strokeWidth="7" strokeLinecap="round" fill="#FFFFFF" />
          </G>
        </Svg>
      );

    // Custom CineCraft Icons
    case 'badge-check':
    case 'BadgeCheck':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="#FFFFFF" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <Polyline points="9 12 11 14 15 10" stroke="#FFFFFF" strokeWidth={strokeWidth + 0.5} />
        </Svg>
      );

    case 'info':
    case 'Info':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Line x1={12} x2={12} y1={16} y2={12} />
          <Line x1={12} x2={12.01} y1={8} y2={8} />
        </Svg>
      );

    case 'copy':
    case 'Copy':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={14} height={14} x={8} y={8} rx={2} ry={2} />
          <Path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </Svg>
      );

    case 'reply':
    case 'Reply':
    case 'corner-up-left':
    case 'CornerUpLeft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="9 14 4 9 9 4" />
          <Path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </Svg>
      );

    case 'forward':
    case 'Forward':
    case 'share-2':
    case 'Share2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={18} cy={5} r={3} />
          <Circle cx={6} cy={12} r={3} />
          <Circle cx={18} cy={19} r={3} />
          <Line x1={8.59} x2={15.42} y1={13.51} y2={17.49} />
          <Line x1={15.41} x2={8.59} y1={6.51} y2={10.49} />
        </Svg>
      );

    case 'heart-fill':
    case 'HeartFill':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </Svg>
      );

    case 'user':
    case 'User':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <Circle cx={12} cy={7} r={4} />
        </Svg>
      );

    case 'tag':
    case 'Tag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <Path d="M7 7h.01" />
        </Svg>
      );

    case 'hash':
    case 'Hash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={4} x2={20} y1={9} y2={9} />
          <Line x1={4} x2={20} y1={15} y2={15} />
          <Line x1={10} x2={8} y1={3} y2={21} />
          <Line x1={16} x2={14} y1={3} y2={21} />
        </Svg>
      );

    case 'play':
    case 'Play':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="5 3 19 12 5 21 5 3" />
        </Svg>
      );

    case 'DiscussionRoomIcon':
    case 'discussions':
    case 'discussion-room':
    case 'discussion-rooms':
      return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Path
            d="M45 28 C45 18, 56 10, 70 10 C84 10, 95 18, 95 28 C95 38, 84 46, 70 46 L70 54 L62 46 C52 46, 45 38, 45 28 Z"
            fill={color}
            opacity={0.8}
          />
          <Path
            d="M5 32 C5 21, 16 12, 30 12 C44 12, 55 21, 55 32 C55 43, 44 52, 30 52 L30 62 L20 52 C10 52, 5 43, 5 32 Z"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={3}
          />
          <Path
            d="M15 28 H45 M15 36 H45 M15 44 H30"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle cx={25} cy={72} r={8} fill={color} opacity={0.7} />
          <Path d="M5 100 C5 85, 45 85, 45 100" fill={color} opacity={0.7} />
          <Circle cx={75} cy={72} r={8} fill={color} opacity={0.7} />
          <Path d="M55 100 C55 85, 95 85, 95 100" fill={color} opacity={0.7} />
          <Circle cx={50} cy={68} r={11} fill={color} stroke="#FFFFFF" strokeWidth={3} />
          <Path
            d="M20 100 C20 80, 80 80, 80 100"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={3}
          />
        </Svg>
      );

    case 'StudioPageIcon':
    case 'pages':
    case 'building-2':
    case 'building':
      return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Path
            d="M15 85 H85 V30 C85 24, 80 20, 74 20 H50"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15 85 V25 C15 19, 20 15, 26 15 H50 V85"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Line x1={28} y1={30} x2={38} y2={30} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.4} />
          <Line x1={28} y1={45} x2={38} y2={45} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.4} />
          <Line x1={28} y1={60} x2={38} y2={60} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.4} />
          <Line x1={62} y1={35} x2={72} y2={35} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.4} />
          <Line x1={62} y1={50} x2={72} y2={50} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.4} />
          <Path
            d="M42 85 V70 C42 66, 45 62, 50 62 C55 62, 58 66, 58 70 V85"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M26 15 V8" stroke={color} strokeWidth={5} strokeLinecap="round" />
          <Circle cx={26} cy={5} r={3} fill={color} />
        </Svg>
      );

    case 'VendorIcon':
    case 'vendors':
      return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Path
            d="M15 42 V80 C15 88, 20 93, 28 93 H65"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M85 42 V55" stroke={color} strokeWidth={7} strokeLinecap="round" />
          <Path
            d="M10 25 H90 V38 C90 44, 85 48, 80 48 C75 48, 70 44, 70 38 C70 44, 65 48, 60 48 C55 48, 50 44, 50 38 C50 44, 45 48, 40 48 C35 48, 30 44, 30 38 V45 C30 45, 10 45, 10 38 Z"
            stroke={color}
            strokeWidth={7}
            strokeLinejoin="round"
            fill="none"
          />
          <G transform="translate(75, 78)">
            <Circle cx={0} cy={-18} r={12} stroke={color} strokeWidth={7} fill="#FFFFFF" />
            <Path d="M-20 12 C-20 -2, 20 -2, 20 12" stroke={color} strokeWidth={7} strokeLinecap="round" fill="#FFFFFF" />
          </G>
        </Svg>
      );

    // Standard Lucide Icons
    case 'home':
    case 'Home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </Svg>
      );

    case 'film':
    case 'Film':
    case 'projects':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={20} height={20} x={2} y={2} rx={2.18} ry={2.18} />
          <Line x1={7} x2={7} y1={2} y2={22} />
          <Line x1={17} x2={17} y1={2} y2={22} />
          <Line x1={2} x2={22} y1={12} y2={12} />
          <Line x1={2} x2={7} y1={7} y2={7} />
          <Line x1={2} x2={7} y1={17} y2={17} />
          <Line x1={17} x2={22} y1={17} y2={17} />
          <Line x1={17} x2={22} y1={7} y2={7} />
        </Svg>
      );

    case 'briefcase':
    case 'Briefcase':
    case 'jobs':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <Rect width={20} height={14} x={2} y={6} rx={2} />
        </Svg>
      );

    case 'users':
    case 'Users':
    case 'network':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
      );

    case 'globe':
    case 'Globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Line x1={2} x2={22} y1={12} y2={12} />
          <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </Svg>
      );

    case 'bookmark':
    case 'Bookmark':
    case 'bookmark-fill':
    case 'saved':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path
            d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
            fill={fill}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );


    case 'star':
    case 'Star':
    case 'ratings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </Svg>
      );

    case 'megaphone':
    case 'Megaphone':
    case 'announcements':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m3 11 18-5v12L3 14v-3z" />
          <Path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </Svg>
      );

    case 'shopping-bag':
    case 'ShoppingBag':
    case 'marketplace':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <Path d="M3 6h18" />
          <Path d="M16 10a4 4 0 0 1-8 0" />
        </Svg>
      );

    case 'lightbulb':
    case 'Lightbulb':
    case 'pitch':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <Path d="M9 18h6" />
          <Path d="M10 22h4" />
        </Svg>
      );

    case 'more-horizontal':
    case 'MoreHorizontal':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={1} fill={color} />
          <Circle cx={19} cy={12} r={1} fill={color} />
          <Circle cx={5} cy={12} r={1} fill={color} />
        </Svg>
      );

    case 'more-vertical':
    case 'MoreVertical':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={1} fill={color} />
          <Circle cx={12} cy={5} r={1} fill={color} />
          <Circle cx={12} cy={19} r={1} fill={color} />
        </Svg>
      );

    case 'search':
    case 'Search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={11} cy={11} r={8} />
          <Path d="m21 21-4.3-4.3" />
        </Svg>
      );

    case 'message-square':
    case 'MessageSquare':
    case 'messages':
    case 'chat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </Svg>
      );

    case 'bell':
    case 'Bell':
    case 'notifications':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </Svg>
      );

    case 'heart':
    case 'Heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </Svg>
      );


    case 'pin':
    case 'Pin':
    case 'push-pin':
    case 'pinned':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={12} y1={17} x2={12} y2={22} />
          <Path d="M5 17h14l-1.5-6H19l-1.5-6h-11L5 11h1.5L5 17z" />
        </Svg>
      );

    case 'share':
    case 'Share':
    case 'share-2':
    case 'Share2':
    case 'share-3':
    case 'Share3':
    case 'share-alt':
    case 'share-social':
    case 'share-outline':
    case 'forward':
    case 'Forward':
      return (
        <Image
          source={require('../../assets/share.png')}
          style={[{ width: size, height: size, tintColor: color }, style]}
          resizeMode="contain"
        />
      );

    case 'plus':
    case 'Plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 12h14" />
          <Path d="M12 5v14" />
        </Svg>
      );

    case 'plus-circle':
    case 'PlusCircle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Line x1={12} x2={12} y1={8} y2={16} />
          <Line x1={8} x2={16} y1={12} y2={12} />
        </Svg>
      );

    case 'youtube':
    case 'YouTube':
    case 'yt':
      return (
        <Image
          source={require('../../assets/youtube.png')}
          style={[{ width: size, height: size }, style]}
          resizeMode="contain"
        />
      );

    case 'spotify':
    case 'Spotify':
      return (
        <Image
          source={require('../../assets/spotify.png')}
          style={[{ width: size, height: size }, style]}
          resizeMode="contain"
        />
      );

    case 'check':
    case 'Check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );

    case 'check-square':
    case 'CheckSquare':
    case 'check_square':
    case 'task':
    case 'tasks':
    case 'Task':
    case 'Tasks':
    case 'check-box':
    case 'Checkbox':
    case 'list-todo':
    case 'ListTodo':
    case 'clipboard-list':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill !== 'none' ? fill : 'none'} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="9 11 12 14 22 4" />
          <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </Svg>
      );

    case 'x':
    case 'X':
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 6 6 18" />
          <Path d="m6 6 12 12" />
        </Svg>
      );

    case 'arrow-left':
    case 'ArrowLeft':
    case 'back':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m12 19-7-7 7-7" />
          <Path d="M19 12H5" />
        </Svg>
      );

    case 'arrow-right':
    case 'ArrowRight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 12h14" />
          <Path d="m12 5 7 7-7 7" />
        </Svg>
      );

    case 'chevron-right':
    case 'ChevronRight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m9 18 6-6-6-6" />
        </Svg>
      );

    case 'chevron-left':
    case 'ChevronLeft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m15 18-6-6 6-6" />
        </Svg>
      );

    case 'chevron-down':
    case 'ChevronDown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m6 9 6 6 6-6" />
        </Svg>
      );

    case 'chevron-up':
    case 'ChevronUp':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m18 15-6-6-6 6" />
        </Svg>
      );

    case 'video':
    case 'Video':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m22 8-6 4 6 4V8Z" />
          <Rect width={14} height={12} x={2} y={6} rx={2} ry={2} />
        </Svg>
      );

    case 'video-off':
    case 'VideoOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
          <Path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
          <Line x1={2} x2={22} y1={2} y2={22} />
        </Svg>
      );

    case 'phone':
    case 'Phone':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </Svg>
      );

    case 'phone-off':
    case 'PhoneOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
          <Line x1={2} x2={22} y1={2} y2={22} />
        </Svg>
      );

    case 'pin':
    case 'Pin':
    case 'push-pin':
    case 'pinned':
    case 'thumbtack':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="12" y1="17" x2="12" y2="22" />
          <Path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
        </Svg>
      );

    case 'mic':
    case 'Mic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <Line x1={12} x2={12} y1={19} y2={22} />
        </Svg>
      );

    case 'mic-off':
    case 'MicOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={2} x2={22} y1={2} y2={22} />
          <Path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
          <Path d="M5 10v2a7 7 0 0 0 12 5" />
          <Path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
          <Path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          <Line x1={12} x2={12} y1={19} y2={22} />
        </Svg>
      );

    case 'settings':
    case 'Settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <Circle cx={12} cy={12} r={3} />
        </Svg>
      );

    case 'lock':
    case 'Lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
          <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </Svg>
      );

    case 'shield':
    case 'Shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </Svg>
      );

    case 'eye':
    case 'Eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <Circle cx={12} cy={12} r={3} />
        </Svg>
      );

    case 'eye-off':
    case 'EyeOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <Line x1={2} x2={22} y1={2} y2={22} />
        </Svg>
      );

    case 'trash':
    case 'Trash':
    case 'trash-2':
    case 'Trash2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 6h18" />
          <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <Line x1={10} x2={10} y1={11} y2={17} />
          <Line x1={14} x2={14} y1={11} y2={17} />
        </Svg>
      );

    case 'edit':
    case 'Edit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </Svg>
      );

    case 'filter':
    case 'Filter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </Svg>
      );

    case 'map-pin':
    case 'MapPin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <Circle cx={12} cy={10} r={3} />
        </Svg>
      );

    case 'send':
    case 'Send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m22 2-7 20-4-9-9-4Z" />
          <Path d="M22 2 11 13" />
        </Svg>
      );

    case 'image':
    case 'Image':
    case 'image-plus':
    case 'ImagePlus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={18} height={18} x={3} y={3} rx={2} ry={2} />
          <Circle cx={9} cy={9} r={2} />
          <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </Svg>
      );

    case 'smile':
    case 'Smile':
    case 'emoji':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <Line x1="9" x2="9.01" y1="9" y2="9" />
          <Line x1="15" x2="15.01" y1="9" y2="9" />
        </Svg>
      );

    case 'paperclip':
    case 'Paperclip':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </Svg>
      );

    case 'user-plus':
    case 'UserPlus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Line x1={19} x2={19} y1={8} y2={14} />
          <Line x1={22} x2={16} y1={11} y2={11} />
        </Svg>
      );

    case 'calendar':
    case 'Calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={18} height={18} x={3} y={4} rx={2} ry={2} />
          <Line x1={16} x2={16} y1={2} y2={6} />
          <Line x1={8} x2={8} y1={2} y2={6} />
          <Line x1={3} x2={21} y1={10} y2={10} />
        </Svg>
      );

    case 'file-text':
    case 'FileText':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <Polyline points="14 2 14 8 20 8" />
          <Line x1={16} x2={8} y1={13} y2={13} />
          <Line x1={16} x2={8} y1={17} y2={17} />
          <Line x1={10} x2={8} y1={9} y2={9} />
        </Svg>
      );

    case 'clock':
    case 'Clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Polyline points="12 6 12 12 16 14" />
        </Svg>
      );

    case 'message-circle':
    case 'MessageCircle':
    case 'comment':
    case 'chat-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </Svg>
      );


    case 'download':
    case 'Download':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <Polyline points="7 10 12 15 17 10" />
          <Line x1={12} x2={12} y1={15} y2={3} />
        </Svg>
      );

    case 'upload':
    case 'Upload':
    case 'upload-cloud':
    case 'UploadCloud':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <Polyline points="17 8 12 3 7 8" />
          <Line x1={12} x2={12} y1={3} y2={15} />
        </Svg>
      );

    case 'folder':
    case 'Folder':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </Svg>
      );

    case 'layers':
    case 'Layers':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <Path d="m22 12.5-8.97 4.08a2 2 0 0 1-1.66 0L2 12.5" />
          <Path d="m22 17.5-8.97 4.08a2 2 0 0 1-1.66 0L2 17.5" />
        </Svg>
      );

    case 'book-open':
    case 'BookOpen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </Svg>
      );

    case 'dollar-sign':
    case 'DollarSign':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={12} x2={12} y1={2} y2={22} />
          <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </Svg>
      );

    case 'check-circle':
    case 'CheckCircle':
    case 'circle-check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Polyline points="22 4 12 14.01 9 11.01" />
        </Svg>
      );

    case 'user-check':
    case 'UserCheck':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Polyline points="16 11 18 13 22 9" />
        </Svg>
      );

    case 'user-x':
    case 'UserX':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Line x1={17} x2={22} y1={8} y2={13} />
          <Line x1={22} x2={17} y1={8} y2={13} />
        </Svg>
      );

    case 'camera':
    case 'Camera':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <Circle cx={12} cy={13} r={3} />
        </Svg>
      );

    case 'clipboard':
    case 'Clipboard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={8} height={4} x={8} y={2} rx={1} ry={1} />
          <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </Svg>
      );

    case 'link':
    case 'Link':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </Svg>
      );

    case 'refresh-cw':
    case 'RefreshCw':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="23 4 23 10 17 10" />
          <Polyline points="1 20 1 14 7 14" />
          <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </Svg>
      );

    case 'aperture':
    case 'Aperture':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Line x1="14.31" x2="20.05" y1="8" y2="17.94" />
          <Line x1="9.69" x2="21.17" y1="8" y2="8" />
          <Line x1="7.38" x2="13.12" y1="12" y2="2.06" />
          <Line x1="9.69" x2="3.95" y1="16" y2="6.06" />
          <Line x1="14.31" x2="2.83" y1="16" y2="16" />
          <Line x1="16.62" x2="10.88" y1="12" y2="21.94" />
        </Svg>
      );

    case 'sliders':
    case 'Sliders':
    case 'adjust':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="4" x2="4" y1="21" y2="14" />
          <Line x1="4" x2="4" y1="10" y2="3" />
          <Line x1="12" x2="12" y1="21" y2="12" />
          <Line x1="12" x2="12" y1="8" y2="3" />
          <Line x1="20" x2="20" y1="21" y2="16" />
          <Line x1="20" x2="20" y1="12" y2="3" />
          <Line x1="1" x2="7" y1="14" y2="14" />
          <Line x1="9" x2="15" y1="8" y2="8" />
          <Line x1="17" x2="23" y1="16" y2="16" />
        </Svg>
      );

    case 'crop':
    case 'Crop':
    case 'ratio':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <Path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </Svg>
      );

    case 'rotate-cw':
    case 'RotateCw':
    case 'rotate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <Polyline points="21 3 21 8 16 8" />
        </Svg>
      );

    case 'flip-horizontal':
    case 'FlipHorizontal':
    case 'flip':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
          <Path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
          <Line x1="12" x2="12" y1="2" y2="22" />
        </Svg>
      );

    case 'align-left':
    case 'AlignLeft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="17" x2="3" y1="6" y2="6" />
          <Line x1="21" x2="3" y1="12" y2="12" />
          <Line x1="15" x2="3" y1="18" y2="18" />
        </Svg>
      );

    case 'align-center':
    case 'AlignCenter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="18" x2="6" y1="6" y2="6" />
          <Line x1="21" x2="3" y1="12" y2="12" />
          <Line x1="18" x2="6" y1="18" y2="18" />
        </Svg>
      );

    case 'align-right':
    case 'AlignRight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="21" x2="7" y1="6" y2="6" />
          <Line x1="21" x2="3" y1="12" y2="12" />
          <Line x1="21" x2="9" y1="18" y2="18" />
        </Svg>
      );

    case 'sun':
    case 'Sun':
    case 'brightness':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="4" />
          <Path d="M12 2v2" />
          <Path d="M12 20v2" />
          <Path d="m4.93 4.93 1.41 1.41" />
          <Path d="m17.66 17.66 1.41 1.41" />
          <Path d="M2 12h2" />
          <Path d="M20 12h2" />
          <Path d="m6.34 17.66-1.41 1.41" />
          <Path d="m19.07 4.93-1.41 1.41" />
        </Svg>
      );

    case 'droplet':
    case 'droplets':
    case 'Droplet':
    case 'Droplets':
    case 'saturate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
        </Svg>
      );

    case 'thermometer':
    case 'Thermometer':
    case 'warmth':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
        </Svg>
      );

    case 'circle':
    case 'Circle':
    case 'vignette':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
        </Svg>
      );

    case 'cloud':
    case 'Cloud':
    case 'fade':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </Svg>
      );

    case 'sparkles':
    case 'Sparkles':
    case 'sharpen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </Svg>
      );

    case 'palette':
    case 'Palette':
    case 'colour':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="13.5" cy="6.5" r=".5" fill={color} />
          <Circle cx="17.5" cy="10.5" r=".5" fill={color} />
          <Circle cx="8.5" cy="7.5" r=".5" fill={color} />
          <Circle cx="6.5" cy="12.5" r=".5" fill={color} />
          <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </Svg>
      );

    case 'type':
    case 'Type':
    case 'text':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="4 7 4 4 20 4 20 7" />
          <Line x1="9" x2="15" y1="20" y2="20" />
          <Line x1="12" x2="12" y1="4" y2="20" />
        </Svg>
      );

    case 'save':
    case 'Save':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <Polyline points="17 21 17 13 7 13 7 21" />
          <Polyline points="7 3 7 8 15 8" />
        </Svg>
      );

    case 'badge-check':
    case 'BadgeCheck':
    case 'verified':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
            fill={color || '#FF4B33'}
          />
          <Path
            d="m9 12 2 2 4-4"
            stroke="#FFFFFF"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'check':
    case 'Check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );

    case 'zap':
    case 'Zap':
    case 'pro':
    case 'bolt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill !== 'none' ? fill : color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </Svg>
      );

    case 'maximize-2':
    case 'Maximize2':
    case 'fit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="15 3 21 3 21 9" />
          <Polyline points="9 21 3 21 3 15" />
          <Line x1="21" x2="14" y1="3" y2="10" />
          <Line x1="3" x2="10" y1="21" y2="14" />
        </Svg>
      );

    case 'grid':
    case 'Grid':
    case 'grid-3x3':
    case 'Grid3x3':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width="18" height="18" x="3" y="3" rx="2" />
          <Line x1="3" x2="21" y1="9" y2="9" />
          <Line x1="3" x2="21" y1="15" y2="15" />
          <Line x1="9" x2="9" y1="3" y2="21" />
          <Line x1="15" x2="15" y1="3" y2="21" />
        </Svg>
      );

    case 'briefcase':
    case 'Briefcase':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <Rect width="20" height="14" x="2" y="6" rx="2" />
        </Svg>
      );

    case 'star':
    case 'Star':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill !== 'none' ? fill : color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </Svg>
      );

    case 'award':
    case 'Award':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="8" r="6" />
          <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </Svg>
      );

    case 'crown':
    case 'Crown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </Svg>
      );

    case 'edit':
    case 'Edit':
    case 'edit-2':
    case 'edit-3':
    case 'pencil':
    case 'Pencil':
    case 'pen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </Svg>
      );

    case 'check':
    case 'Check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );

    case 'check-check':
    case 'CheckCheck':
    case 'checkCheck':
    case 'double-check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 6 7 17l-5-5" />
          <Path d="m22 10-7.5 7.5L13 16" />
        </Svg>
      );

    case 'check-circle':
    case 'CheckCircle':
    case 'check-circle-2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Polyline points="22 4 12 14.01 9 11.01" />
        </Svg>
      );

    case 'x':
    case 'X':
    case 'close':
    case 'Close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={18} y1={6} x2={6} y2={18} />
          <Line x1={6} y1={6} x2={18} y2={18} />
        </Svg>
      );

    case 'briefcase':
    case 'Briefcase':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect width={20} height={14} x={2} y={7} rx={2} ry={2} />
          <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </Svg>
      );

    case 'log-out':
    case 'logout':
    case 'LogOut':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline points="16 17 21 12 16 7" />
          <Line x1={21} y1={12} x2={9} y2={12} />
        </Svg>
      );

    // Call / audio-space icons that were missing and fell through to the "?" placeholder.
    case 'volume-2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </Svg>
      );

    case 'volume-x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <Line x1={23} y1={9} x2={17} y2={15} />
          <Line x1={17} y1={9} x2={23} y2={15} />
        </Svg>
      );

    case 'wifi-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Line x1={1} y1={1} x2={23} y2={23} />
          <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <Path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <Line x1={12} y1={20} x2={12.01} y2={20} />
        </Svg>
      );

    case 'monitor':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Rect x={2} y={3} width={20} height={14} rx={2} ry={2} />
          <Line x1={8} y1={21} x2={16} y2={21} />
          <Line x1={12} y1={17} x2={12} y2={21} />
        </Svg>
      );

    case 'headphones':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <Path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </Svg>
      );


    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={10} />
          <Line x1={12} x2={12} y1={8} y2={12} />
          <Line x1={12} x2={12.01} y1={16} y2={16} />
        </Svg>
      );
  }
};

export default Icon;
