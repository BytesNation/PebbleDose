import { z } from 'zod';
export const avatarColors = [
  'sky',
  'rose',
  'gold',
  'lavender',
  'mint',
  'peach',
] as const;
export const avatarGroups = {
  People: Array.from({ length: 24 }, (_, i) => `person-${i + 1}`),
  Animals: [
    'cat',
    'dog',
    'rabbit',
    'bird',
    'fish',
    'turtle',
    'snail',
    'squirrel',
  ],
  Nature: [
    'sun',
    'leaf',
    'star',
    'moon',
    'flower',
    'heart',
    'tree',
    'mountain',
    'rainbow',
    'cloud',
  ],
  Fun: [
    'rocket',
    'robot',
    'crown',
    'gamepad',
    'music',
    'palette',
    'bike',
    'camera',
    'soccer',
    'gem',
  ],
};
export const avatarSymbols = Object.values(avatarGroups).flat();
const legacy = ['sun', 'leaf', 'star', 'moon', 'flower', 'heart'];
export const avatarSchema = z.string().refine((value) => {
  if (legacy.includes(value)) return true;
  const [symbol, color, extra] = value.split(':');
  return (
    value.split(':').length === 2 &&
    !extra &&
    avatarSymbols.includes(symbol ?? '') &&
    avatarColors.includes(color as (typeof avatarColors)[number])
  );
}, 'Choose an avatar from the library');
export function avatarLabel(symbol: string) {
  return symbol.startsWith('person-')
    ? `Person ${symbol.slice(7)}`
    : symbol[0]!.toUpperCase() + symbol.slice(1);
}
