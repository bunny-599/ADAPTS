import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Save, Code, CheckCircle, XCircle, Terminal, Cpu, Lightbulb, RefreshCw } from 'lucide-react';
import { runCode } from '../services/api';

const DEFAULT_BOILERPLATE = {
  Java: `public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n        System.out.println("Hello from Java!");\n    }\n}`,
  Python: `# Write your code here\ndef solution():\n    print("Hello from Python!")\n\nsolution()`,
  JavaScript: `// Write your code here\nfunction solution() {\n    console.log("Hello from JavaScript!");\n}\n\nsolution();`,
  'C++': `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    cout << "Hello from C++!" << endl;\n    return 0;\n}`,
  SQL: `-- Write your SQL query here\nSELECT * FROM learning_log WHERE topic = 'variables';`
};

export default function CodeEditorWorkspace({ question, index, initialCode, onSave, onClose, subject }) {
  const [language, setLanguage] = useState('Java');
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // CodeRunResponse
  const [activeTab, setActiveTab] = useState('console'); // 'console', 'tests', 'suggestions'
  const [errorMsg, setErrorMsg] = useState('');

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Initialize language based on subject if possible
  useEffect(() => {
    if (subject) {
      if (subject.toLowerCase().includes('python')) {
        setLanguage('Python');
      } else if (subject.toLowerCase().includes('dbms') || subject.toLowerCase().includes('sql')) {
        setLanguage('SQL');
      } else {
        setLanguage('Java');
      }
    }
  }, [subject]);

  // Set initial code or boilerplate
  useEffect(() => {
    if (initialCode && initialCode.trim().length > 10) {
      setCode(initialCode);
    } else {
      setCode(DEFAULT_BOILERPLATE[language] || DEFAULT_BOILERPLATE['Java']);
    }
  }, [language, initialCode]);

  // Keep line numbers scrolled in sync with the textarea scroll
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Support Tab key indentation in our textarea
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const newValue = val.substring(0, start) + '    ' + val.substring(end);
      setCode(newValue);

      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset the editor to standard boilerplate code?")) {
      setCode(DEFAULT_BOILERPLATE[language]);
      setResult(null);
      setErrorMsg('');
    }
  };

  const handleRunCode = async () => {
    setRunning(true);
    setResult(null);
    setErrorMsg('');
    setActiveTab('console');

    try {
      const runResult = await runCode(question, code, language);
      setResult(runResult);
      if (runResult.status === 'compile_error' || runResult.status === 'runtime_error') {
        setErrorMsg(runResult.errorMessage || 'An error occurred during compilation or run.');
      } else if (runResult.testCases && runResult.testCases.length > 0) {
        // Automatically switch to tests tab if run succeeded
        setActiveTab('tests');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to communicate with AI compilation server. Verify backend is running.');
    } finally {
      setRunning(false);
    }
  };

  const handleSave = () => {
    onSave(code);
    onClose();
  };

  // Count number of lines for scroll list
  const lines = code.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
      <div className="flex h-[92vh] w-[95vw] max-w-7xl flex-col rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
        
        {/* Header workspace bar */}
        <div className="flex items-center justify-between border-b border-slate-900 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Code className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">AI Coding Workspace</h3>
              <p className="text-xs text-slate-500 sm:inline-block hidden">Practice coding questions in an interactive sandbox</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace Panels (Split screen) */}
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Panel: Question Description */}
          <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-slate-900 p-6 overflow-y-auto bg-slate-950/50">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              Question {index + 1}
            </span>
            <h4 className="text-xl font-bold text-slate-200 mt-4 font-sans leading-relaxed">
              {question}
            </h4>
            
            <div className="mt-8 border-t border-slate-900 pt-6 space-y-4">
              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Context</h5>
              <div className="rounded-2xl bg-slate-900/40 border border-slate-850 p-4 space-y-2">
                <p className="text-xs text-slate-500"><strong>Subject:</strong> {subject}</p>
                <p className="text-xs text-slate-500"><strong>Sandbox:</strong> Virtual AI Execution Machine</p>
              </div>
              
              <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/10 p-4 text-xs leading-relaxed text-slate-400">
                <strong>LeetCode Practice Mode:</strong> Write your function declaration or full program on the right. Clicking <em>Run Code</em> validates it against compiler checks and 3 distinct test cases using the generative AI vm compiler.
              </div>
            </div>
          </div>

          {/* Right Panel: Code Editor + Logs */}
          <div className="w-full md:w-7/12 flex flex-col overflow-hidden">
            
            {/* Editor Top Bar (Language select + controls) */}
            <div className="flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Language:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none text-slate-200 focus:border-indigo-500 cursor-pointer"
                >
                  {Object.keys(DEFAULT_BOILERPLATE).map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-semibold transition-colors"
                title="Reset code boilerplate"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>

            {/* Custom Code Editor */}
            <div className="flex-1 flex overflow-hidden bg-slate-950 font-mono text-sm relative">
              {/* Line Numbers Sidebar */}
              <div
                ref={lineNumbersRef}
                className="select-none py-4 text-right pr-3 pl-4 border-r border-slate-900 text-slate-600 bg-slate-950 overflow-hidden"
                style={{ width: '48px', lineHeight: '21px' }}
              >
                {lines.map((_, i) => (
                  <div key={i} className="text-xs">{i + 1}</div>
                ))}
              </div>

              {/* Textarea Code Input */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                placeholder="Write your code here..."
                className="flex-1 p-4 bg-slate-950 text-indigo-200 outline-none resize-none overflow-auto whitespace-pre font-mono"
                style={{ lineHeight: '21px', tabSize: 4 }}
                spellCheck="false"
              />
            </div>

            {/* Bottom Console Output Panel */}
            <div className="h-60 border-t border-slate-900 bg-slate-950 flex flex-col overflow-hidden">
              {/* Panel Tabs */}
              <div className="flex items-center border-b border-slate-900 bg-slate-950 px-4">
                <button
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    activeTab === 'console' 
                      ? 'border-indigo-500 text-indigo-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Console Output
                </button>
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    activeTab === 'tests' 
                      ? 'border-indigo-500 text-indigo-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  Test Cases {result?.testCases && `(${result.testCases.filter(t => t.passed).length}/${result.testCases.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                    activeTab === 'suggestions' 
                      ? 'border-indigo-500 text-indigo-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  AI Suggestions
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 p-4 overflow-y-auto text-xs font-mono">
                {/* Console Tab */}
                {activeTab === 'console' && (
                  <div className="space-y-2">
                    {running ? (
                      <p className="text-slate-400 animate-pulse-subtle">Executing program on VM compiler...</p>
                    ) : errorMsg ? (
                      <div className="text-rose-400 bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg">
                        <p className="font-bold text-rose-500 uppercase tracking-wider mb-1">Execution Failure</p>
                        <p className="whitespace-pre-wrap">{errorMsg}</p>
                      </div>
                    ) : result?.consoleOutput ? (
                      <div className="text-slate-300">
                        <p className="text-emerald-500 font-bold uppercase tracking-wider mb-1">Compile & Run Success</p>
                        <pre className="whitespace-pre-wrap bg-slate-900/50 p-3 border border-slate-850 rounded-lg max-h-36 overflow-y-auto">{result.consoleOutput}</pre>
                      </div>
                    ) : (
                      <p className="text-slate-600 italic">No output. Press "Run Code" to compile and run your code.</p>
                    )}
                  </div>
                )}

                {/* Tests Tab */}
                {activeTab === 'tests' && (
                  <div className="space-y-3">
                    {running ? (
                      <p className="text-slate-400 animate-pulse-subtle">Evaluating test cases...</p>
                    ) : result?.testCases && result.testCases.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5">
                        {result.testCases.map((tc, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 border rounded-xl flex items-center justify-between gap-4 ${
                              tc.passed 
                                ? 'bg-emerald-500/5 border-emerald-500/10 text-slate-300' 
                                : 'bg-rose-500/5 border-rose-500/10 text-slate-300'
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Test Case {idx + 1}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
                                <span className="truncate"><strong>Input:</strong> <code className="text-slate-200 bg-slate-900/80 px-1 rounded">{tc.input}</code></span>
                                <span className="truncate"><strong>Expected:</strong> <code className="text-slate-200 bg-slate-900/80 px-1 rounded">{tc.expected}</code></span>
                                <span className="truncate"><strong>Actual:</strong> <code className="text-slate-200 bg-slate-900/80 px-1 rounded">{tc.actual}</code></span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {tc.passed ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  <CheckCircle className="h-3 w-3" /> Passed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded-full">
                                  <XCircle className="h-3 w-3" /> Failed
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-600 italic">No test cases executed. Run successful compilation first.</p>
                    )}
                  </div>
                )}

                {/* Suggestions Tab */}
                {activeTab === 'suggestions' && (
                  <div className="space-y-2">
                    {running ? (
                      <p className="text-slate-400 animate-pulse-subtle">Generating quality metrics...</p>
                    ) : result?.feedback ? (
                      <div className="text-slate-300 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {result.feedback}
                      </div>
                    ) : (
                      <p className="text-slate-600 italic">No suggestions available. Compile code to receive quality reports.</p>
                    )}
                  </div>
                )}
              </div>

              {/* IDE Workspace Footer controls */}
              <div className="border-t border-slate-900 bg-slate-950 px-4 py-3 flex items-center justify-between gap-3">
                <button
                  onClick={onClose}
                  className="btn-secondary text-xs px-4 py-2 hover:bg-slate-900"
                >
                  Close
                </button>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunCode}
                    disabled={running}
                    className="btn-secondary text-xs px-4 py-2 hover:bg-slate-900 border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="h-3.5 w-3.5 fill-indigo-400/20" />
                    {running ? "Running..." : "Run Code"}
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save & Submit Code
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
