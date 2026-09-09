import {
  Sun,
  Leaf,
  Star,
  Moon,
  Flower2,
  Heart,
  Cat,
  Dog,
  Rabbit,
  Bird,
  Fish,
  Turtle,
  Snail,
  Squirrel,
  TreePine,
  Mountain,
  Rainbow,
  Cloud,
  Rocket,
  Bot,
  Crown,
  Gamepad2,
  Music,
  Palette,
  Bike,
  Camera,
  CircleDot,
  Gem,
} from 'lucide-react';
import { avatarLabel } from '@family/shared';
const symbols = {
  sun: Sun,
  leaf: Leaf,
  star: Star,
  moon: Moon,
  flower: Flower2,
  heart: Heart,
  cat: Cat,
  dog: Dog,
  rabbit: Rabbit,
  bird: Bird,
  fish: Fish,
  turtle: Turtle,
  snail: Snail,
  squirrel: Squirrel,
  tree: TreePine,
  mountain: Mountain,
  rainbow: Rainbow,
  cloud: Cloud,
  rocket: Rocket,
  robot: Bot,
  crown: Crown,
  gamepad: Gamepad2,
  music: Music,
  palette: Palette,
  bike: Bike,
  camera: Camera,
  soccer: CircleDot,
  gem: Gem,
};
const legacyColors: Record<string, string> = {
  sun: 'sky',
  leaf: 'mint',
  star: 'gold',
  moon: 'lavender',
  flower: 'rose',
  heart: 'rose',
};
function Portrait({ number }: { number: number }) {
  const index = number - 1;
  const skin = ['#f6cda9', '#dca477', '#a86c47', '#754a36'][index % 4];
  const hair = ['#342a29', '#71452d', '#d6a246', '#53505a'][
    Math.floor(index / 4) % 4
  ];
  const style = Math.floor(index / 4) % 3;
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className="portrait-art">
      <path
        d="M9 80q2-24 31-24t31 24"
        fill={['#278576', '#7960b9', '#397cc0'][index % 3]}
      />
      {style === 1 && <path d="M19 51V31q0-24 21-24t21 24v29H19" fill={hair} />}
      <rect x="34" y="50" width="12" height="15" rx="5" fill={skin} />
      <ellipse cx="40" cy="34" rx="21" ry="25" fill={hair} />
      <circle cx="20" cy="38" r="5" fill={skin} />
      <circle cx="60" cy="38" r="5" fill={skin} />
      <ellipse cx="40" cy="37" rx="19" ry="23" fill={skin} />
      <path
        d={
          style === 2
            ? 'M20 30Q17 7 40 9q24 0 21 23L48 21 38 26 30 20Z'
            : 'M20 31Q16 9 40 9q24 0 21 25Q50 29 47 18Q37 30 20 31'
        }
        fill={hair}
      />
      <circle cx="32" cy="37" r="2" fill="#302c36" />
      <circle cx="48" cy="37" r="2" fill="#302c36" />
      <path
        d="M34 47q6 6 12 0"
        fill="none"
        stroke="#7e3c35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {index >= 12 && (
        <g fill="none" stroke="#323b51" strokeWidth="2">
          <rect x="24" y="32" width="14" height="11" rx="4" />
          <rect x="42" y="32" width="14" height="11" rx="4" />
          <path d="M38 36h4" />
        </g>
      )}
    </svg>
  );
}
export function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const [symbol = 'sun', color] = name.split(':');
  const Icon = symbols[symbol as keyof typeof symbols] ?? Sun;
  return (
    <span
      className={`avatar avatar-${symbol} avatar-color-${color ?? legacyColors[symbol] ?? 'sky'} ${large ? 'large' : ''}`}
      role="img"
      aria-label={`${avatarLabel(symbol)} avatar`}
    >
      {symbol.startsWith('person-') ? (
        <Portrait number={Number(symbol.slice(7))} />
      ) : (
        <Icon aria-hidden="true" strokeWidth={1.9} />
      )}
    </span>
  );
}
