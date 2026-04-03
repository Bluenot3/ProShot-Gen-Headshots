import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, X, Image as ImageIcon, Wand2, Download, Settings2, Loader2, Sparkles, Camera, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReferenceImage {
  id: string;
  dataUrl: string;
}

const PRESET_STYLES = [
  { label: 'Corporate Headshot', prompt: 'Professional corporate headshot, studio lighting, neutral grey background, 85mm lens, sharp focus, highly detailed, professional attire.' },
  { label: 'Cinematic Portrait', prompt: 'Cinematic portrait, dramatic rim lighting, shallow depth of field, 50mm lens, moody atmosphere, 8k resolution.' },
  { label: 'Creative Studio', prompt: 'Creative studio portrait, vibrant gel lighting (blue and pink), modern fashion editorial style, sharp, high contrast.' },
  { label: 'Outdoor Natural', prompt: 'Natural light outdoor portrait, golden hour, blurred natural background, soft lighting, candid feel, 85mm lens.' }
];

export default function HeadshotGenerator() {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map((file: File) => {
        return new Promise<ReferenceImage>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({
              id: Math.random().toString(36).substring(7),
              dataUrl: event.target?.result as string
            });
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(newImages).then(images => {
        setReferenceImages(prev => [...prev, ...images]);
      });
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  const generateImage = async () => {
    if (!prompt) {
      setError("Please enter a prompt or select a style.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // @ts-ignore - API_KEY is injected by AI Studio
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [];
      
      // Add reference images
      for (const img of referenceImages) {
        const mimeType = img.dataUrl.split(';')[0].split(':')[1];
        const base64Data = img.dataUrl.split(',')[1];
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }
      
      // Add text prompt
      parts.push({ text: prompt });
      
      let response;
      let retries = 5;
      let delay = 3000;
      let attempt = 1;

      while (retries > 0) {
        try {
          if (attempt > 1) {
            setStatusMessage(`Service is busy. Retrying... (Attempt ${attempt}/5)`);
          } else {
            setStatusMessage("Crafting your image...");
          }

          response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts },
            config: {
              // @ts-ignore - imageConfig is valid for these models
              imageConfig: {
                aspectRatio: aspectRatio,
                imageSize: imageSize
              }
            }
          });
          break; // Success, exit retry loop
        } catch (err: any) {
          const isHighDemand = err.message?.includes("503") || 
                              err.status === 503 || 
                              err.message?.includes("high demand") ||
                              err.message?.includes("UNAVAILABLE") ||
                              err.message?.includes("overloaded");
                              
          if (isHighDemand && retries > 1) {
            retries--;
            attempt++;
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 8000); // Exponential backoff, max 8s
          } else if (isHighDemand && retries === 1) {
            throw new Error("The image model is currently experiencing very high demand. We tried 5 times but it's still busy. Please try again in a few minutes.");
          } else {
            throw err;
          }
        }
      }
      
      let generatedImageUrl = null;
      for (const part of response?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }
      
      if (generatedImageUrl) {
        setResultImage(generatedImageUrl);
      } else {
        setError("No image was generated. Please try a different prompt or fewer reference images.");
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during generation.");
      if (err.message?.includes("Requested entity was not found")) {
        // Trigger re-auth by reloading
        setTimeout(() => window.location.reload(), 2000);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `proshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-500/30 flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <div className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto flex flex-col h-screen">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">ProShot AI</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Professional Portrait Studio</p>
          </div>
        </div>

        <div className="p-6 space-y-8 flex-grow">
          
          {/* Reference Images */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Reference Photos</h2>
              <span className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-zinc-600 dark:text-zinc-300">
                {referenceImages.length} uploaded
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <AnimatePresence>
                {referenceImages.map((img) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    key={img.id}
                    className="relative aspect-square rounded-xl overflow-hidden group border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"
                  >
                    <img src={img.dataUrl} alt="Reference" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs font-medium">Add Photo</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              Upload clear photos of your face from different angles for the best results. The model will use these to capture your likeness.
            </p>
          </section>

          {/* Prompt & Style */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Style & Prompt</h2>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_STYLES.map((style) => (
                <button
                  key={style.label}
                  onClick={() => setPrompt(style.prompt)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors border border-transparent active:scale-95"
                >
                  {style.label}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the desired image style, lighting, background, and attire..."
              className="w-full h-32 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            />
          </section>

          {/* Settings */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Generation Settings
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    if (e.target.value === 'gemini-3-pro-image-preview' && imageSize === '512px') {
                      setImageSize('1K'); // Pro doesn't support 512px
                    }
                  }}
                  className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="gemini-3.1-flash-image-preview">Flash Image (Fast, Editing)</option>
                  <option value="gemini-3-pro-image-preview">Pro Image (High Quality)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">Resolution</label>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors"
                  >
                    {selectedModel === 'gemini-3.1-flash-image-preview' && <option value="512px">512px</option>}
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="1:1">1:1 (Square)</option>
                    <option value="3:4">3:4 (Portrait)</option>
                    <option value="4:3">4:3 (Landscape)</option>
                    <option value="9:16">9:16 (Story)</option>
                    <option value="16:9">16:9 (Widescreen)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0 z-10">
          <button
            onClick={generateImage}
            disabled={isGenerating || !prompt}
            className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/10 dark:shadow-white/10"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Headshot
              </>
            )}
          </button>
          {error && (
            <motion.p 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-xs text-red-500 font-medium text-center bg-red-50 dark:bg-red-500/10 p-2 rounded-lg"
            >
              {error}
            </motion.p>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow bg-zinc-100 dark:bg-zinc-950/50 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        <div className="w-full max-w-4xl relative z-10 flex flex-col items-center justify-center min-h-[60vh]">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div
                key="generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                  <div className="w-24 h-24 border-4 border-blue-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-blue-500 animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">{statusMessage || "Crafting your image..."}</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs mx-auto">
                    Analyzing reference photos and applying professional studio styling. This usually takes 10-20 seconds.
                  </p>
                </div>
              </motion.div>
            ) : resultImage ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col items-center gap-6"
              >
                <div className="relative group rounded-2xl overflow-hidden shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900 max-h-[80vh]">
                  <img 
                    src={resultImage} 
                    alt="Generated Headshot" 
                    className="w-auto h-auto max-w-full max-h-[80vh] object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <button
                      onClick={downloadImage}
                      className="bg-white text-black px-6 py-3 rounded-full font-semibold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all hover:scale-105 active:scale-95 shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                      Download High-Res
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center flex flex-col items-center gap-4 text-zinc-400 dark:text-zinc-600"
              >
                <div className="w-24 h-24 rounded-3xl bg-zinc-200 dark:bg-zinc-800/50 flex items-center justify-center rotate-3 shadow-inner">
                  <ImageIcon className="w-10 h-10 -rotate-3" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Ready to create</h3>
                  <p className="text-sm max-w-sm mx-auto">Upload reference photos and describe your desired style to generate a professional headshot.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
