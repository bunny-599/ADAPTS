import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Cpu, Database } from 'lucide-react';

export default function Home({ onStart }) {
  return (
    <div className="relative isolate px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 lg:px-8 max-w-7xl mx-auto flex flex-col justify-center animate-fade-in">
      {/* Background Orbs */}
      <div className="glow-indigo -top-20 left-10 sm:left-40"></div>
      <div className="glow-purple top-40 right-10 sm:right-20"></div>

      <div className="mx-auto max-w-3xl text-center">
        {/* Sparkles Header */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400 border border-indigo-500/20 mb-6 hover:bg-indigo-500/20 transition-all duration-300">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Generative AI Powered Assessment</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl font-sans bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          ADAPTS
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent sm:text-3xl">
          Adaptive Learning Assessment Platform
        </p>

        {/* Description */}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400">
          Describe what you learned today, select your study area, and instantly receive personalized, AI-generated assessment questions tailored to test both concepts and practical applications.
        </p>

        {/* Start Button */}
        <div className="mt-10 flex items-center justify-center">
          <button
            onClick={onStart}
            className="btn-primary px-8 py-4 text-lg font-bold group"
          >
            Start Assessment
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Feature Section (Aesthetics enhancement) */}
      <div className="mx-auto mt-20 max-w-5xl sm:mt-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Card 1 */}
          <div className="rounded-2xl glass-panel p-6 border-slate-800/80 hover:border-slate-700/80 transition-all duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Gemini AI Engine</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Utilizes the latest Gemini 1.5 Flash models to construct pedagogically sound, adaptive questions.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl glass-panel p-6 border-slate-800/80 hover:border-slate-700/80 transition-all duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 mb-4 border border-purple-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Deep Comprehension</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Focuses on testing concepts and practical application, ensuring you truly understand the subject matter.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl glass-panel p-6 border-slate-800/80 hover:border-slate-700/80 transition-all duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 mb-4 border border-cyan-500/20">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Dynamic Fields</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Covers multiple disciplines including Engineering, Finance, Healthcare, Business, and School Education.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
