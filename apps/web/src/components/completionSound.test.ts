import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('stays silent until audio is prepared and plays distinct reminder and completion notes', async () => {
  const frequencies: number[] = [];
  class Audio {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    async resume() {
      this.state = 'running';
    }
    createOscillator() {
      const frequency = { value: 0 };
      return {
        frequency,
        connect() {},
        disconnect() {},
        start() {
          frequencies.push(frequency.value);
        },
        stop() {},
        type: 'sine',
        onended: null,
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
  }
  vi.stubGlobal('AudioContext', Audio);
  const sound = await import('./completionSound');
  sound.playCompletionSound(false);
  expect(frequencies).toEqual([]);
  await sound.prepareCompletionSound();
  sound.playCompletionSound(false);
  expect(frequencies.splice(0)).toEqual([659.25, 783.99]);
  sound.playCompletionSound(true);
  expect(frequencies.splice(0)).toEqual([523.25, 659.25, 783.99]);
  expect(sound.playReminderSound()).toBe(true);
  expect(frequencies).toEqual([523.25, 440]);
});
it('keeps the app usable when audio is unavailable', async () => {
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        throw new Error('Unavailable');
      }
    },
  );
  const sound = await import('./completionSound');
  await expect(sound.prepareCompletionSound()).resolves.toBeUndefined();
  expect(sound.playReminderSound()).toBe(false);
});
