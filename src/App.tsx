import { useState, useEffect } from 'react';
import HeadshotGenerator from './components/HeadshotGenerator';
import { KeyRound } from 'lucide-react';

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
        // Add a timeout to prevent hanging if the API doesn't respond
        const has = await Promise.race([
          // @ts-ignore
          window.aistudio.hasSelectedApiKey(),
          new Promise(resolve => setTimeout(() => resolve(true), 3000))
        ]);
        setHasKey(has as boolean);
      } else {
        // Fallback for local dev if needed
        setHasKey(true);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasKey(true); // Fallback
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
        // Assume success to mitigate race condition
        setHasKey(true);
      }
    } catch (e) {
      console.error("Error selecting API key:", e);
      if (e instanceof Error && e.message.includes("Requested entity was not found")) {
         setHasKey(false);
      }
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

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <KeyRound className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">API Key Required</h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              ProShot AI uses advanced image generation models (Gemini 3.1 Flash Image and Gemini 3 Pro Image) which require a paid Google Cloud API key to process your photos.
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 p-4 rounded-2xl text-sm text-blue-800 dark:text-blue-300 text-left">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Billing Information
            </p>
            <p className="text-blue-700/80 dark:text-blue-300/80">
              You must select an API key from a paid Google Cloud project. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline font-medium hover:text-blue-600 dark:hover:text-blue-200 transition-colors">Learn more about billing</a>.
            </p>
          </div>

          <button
            onClick={handleSelectKey}
            className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 shadow-md"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return <HeadshotGenerator />;
}
