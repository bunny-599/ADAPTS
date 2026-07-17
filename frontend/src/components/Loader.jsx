import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit } from 'lucide-react';

const LOADING_STEPS = [
  "Analyzing your learning topics...",
  "Formulating a mix of conceptual & practical questions...",
  "Consulting Gemini AI model for expert pedagogy...",
  "Structuring questions for deep understanding...",
  "Polishing questions for clarity and conciseness...",
];

export default function Loader() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="relative mb-8">
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 blur-lg opacity-75 animate-pulse-subtle"></div>
        
        {/* Spinner circle */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-slate-950">
          <BrainCircuit className="h-10 w-10 text-indigo-400 animate-float" />
          <div className="absolute -inset-0.5 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
        </div>
      </div>

      <h3 className="text-xl font-bold tracking-tight text-slate-100 flex items-center justify-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
        Generating Assessment Questions
      </h3>
      
      <div className="mt-3 h-6 max-w-md overflow-hidden text-center">
        <p className="text-sm font-medium text-slate-400 transition-all duration-500 transform translate-y-0">
          {LOADING_STEPS[currentStep]}
        </p>
      </div>

      <div className="mt-8 w-48 h-1 bg-slate-800 rounded-full overflow-hidden mx-auto">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-[loadingProgress_12s_ease-out_infinite]"></div>
      </div>
      
      {/* Dynamic Keyframe Injection for the custom bar width expansion */}
      <style>{`
        @keyframes loadingProgress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 99%; }
        }
      `}</style>
    </div>
  );
}
