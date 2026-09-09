import { useState } from 'react';
import { avatarColors, avatarGroups, avatarLabel } from '@family/shared';
import { Avatar } from './Avatar';
export function AvatarPicker({ initial = 'star' }: { initial?: string }) {
  const [symbol, setSymbol] = useState(initial.split(':')[0]!);
  const [color, setColor] = useState(
    initial.split(':')[1] ??
      {
        sun: 'sky',
        leaf: 'mint',
        star: 'gold',
        moon: 'lavender',
        flower: 'rose',
        heart: 'rose',
      }[initial] ??
      'sky',
  );
  const [group, setGroup] = useState(
    Object.entries(avatarGroups).find(([, items]) =>
      items.includes(symbol),
    )?.[0] ?? 'People',
  );
  return (
    <fieldset className="avatar-picker">
      <legend>Choose an avatar</legend>
      <input type="hidden" name="avatar" value={`${symbol}:${color}`} />
      <div className="avatar-preview">
        <Avatar name={`${symbol}:${color}`} large />
        <div>
          <strong>{avatarLabel(symbol)}</strong>
          <p>Pick a character and a background color.</p>
        </div>
      </div>
      <div className="avatar-categories" aria-label="Avatar categories">
        {Object.keys(avatarGroups).map((category) => (
          <button
            type="button"
            key={category}
            aria-pressed={group === category}
            onClick={() => setGroup(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="avatar-options" aria-label={`${group} avatars`}>
        {avatarGroups[group as keyof typeof avatarGroups].map((item) => (
          <button
            type="button"
            key={item}
            aria-label={`Choose ${avatarLabel(item)}`}
            aria-pressed={symbol === item}
            onClick={() => setSymbol(item)}
          >
            <Avatar name={`${item}:${color}`} />
            <span>{avatarLabel(item)}</span>
          </button>
        ))}
      </div>
      <div className="avatar-colors" aria-label="Avatar background colors">
        {avatarColors.map((item) => (
          <button
            type="button"
            key={item}
            className={`avatar-color-${item}`}
            aria-label={`${avatarLabel(item)} background`}
            aria-pressed={color === item}
            onClick={() => setColor(item)}
          >
            {color === item ? '✓' : ''}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
