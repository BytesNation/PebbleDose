import { describe, expect, it } from 'vitest';
import { avatarColors, avatarSchema, avatarSymbols } from './avatars';
import { userUpdateSchema } from './index';
describe('avatar library', () => {
  it('accepts every combination and legacy profiles', () => {
    expect(new Set(avatarSymbols).size).toBe(52);
    for (const symbol of avatarSymbols)
      for (const color of avatarColors)
        expect(avatarSchema.safeParse(`${symbol}:${color}`).success).toBe(true);
    for (const avatar of ['sun', 'leaf', 'star', 'moon', 'flower', 'heart'])
      expect(avatarSchema.safeParse(avatar).success).toBe(true);
  });
  it('rejects unknown designs, colors, and malformed identifiers', () => {
    for (const avatar of [
      'person-25:sky',
      'cat:unknown',
      'cat:sky:extra',
      'cat:sky:',
      '<svg>',
      'cat',
      '',
    ])
      expect(avatarSchema.safeParse(avatar).success).toBe(false);
  });
  it('allows updating an adult avatar without replacing their PIN', () => {
    expect(
      userUpdateSchema.safeParse({
        name: 'Demo',
        displayName: 'Demo',
        role: 'ADULT',
        avatar: 'person-17:lavender',
        active: true,
      }).success,
    ).toBe(true);
  });
});
