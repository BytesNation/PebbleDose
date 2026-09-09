let context: AudioContext | undefined;
// Prepare during the tap, before the network request. Browsers require a user gesture.
export async function prepareCompletionSound() {
  try {
    context ??= new AudioContext();
    await context.resume().catch(() => {});
  } catch {
    /* Audio is optional. */
  }
}
export function playCompletionSound(fullDay: boolean) {
  playNotes(fullDay ? [523.25, 659.25, 783.99] : [659.25, 783.99]);
}
export function deviceSoundsEnabled() {
  return localStorage.getItem('pebbledose-success-sound') === 'true';
}
export function playReminderSound() {
  return playNotes([523.25, 440]);
}
function playNotes(notes: number[]) {
  if (!context || context.state !== 'running') return false;
  const start = context.currentTime;
  for (const [index, frequency] of notes.entries()) {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const at = start + index * 0.13;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0, at);
    volume.gain.linearRampToValueAtTime(0.06, at + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.32);
    oscillator.onended = () => {
      oscillator.disconnect();
      volume.disconnect();
    };
  }
  return true;
}
