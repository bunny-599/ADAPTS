import React from 'react';
import { GraduationCap } from 'lucide-react';

export default function Navbar({ onReset }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Platform Name */}
          <div 
            onClick={onReset}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <GraduationCap className="h-5.5 w-5.5" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent">
                ADAPTS
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500 tracking-wider uppercase border-l border-slate-800 pl-2">
                Adaptive Assessment
              </span>
            </div>
          </div>

          {/* Navigation Items (MVP version) */}
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
            >
              Home
            </button>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
            >
              v1.0.0
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
