import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const handle = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handle);
    return () => window.removeEventListener('beforeinstallprompt', handle);
  }, []);
  if (!prompt) return null;
  return (
    <button
      className="text-button"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      <Download size={16} />
      Install on this device
    </button>
  );
}
