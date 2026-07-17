import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowLeft, BookOpen, Layers } from 'lucide-react';

const FIELD_SUBJECTS = {
  "Engineering": ["Java", "Python", "DBMS", "Operating Systems", "Computer Networks"],
  "Finance": ["Corporate Finance", "Personal Finance", "Investment Banking", "Portfolio Management", "Financial Accounting"],
  "Healthcare": ["Anatomy", "Physiology", "Pharmacology", "Healthcare Administration", "Immunology"],
  "Business": ["Marketing", "Entrepreneurship", "Human Resource Management", "Strategic Management", "Supply Chain Management"],
  "School Education": ["Mathematics", "Science", "Social Studies", "English Literature", "Geography"]
};

export default function AssessmentForm({ onSubmit, onBack }) {
  const fields = Object.keys(FIELD_SUBJECTS);
  
  const [selectedField, setSelectedField] = useState(fields[0]);
  const [selectedSubject, setSelectedSubject] = useState(FIELD_SUBJECTS[fields[0]][0]);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');

  // Update subject when field changes
  useEffect(() => {
    const subjects = FIELD_SUBJECTS[selectedField];
    if (subjects && subjects.length > 0) {
      setSelectedSubject(subjects[0]);
    }
  }, [selectedField]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please describe what you learned today.');
      return;
    }
    if (topic.trim().length < 15) {
      setError('Please write at least a sentence (minimum 15 characters) so the AI can generate high-quality questions.');
      return;
    }
    setError('');
    onSubmit({ field: selectedField, subject: selectedSubject, topic: topic.trim() });
  };

  return (
    <div className="relative max-w-2xl mx-auto px-4 py-8 sm:py-12 animate-fade-in">
      {/* Background Orbs */}
      <div className="glow-indigo -top-10 left-10"></div>
      
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200 mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Back to Home
      </button>

      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        {/* Form header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-100 font-sans">
            Customize Assessment
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Fill in the details below to generate tailored questions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Field Selection */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 mb-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Field of Study
            </label>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full glass-input cursor-pointer appearance-none bg-slate-900 pr-10"
              style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat' }}
            >
              {fields.map((field) => (
                <option key={field} value={field} className="bg-slate-950 text-slate-100">
                  {field}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selection */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 mb-2">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full glass-input cursor-pointer appearance-none bg-slate-900 pr-10"
              style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat' }}
            >
              {FIELD_SUBJECTS[selectedField]?.map((subject) => (
                <option key={subject} value={subject} className="bg-slate-950 text-slate-100">
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {/* Learning Description Textarea */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-slate-300">
                Describe what you learned today
              </label>
              <span className={`text-xs ${topic.length < 15 ? 'text-slate-500' : 'text-indigo-400'}`}>
                {topic.length} chars
              </span>
            </div>
            <textarea
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (error) setError('');
              }}
              placeholder="Explain variables, loops, objects, or key concepts you just covered. The more detailed your description, the more relevant the generated questions will be."
              className="w-full min-h-[140px] glass-input focus:ring-indigo-500/50 resize-y"
            />
            {error && (
              <p className="mt-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
                {error}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="btn-primary w-full py-4 text-base font-bold group"
            >
              <Sparkles className="h-5 w-5 animate-pulse text-indigo-200" />
              Generate Questions
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
