import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, X, Image as ImageIcon, Wand2, Download, Settings2, Loader2, Sparkles, Camera, Plus, ChevronDown, ChevronUp, Smile, Eye, Shirt, Scissors, Palette, Sun, KeyRound, Dumbbell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReferenceImage {
  id: string;
  dataUrl: string;
}

const PRESET_STYLES = [
  { label: 'CEO Corporate (Male)', prompt: 'High-end CEO corporate headshot, wearing a tailored charcoal Brioni suit, crisp white Charvet shirt, and a subtle navy Cartier silk tie. Studio lighting, neutral grey background, 85mm lens, sharp focus, highly detailed, photorealistic.' },
  { label: 'Executive (Female)', prompt: 'High-end executive corporate headshot, wearing a tailored Tom Ford blazer over a silk blouse, subtle Cartier jewelry. Soft studio lighting, neutral background, 85mm lens, sharp focus, highly detailed, photorealistic.' },
  { label: 'Cinematic Editorial', prompt: 'Cinematic fashion editorial portrait, wearing high-end designer clothing, dramatic rim lighting, shallow depth of field, 50mm lens, moody atmosphere, 8k resolution.' },
  { label: 'Luxury Lifestyle', prompt: 'Luxury lifestyle portrait, wearing a Loro Piana cashmere sweater, luxury watch visible. Natural golden hour lighting, blurred high-end modern home background, candid feel, 85mm lens.' }
];

interface HeadshotGeneratorProps {
  hasKey: boolean;
  onSelectKey: () => Promise<boolean>;
}

export default function HeadshotGenerator({ hasKey, onSelectKey }: HeadshotGeneratorProps) {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [prompt, setPrompt] = useState('');
  
  // Granular Controls
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expression, setExpression] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [hair, setHair] = useState('');
  const [outfit, setOutfit] = useState('');
  const [physique, setPhysique] = useState('');
  const [background, setBackground] = useState('');
  const [lighting, setLighting] = useState('');

  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);

  const suggestInput = async (field: string, setter: (val: string) => void) => {
    setIsSuggesting(field);
    try {
      // @ts-ignore
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const promptMap: Record<string, string> = {
        expression: "Suggest a highly detailed, modern, and professional facial expression for a portrait (e.g., 'Subtle confident smirk with relaxed eyes'). Return ONLY the suggestion text, max 10 words.",
        eyeColor: "Suggest a highly detailed, striking eye color description for a portrait (e.g., 'Piercing hazel with gold flecks'). Return ONLY the suggestion text, max 10 words.",
        hair: "Suggest a highly detailed, trendy, and modern hair style and color for a portrait (e.g., 'Textured messy crop with platinum blonde highlights'). Return ONLY the suggestion text, max 15 words.",
        outfit: "Suggest a highly detailed, luxurious, and modern outfit for a portrait, including specific high-end brands (e.g., 'Tailored Tom Ford charcoal suit, crisp white Charvet shirt, Cartier Santos watch, subtle patterned Hermes silk tie'). Return ONLY the suggestion text, max 25 words.",
        physique: "Suggest a highly detailed physical build/physique description for a portrait (e.g., 'Athletic, muscular build with broad shoulders'). Return ONLY the suggestion text, max 10 words.",
        background: "Suggest a highly detailed, modern, and luxurious background setting for a portrait (e.g., 'High-end minimalist office with floor-to-ceiling windows overlooking a city skyline at dusk'). Return ONLY the suggestion text, max 20 words.",
        lighting: "Suggest a highly detailed, professional lighting setup for a portrait (e.g., 'Dramatic cinematic rim lighting with a soft octabox key light'). Return ONLY the suggestion text, max 15 words.",
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: promptMap[field],
      });

      if (response.text) {
        setter(response.text.trim().replace(/^["']|["']$/g, ''));
      }
    } catch (e) {
      console.error(`Failed to suggest ${field}`, e);
    } finally {
      setIsSuggesting(null);
    }
  };

  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image-preview');
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [freeUses, setFreeUses] = useState(() => {
    const saved = localStorage.getItem('proshot_free_uses');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem('proshot_free_uses', freeUses.toString());
  }, [freeUses]);

  useEffect(() => {
    if (!hasKey) {
      setSelectedModel('gemini-2.5-flash-image');
    } else if (selectedModel === 'gemini-2.5-flash-image') {
      setSelectedModel('gemini-3.1-flash-image-preview');
    }
  }, [hasKey]);
  
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
    const hasDetails = expression || eyeColor || hair || outfit || physique || background || lighting;
    if (!prompt && !hasDetails) {
      setError("Please enter a prompt, select a style, or use the granular controls.");
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
      
      // Compile advanced prompt details
      const details = [];
      if (expression) details.push(`Facial expression: ${expression}`);
      if (eyeColor) details.push(`Eye color: ${eyeColor}`);
      if (hair) details.push(`Hair style and color: ${hair}`);
      if (outfit) details.push(`Outfit/Clothing: ${outfit}`);
      if (physique) details.push(`Physique/Body Type: ${physique}`);
      if (background) details.push(`Background setting: ${background}`);
      if (lighting) details.push(`Lighting: ${lighting}`);
      
      let finalPrompt = prompt;
      let usedEnhancement = false;
      
      if (referenceImages.length > 0 && details.length > 0) {
        setStatusMessage("Analyzing facial features and enhancing prompt...");
        try {
          const enhancementPrompt = `You are an expert AI image prompt engineer. Carefully analyze the subject's core facial features, bone structure, and ethnicity in the provided photos. Write a highly detailed prompt (max 60 words) for an image generation model that accurately reproduces their exact physical likeness, while applying the following style and overrides:\nBase Style: ${prompt || 'Professional portrait'}\nOverrides: ${details.join(', ')}\nOutput ONLY the final prompt text. Do not include any introductory text.`;

          const enhancementPromise = ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [...parts, { text: enhancementPrompt }] },
          });
          
          // 15 second timeout for enhancement to prevent hanging
          const textResponse = await Promise.race([
            enhancementPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Enhancement timeout")), 15000))
          ]) as any;
          
          if (textResponse.text) {
            finalPrompt = textResponse.text.trim();
            usedEnhancement = true;
            console.log("Enhanced Prompt:", finalPrompt);
          } else {
            finalPrompt += `\n\nSubject Details & Overrides:\n- ` + details.join('\n- ');
          }
        } catch (e) {
          console.error("Prompt enhancement failed or timed out", e);
          finalPrompt += `\n\nSubject Details & Overrides:\n- ` + details.join('\n- ');
        }
      } else if (details.length > 0) {
        finalPrompt += `\n\nSubject Details & Overrides:\n- ` + details.join('\n- ');
      }
      
      let response;
      let retries = 8;
      let delay = 3000;
      let attempt = 1;
      let currentPrompt = finalPrompt;
      let currentModel = selectedModel;

      let imageConfig: any = { aspectRatio };
      if (currentModel !== 'gemini-2.5-flash-image') {
        imageConfig.imageSize = imageSize;
      }

      while (retries > 0) {
        try {
          if (attempt > 1) {
            setStatusMessage(`Service is busy. Retrying... (Attempt ${attempt}/8)`);
          } else {
            setStatusMessage("Crafting your image...");
          }

          // Ensure prompt is not too long to avoid max tokens error
          const promptToSend = currentPrompt.length > 450 ? currentPrompt.substring(0, 450) + "..." : currentPrompt;

          response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: [...parts, { text: promptToSend }] },
            config: {
              // @ts-ignore
              imageConfig
            }
          });
          break; // Success, exit retry loop
        } catch (err: any) {
          const isHighDemand = err.message?.includes("503") || 
                              err.status === 503 || 
                              err.message?.includes("high demand") ||
                              err.message?.includes("UNAVAILABLE") ||
                              err.message?.includes("overloaded");
                              
          const isTokenLimit = err.message?.toLowerCase().includes("token") || err.message?.toLowerCase().includes("limit");
                              
          if ((isHighDemand || isTokenLimit) && retries > 1) {
            retries--;
            attempt++;
            
            if (isTokenLimit) {
               // Aggressively truncate prompt if we hit a token limit
               currentPrompt = currentPrompt.substring(0, Math.max(100, currentPrompt.length - 100));
               console.log("Truncating prompt due to token limit error...");
            }
            
            // If the enhanced prompt might be causing the 503 (too complex), fallback to the basic prompt on attempt 4
            if (usedEnhancement && attempt === 4) {
               currentPrompt = prompt + (details.length > 0 ? `\n\nSubject Details & Overrides:\n- ` + details.join('\n- ') : '');
               console.log("Falling back to basic prompt to avoid 503...");
            }

            // If the premium model is overloaded, fallback to the standard model on attempt 6
            if (attempt === 6 && currentModel !== 'gemini-2.5-flash-image') {
               currentModel = 'gemini-2.5-flash-image';
               imageConfig = { aspectRatio }; // Standard model doesn't support imageSize
               console.log("Falling back to standard model to avoid 503...");
               setStatusMessage("Premium models busy. Falling back to standard model...");
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 10000); // Exponential backoff, max 10s
          } else if (isHighDemand && retries === 1) {
            throw new Error("All image models are currently experiencing extremely high demand. We tried 8 times but it's still busy. Please try again in a few minutes.");
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
        if (!hasKey) {
          setFreeUses(prev => prev + 1);
        }
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

        {!hasKey && freeUses < 3 && (
          <div className="mx-6 mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Free Trial</span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{Math.max(0, 3 - freeUses)} uses left</span>
            </div>
            <div className="w-full bg-blue-500/20 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (freeUses / 3) * 100)}%` }}></div>
            </div>
          </div>
        )}

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
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Base Style & Prompt</h2>
            
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
              placeholder="Describe the overall desired image style, atmosphere, and general look..."
              className="w-full h-24 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            />
          </section>

          {/* Advanced Customization */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 py-2 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <span className="flex items-center gap-2"><Palette className="w-4 h-4" /> Granular Controls</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            <AnimatePresence>
              {showAdvanced && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-4 pb-2"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {/* Expression */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><Smile className="w-3.5 h-3.5"/> Expression</label>
                        <button onClick={() => suggestInput('expression', setExpression)} disabled={isSuggesting === 'expression'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                          {isSuggesting === 'expression' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <input type="text" value={expression} onChange={e => setExpression(e.target.value)} placeholder="e.g. Subtle smirk..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    {/* Eye Color */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5"/> Eye Color</label>
                        <button onClick={() => suggestInput('eyeColor', setEyeColor)} disabled={isSuggesting === 'eyeColor'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                          {isSuggesting === 'eyeColor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <input type="text" value={eyeColor} onChange={e => setEyeColor(e.target.value)} placeholder="e.g. Emerald green..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors" />
                    </div>
                  </div>
                  
                  {/* Hair */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5"/> Hair Style & Color</label>
                      <button onClick={() => suggestInput('hair', setHair)} disabled={isSuggesting === 'hair'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                        {isSuggesting === 'hair' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input type="text" value={hair} onChange={e => setHair(e.target.value)} placeholder="e.g. Messy platinum blonde bob, slicked back dark hair..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  
                  {/* Physique */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5"/> Physique & Body Type</label>
                      <button onClick={() => suggestInput('physique', setPhysique)} disabled={isSuggesting === 'physique'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                        {isSuggesting === 'physique' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input type="text" value={physique} onChange={e => setPhysique(e.target.value)} placeholder="e.g. Athletic, muscular build with broad shoulders..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  
                  {/* Outfit */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5"/> Outfit & Brands</label>
                      <button onClick={() => suggestInput('outfit', setOutfit)} disabled={isSuggesting === 'outfit'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                        {isSuggesting === 'outfit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <textarea value={outfit} onChange={e => setOutfit(e.target.value)} placeholder="e.g. Navy blue Brioni suit with a red Hermes silk tie and white Tom Ford shirt..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors resize-none h-20" />
                  </div>
                  
                  {/* Background */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5"/> Background</label>
                      <button onClick={() => suggestInput('background', setBackground)} disabled={isSuggesting === 'background'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                        {isSuggesting === 'background' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input type="text" value={background} onChange={e => setBackground(e.target.value)} placeholder="e.g. High-end modern office with floor-to-ceiling windows..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  
                  {/* Lighting */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><Sun className="w-3.5 h-3.5"/> Lighting</label>
                      <button onClick={() => suggestInput('lighting', setLighting)} disabled={isSuggesting === 'lighting'} className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors" title="AI Suggestion">
                        {isSuggesting === 'lighting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input type="text" value={lighting} onChange={e => setLighting(e.target.value)} placeholder="e.g. Dramatic cinematic rim lighting, soft golden hour..." className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Settings */}
          <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Generation Settings
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    if (!hasKey && freeUses >= 3) {
                      onSelectKey();
                      return;
                    }
                    setSelectedModel(e.target.value);
                    if (e.target.value === 'gemini-3-pro-image-preview' && imageSize === '512px') {
                      setImageSize('1K'); // Pro doesn't support 512px
                    }
                  }}
                  className="w-full p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="gemini-2.5-flash-image">Standard</option>
                  <option value="gemini-3.1-flash-image-preview">Flash Image</option>
                  <option value="gemini-3-pro-image-preview">Pro Image</option>
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
            onClick={async () => {
              if (!hasKey && freeUses >= 3) {
                await onSelectKey();
                return;
              }
              generateImage();
            }}
            disabled={isGenerating || (!(prompt || expression || eyeColor || hair || outfit || physique || background || lighting) && (hasKey || freeUses < 3))}
            className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/10 dark:shadow-white/10"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (!hasKey && freeUses >= 3) ? (
              <>
                <KeyRound className="w-5 h-5" />
                Login to Continue
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
