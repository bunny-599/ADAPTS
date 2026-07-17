import React from 'react';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-900 bg-slate-950 py-6 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} ADAPTS. All rights reserved.
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>Built with</span>
            <Heart className="h-4.5 w-4.5 text-rose-500 fill-rose-500/20" />
            <span>using Spring Boot, React, and Gemini AI.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
