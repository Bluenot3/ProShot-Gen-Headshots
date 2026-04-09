import { useState, useEffect } from 'react';
import HeadshotGenerator from './components/HeadshotGenerator';

export default function App() {
  const [hasKey, setHasKey] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const has = await Promise.race([
          // @ts-ignore
          window.aistudio.hasSelectedApiKey(),
          new Promise(resolve => setTimeout(() => resolve(false), 2000))
        ]);
        setHasKey(has as boolean);
      } else {
        setHasKey(false);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasKey(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasKey(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Error selecting API key:", e);
      if (e instanceof Error && e.message.includes("Requested entity was not found")) {
         setHasKey(false);
      }
      return false;
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-800 rounded-full animate-spin"></div>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  return <HeadshotGenerator hasKey={hasKey} onSelectKey={handleSelectKey} />;
}
