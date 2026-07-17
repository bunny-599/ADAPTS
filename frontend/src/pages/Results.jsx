import React, { useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import CodeEditorWorkspace from '../components/CodeEditorWorkspace';
import { ArrowLeft, Sparkles, Printer, Copy, Check, Download, CheckSquare } from 'lucide-react';

export default function Results({ responseData, onRestart, requestData, evaluationResult, onAnswersSubmit }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeIdeIndex, setActiveIdeIndex] = useState(null);
  const questions = responseData?.questions || [];
  
  // Maintain student answers state
  const [answers, setAnswers] = useState(Array(questions.length).fill(''));

  const handleAnswerChange = (index, value) => {
    const nextAnswers = [...answers];
    nextAnswers[index] = value;
    setAnswers(nextAnswers);
  };

  const copyAllQuestions = async () => {
    try {
      const formatted = questions.map((q, idx) => `Q${idx + 1}. ${q && typeof q === 'object' ? q.question : q}`).join('\n\n');
      const header = `ADAPTS Assessment - ${requestData.field} / ${requestData.subject}\nTopic: ${requestData.topic}\n\n`;
      await navigator.clipboard.writeText(header + formatted);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const downloadMarkdown = () => {
    const formatted = questions.map((q, idx) => {
      const qText = q && typeof q === 'object' ? q.question : q;
      const userAns = answers[idx] ? `*Student Answer:* ${answers[idx]}\n` : '';
      const evalItem = evaluationResult?.evaluations?.[idx];
      const feedback = evalItem ? `*Feedback:* [${evalItem.status.toUpperCase()}] ${evalItem.feedback}\n` : '';
      return `### Q${idx + 1}\n${qText}\n${userAns}${feedback}`;
    }).join('\n');
    
    const header = `# ADAPTS Assessment\n\n**Field:** ${requestData.field}\n**Subject:** ${requestData.subject}\n**Topic:** *${requestData.topic}*\n`;
    const score = evaluationResult ? `**Overall Score:** ${evaluationResult.overallScore}%\n` : '';
    const content = `${header}${score}\n---\n\n${formatted}`;
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `adapts-assessment-${requestData.subject.toLowerCase().replace(/\s+/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-fade-in print:bg-white print:text-black">
      {/* Background Glow */}
      <div className="glow-cyan -top-10 left-1/4"></div>
      <div className="glow-purple -bottom-10 right-10"></div>

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6 mb-8 print:border-black">
        <div>
          <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md print:hidden">
            {evaluationResult ? "Assessment Graded" : "Assessment Active"}
          </span>
          <h2 className="text-3xl font-black text-slate-100 mt-2 font-sans">
            Your Custom Assessment
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Based on your learning topic in <strong className="text-slate-200">{requestData.field} &rsaquo; {requestData.subject}</strong>.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={copyAllQuestions}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
            title="Copy all questions"
          >
            {copiedAll ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                Copied All
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All
              </>
            )}
          </button>
          
          <button
            onClick={downloadMarkdown}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
            title="Download as MD"
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
            title="Print assessment"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* AI Evaluation Overall Score banner */}
      {evaluationResult && (
        <div className="mb-8 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in print:border-black print:text-black">
          <div>
            <h3 className="text-xl font-bold text-slate-100 print:text-black">AI Assessment Grade</h3>
            <p className="text-sm text-slate-400 mt-1 print:text-slate-700">Review your results, strong vs. weak areas, and constructive feedback below.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase print:text-slate-700">Overall Score:</span>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 font-extrabold text-white text-lg shadow-lg shadow-indigo-500/20 print:border print:border-black print:text-black">
              {evaluationResult.overallScore}%
            </div>
          </div>
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-6">
        {questions.map((question, index) => {
          const evalItem = evaluationResult?.evaluations?.[index];
          return (
            <QuestionCard
              key={index}
              index={index}
              question={question}
              answer={answers[index]}
              onChange={(value) => handleAnswerChange(index, value)}
              evaluation={evalItem}
              disabled={!!evaluationResult}
              subject={requestData.subject}
              onOpenIDE={() => setActiveIdeIndex(index)}
            />
          );
        })}
      </div>

      {/* Submit Answers Button (AI evaluation trigger) */}
      {!evaluationResult && (
        <div className="mt-10 flex justify-center print:hidden">
          <button
            onClick={() => {
              const submission = questions.map((q, idx) => ({
                question: q && typeof q === 'object' ? q.question : q,
                userAnswer: answers[idx]
              }));
              onAnswersSubmit(submission);
            }}
            className="btn-primary w-full sm:w-auto px-10 py-4 font-bold text-lg shadow-indigo-500/30 group"
          >
            <CheckSquare className="h-5 w-5 transition-transform duration-300 group-hover:scale-105" />
            Submit Answers for AI Evaluation
          </button>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-8 print:hidden">
        <p className="text-xs text-slate-500 max-w-sm text-center sm:text-left leading-normal">
          Assessments are generated dynamically. If you want different formats or difficulty levels, try modifying your description notes.
        </p>
        <button
          onClick={onRestart}
          className="btn-secondary w-full sm:w-auto px-6 py-3.5 hover:border-indigo-500/50 hover:bg-slate-900 flex items-center justify-center gap-2 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Create New Assessment
        </button>
      </div>

      {/* Code Editor Modal Overlay */}
      {activeIdeIndex !== null && (
        <CodeEditorWorkspace
          question={questions[activeIdeIndex] && typeof questions[activeIdeIndex] === 'object' ? questions[activeIdeIndex].question : questions[activeIdeIndex]}
          index={activeIdeIndex}
          initialCode={answers[activeIdeIndex]}
          onSave={(code) => handleAnswerChange(activeIdeIndex, code)}
          onClose={() => setActiveIdeIndex(null)}
          subject={requestData.subject}
        />
      )}
    </div>
  );
}
