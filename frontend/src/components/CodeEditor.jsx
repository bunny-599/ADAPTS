import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Terminal, Cpu, Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { runCode } from '../services/api';

const DEFAULT_BOILERPLATE = {
  Java: `public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n        System.out.println("Hello from Java!");\n    }\n}`,
  Python: `# Write your code here\ndef solution():\n    print("Hello from Python!")\n\nsolution()`,
  JavaScript: `// Write your code here\nfunction solution() {\n    console.log("Hello from JavaScript!");\n}\n\nsolution();`,
  'C++': `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    cout << "Hello from C++!" << endl;\n    return 0;\n}`,
  SQL: `-- Write your SQL query here\nSELECT * FROM learning_log WHERE topic = 'variables';`
};

const MONACO_LANGUAGES = {
  Java: 'java',
  Python: 'python',
  JavaScript: 'javascript',
  'C++': 'cpp',
  SQL: 'sql'
};

export default function CodeEditor({ question, answer, onChange, disabled, subject }) {
  const [language, setLanguage] = useState('Java');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('console');
  const [errorMsg, setErrorMsg] = useState('');

  // Initialize language based on subject
  useEffect(() => {
    if (subject) {
      const lower = subject.toLowerCase();
      if (lower.includes('python')) {
        setLanguage('Python');
      } else if (lower.includes('dbms') || lower.includes('sql') || lower.includes('database')) {
        setLanguage('SQL');
      } else if (lower.includes('javascript') || lower.includes('js')) {
        setLanguage('JavaScript');
      } else if (lower.includes('c++') || lower.includes('cpp')) {
        setLanguage('C++');
      } else {
        setLanguage('Java');
      }
    }
  }, [subject]);

  // Set initial boilerplate if empty
  useEffect(() => {
    if (!answer || answer.trim().length === 0) {
      onChange(DEFAULT_BOILERPLATE[language] || DEFAULT_BOILERPLATE['Java']);
    }
  }, [language, answer, onChange]);

  const handleReset = () => {
    if (window.confirm("Reset editor to standard boilerplate code?")) {
      onChange(DEFAULT_BOILERPLATE[language]);
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
      const runResult = await runCode(question, answer, language);
      setResult(runResult);
      if (runResult.status === 'compile_error' || runResult.status === 'runtime_error') {
        setErrorMsg(runResult.errorMessage || 'An error occurred during execution.');
      } else if (runResult.testCases && runResult.testCases.length > 0) {
        setActiveTab('tests');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to execute code. Verify backend is running.');
    } finally {
      setRunning(false);
    }
  };

  const monacoLanguage = MONACO_LANGUAGES[language] || 'java';

  return (
    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden font-sans print:bg-white print:border-black print:text-black">
      {/* Editor Controls Bar */}
      <div className="flex items-center justify-between border-b border-slate-900 bg-slate-950 px-4 py-2.5 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Language:</span>
          <select
            value={language}
            onChange={(e) => {
              const lang = e.target.value;
              setLanguage(lang);
              onChange(DEFAULT_BOILERPLATE[lang]);
            }}
            disabled={disabled}
            className="bg-slate-900 border border-slate-800 text-[11px] font-bold rounded-lg px-2.5 py-1.5 outline-none text-slate-200 focus:border-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Object.keys(DEFAULT_BOILERPLATE).map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Editor Workspace using Monaco */}
      <div className="flex flex-col bg-slate-950 relative print:bg-white print:border-black min-h-[220px]">
        <Editor
          height="220px"
          language={monacoLanguage}
          theme="vs-dark"
          value={answer || ''}
          onChange={(val) => onChange(val || '')}
          options={{
            fontSize: 13,
            fontFamily: 'Fira Code, Menlo, Monaco, Consolas, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            automaticLayout: true,
            readOnly: disabled,
            domReadOnly: disabled,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible'
            }
          }}
        />
      </div>

      {/* Run Action Area (Only visible when interactive/not disabled) */}
      {!disabled && (
        <div className="border-t border-slate-900 bg-slate-950/40 px-4 py-2.5 flex justify-end print:hidden">
          <button
            type="button"
            onClick={handleRunCode}
            disabled={running}
            className="btn-secondary text-[11px] px-3.5 py-1.5 border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40 hover:bg-slate-900 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
          >
            <Play className="h-3 w-3 fill-indigo-400/20" />
            {running ? "Running..." : "Run Code"}
          </button>
        </div>
      )}

      {/* Code execution terminal output panel (Only visible when ran/errors exist) */}
      {(result || errorMsg || running) && (
        <div className="border-t border-slate-900 bg-slate-950 flex flex-col print:hidden">
          {/* Output tabs */}
          <div className="flex border-b border-slate-900 bg-slate-950/80 px-3">
            <button
              type="button"
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1 px-3 py-2 text-[10px] font-bold border-b-2 uppercase tracking-wider transition-all ${
                activeTab === 'console' 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-3 w-3" />
              Console
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`flex items-center gap-1 px-3 py-2 text-[10px] font-bold border-b-2 uppercase tracking-wider transition-all ${
                activeTab === 'tests' 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="h-3 w-3" />
              Test Cases
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('suggestions')}
              className={`flex items-center gap-1 px-3 py-2 text-[10px] font-bold border-b-2 uppercase tracking-wider transition-all ${
                activeTab === 'suggestions' 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lightbulb className="h-3 w-3" />
              AI Metrics
            </button>
          </div>

          {/* Console / results details */}
          <div className="p-3 text-[11px] font-mono max-h-48 overflow-y-auto">
            {activeTab === 'console' && (
              <div>
                {running ? (
                  <p className="text-slate-400 animate-pulse">Running test builds on AI compiler...</p>
                ) : errorMsg ? (
                  <div className="text-rose-400 leading-normal">
                    <p className="font-bold text-rose-500 uppercase tracking-widest mb-1 text-[9px]">Execution Error</p>
                    <pre className="whitespace-pre-wrap">{errorMsg}</pre>
                  </div>
                ) : result?.consoleOutput ? (
                  <div>
                    <p className="text-emerald-500 font-bold uppercase tracking-widest mb-1 text-[9px]">Stdout Output</p>
                    <pre className="whitespace-pre-wrap text-slate-300 bg-slate-900/50 p-2.5 border border-slate-850 rounded-lg">{result.consoleOutput}</pre>
                  </div>
                ) : (
                  <p className="text-slate-600 italic">No console logs returned.</p>
                )}
              </div>
            )}

            {activeTab === 'tests' && (
              <div className="space-y-2">
                {running ? (
                  <p className="text-slate-400 animate-pulse">Checking edge bounds...</p>
                ) : result?.testCases && result.testCases.length > 0 ? (
                  <div className="space-y-1.5">
                    {result.testCases.map((tc, idx) => (
                      <div 
                        key={idx} 
                        className={`p-2 border rounded-lg flex items-center justify-between gap-3 ${
                          tc.passed 
                            ? 'bg-emerald-500/5 border-emerald-500/10' 
                            : 'bg-rose-500/5 border-rose-500/10'
                        }`}
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="text-slate-400 text-[10px] flex flex-wrap gap-x-3">
                            <span className="truncate"><strong>In:</strong> <code className="text-slate-300">{tc.input}</code></span>
                            <span className="truncate"><strong>Expected:</strong> <code className="text-slate-300">{tc.expected}</code></span>
                            <span className="truncate"><strong>Actual:</strong> <code className="text-slate-300">{tc.actual}</code></span>
                          </div>
                        </div>
                        <div>
                          {tc.passed ? (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 uppercase">
                              <CheckCircle className="h-3 w-3" /> Pass
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-400 uppercase">
                              <XCircle className="h-3 w-3" /> Fail
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 italic">No test cases executed.</p>
                )}
              </div>
            )}

            {activeTab === 'suggestions' && (
              <div>
                {running ? (
                  <p className="text-slate-400 animate-pulse">Measuring execution speed...</p>
                ) : result?.feedback ? (
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{result.feedback}</p>
                ) : (
                  <p className="text-slate-600 italic">No suggestion reports available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

