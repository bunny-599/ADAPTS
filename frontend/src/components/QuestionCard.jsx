import React, { useState } from 'react';
import { Copy, Check, MessageSquareCode, CheckCircle2, AlertTriangle, Terminal } from 'lucide-react';
import CodeEditor from './CodeEditor';

export default function QuestionCard({ index, question, answer, onChange, evaluation, disabled, subject, onOpenIDE }) {
  const [copied, setCopied] = useState(false);

  const questionText = question && typeof question === 'object' ? question.question : question;
  const isCoding = question && typeof question === 'object' ? question.type === 'coding' : false;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(questionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl glass-panel card-shine p-6 hover:border-slate-700/80 transition-all duration-300 transform hover:-translate-y-1 print:border-black print:text-black">
      {/* Top Banner Accent */}
      <div className={`absolute top-0 left-0 w-full h-[3px] transition-all duration-300 ${
        evaluation 
          ? evaluation.status === 'strong' 
            ? 'bg-emerald-500' 
            : 'bg-rose-500'
          : 'bg-gradient-to-r from-indigo-500 to-purple-600 opacity-70 group-hover:opacity-100'
      }`}></div>
      
      <div className="flex items-start justify-between gap-4">
        {/* Question Header */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-400 border border-indigo-500/20 print:border-black print:text-black">
            Q{index + 1}
          </span>
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase print:text-black">
            Assessment Question
          </span>
          {/* Evaluation Badge */}
          {evaluation && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase border animate-fade-in ${
              evaluation.status === 'strong'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {evaluation.status === 'strong' ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-rose-400" />
              )}
              {evaluation.status}
            </span>
          )}
        </div>

        {/* Copy Button */}
        <button
          onClick={copyToClipboard}
          className="rounded-lg p-1.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all duration-200 print:hidden"
          title="Copy Question"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Question Content */}
      <p className="mt-4 text-base font-semibold leading-relaxed text-slate-100 print:text-black">
        {questionText}
      </p>

      {/* Answer Draft Box */}
      <div className="mt-5 border-t border-slate-800/80 pt-4 print:border-black">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 print:text-black">
            <MessageSquareCode className="h-3.5 w-3.5 text-slate-500 print:text-black" />
            {disabled ? "Your Answer Submitted" : "Draft your answer"}
          </label>
          
          {!disabled && !isCoding && (
            <button
              type="button"
              onClick={onOpenIDE}
              className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer"
            >
              <Terminal className="h-3.5 w-3.5" />
              Open Code IDE
            </button>
          )}
        </div>

        {isCoding ? (
          <CodeEditor
            question={questionText}
            answer={answer}
            onChange={onChange}
            disabled={disabled}
            subject={subject}
          />
        ) : (
          <textarea
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? "(No answer drafted for this question)" : "Type your answer here to self-assess..."}
            className="w-full min-h-[85px] text-sm bg-slate-950/40 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 outline-none text-slate-200 placeholder:text-slate-600 transition-all duration-200 resize-y disabled:opacity-75 disabled:cursor-not-allowed print:bg-white print:text-black print:border-black"
          />
        )}
      </div>

      {/* AI Feedback Box */}
      {evaluation && (
        <div className={`mt-4 rounded-xl border p-4 animate-fade-in print:border-black print:text-black ${
          evaluation.status === 'strong'
            ? 'bg-emerald-500/5 border-emerald-500/10'
            : 'bg-rose-500/5 border-rose-500/10'
        }`}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 print:text-black">AI Feedback:</h4>
          <p className="text-sm text-slate-300 leading-relaxed print:text-black">{evaluation.feedback}</p>
        </div>
      )}
    </div>
  );
}

