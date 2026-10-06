import React, { useState, useEffect, useRef } from 'react';
import { RunCodeResponse, SubmitCodeResponse } from '../types/coding';

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface CodeEditorIdeProps {
  questionId: number | string;
  initialCode?: string;
  starterCode?: string;
  constraints?: string;
  sampleTestCases?: TestCase[];
  currentAnswer?: string;
  executionResult?: (RunCodeResponse | SubmitCodeResponse) & { mode?: 'run' | 'submit' };
  isRunning?: boolean;
  isSubmitting?: boolean;
  onCodeChange: (code: string) => void;
  onRunCode: (code: string, language: string) => void;
  onSubmitCode: (code: string, language: string) => void;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  cpp: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    // Fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Read input and print solution
    int n;
    if (cin >> n) {
        vector<int> arr(n);
        for (int i = 0; i < n; ++i) {
            cin >> arr[i];
        }
        // Write your logic here
        cout << *max_element(arr.begin(), arr.end()) << "\\n";
    }

    return 0;
}`,
  python: `import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Write your solution here
    numbers = [int(x) for x in input_data[1:]] if len(input_data) > 1 else [int(input_data[0])]
    print(max(numbers))

if __name__ == '__main__':
    solve()`,
  javascript: `const fs = require('fs');

function solve() {
    const rawInput = fs.readFileSync(0, 'utf-8').trim();
    if (!rawInput) return;
    const tokens = rawInput.split(/\\s+/);
    // Write your solution here
    const numbers = tokens.slice(1).map(Number);
    console.log(Math.max(...numbers));
}

solve();`
};

export const CodeEditorIde: React.FC<CodeEditorIdeProps> = ({
  questionId,
  initialCode,
  starterCode,
  constraints,
  sampleTestCases = [],
  currentAnswer,
  executionResult,
  isRunning = false,
  isSubmitting = false,
  onCodeChange,
  onRunCode,
  onSubmitCode,
}) => {
  const [language, setLanguage] = useState<'cpp' | 'python' | 'javascript'>('cpp');
  const [code, setCode] = useState<string>(
    currentAnswer || starterCode || initialCode || DEFAULT_TEMPLATES.cpp
  );
  const [fontSize, setFontSize] = useState<number>(14);
  const [activeTab, setActiveTab] = useState<'testcases' | 'console' | 'summary'>('testcases');
  const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync internal code state if question changes
  useEffect(() => {
    const newCode = currentAnswer || starterCode || initialCode || DEFAULT_TEMPLATES[language];
    setCode(newCode);
  }, [questionId]);

  // Sync line numbers scrolling with textarea scrolling
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value.substring(0, textareaRef.current.selectionStart);
    const lines = text.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onCodeChange(newCode);
    updateCursorPosition();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Handle Tab: insert 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = '    ';
      const updated = code.substring(0, start) + spaces + code.substring(end);
      setCode(updated);
      onCodeChange(updated);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
        updateCursorPosition();
      }, 0);
      return;
    }

    // Auto-indent on Enter
    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const currentLine = code.substring(0, start).split('\n').pop() || '';
      const matchIndent = currentLine.match(/^(\s+)/);
      const baseIndent = matchIndent ? matchIndent[1] : '';
      const extraIndent = currentLine.trim().endsWith('{') || currentLine.trim().endsWith(':') ? '    ' : '';
      const indentToInsert = '\n' + baseIndent + extraIndent;

      if (indentToInsert !== '\n') {
        e.preventDefault();
        const updated = code.substring(0, start) + indentToInsert + code.substring(textarea.selectionEnd);
        setCode(updated);
        onCodeChange(updated);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + indentToInsert.length;
          updateCursorPosition();
        }, 0);
        return;
      }
    }

    // Auto close quotes and brackets
    const pairs: Record<string, string> = {
      '(': ')',
      '{': '}',
      '[': ']',
      '"': '"',
      "'": "'",
      '`': '`',
    };

    if (pairs[e.key]) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      // If text selected, wrap it
      if (start !== end) {
        e.preventDefault();
        const selected = code.substring(start, end);
        const wrapped = e.key + selected + pairs[e.key];
        const updated = code.substring(0, start) + wrapped + code.substring(end);
        setCode(updated);
        onCodeChange(updated);
        setTimeout(() => {
          textarea.selectionStart = start + 1;
          textarea.selectionEnd = end + 1;
          updateCursorPosition();
        }, 0);
        return;
      }
    }
  };

  const handleLanguageChange = (newLang: 'cpp' | 'python' | 'javascript') => {
    setLanguage(newLang);
    if (!currentAnswer || currentAnswer === DEFAULT_TEMPLATES[language]) {
      const template = DEFAULT_TEMPLATES[newLang];
      setCode(template);
      onCodeChange(template);
    }
  };

  const handleResetStarter = () => {
    const template = starterCode || DEFAULT_TEMPLATES[language];
    setCode(template);
    onCodeChange(template);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const lineCount = Math.max(1, code.split('\n').length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const fileExtensions: Record<string, string> = {
    cpp: 'Solution.cpp',
    python: 'solution.py',
    javascript: 'solution.js',
  };

  const testResults = executionResult?.testResults || [];

  return (
    <div className="ide-container" style={{
      border: '1px solid #334155',
      borderRadius: '10px',
      overflow: 'hidden',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      marginTop: '1rem',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    }}>
      {/* Top IDE Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#252526',
        padding: '0.4rem 0.8rem',
        borderBottom: '1px solid #333333',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        {/* Left: Active File Tab & Language Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: '#1e1e1e',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px 4px 0 0',
            borderTop: '2px solid #007acc',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            <span>📄</span>
            <span>{fileExtensions[language]}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
            <span style={{ color: '#94a3b8' }}>Language:</span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as any)}
              style={{
                backgroundColor: '#2d2d2d',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <option value="cpp">C++ (g++ 17)</option>
              <option value="python">Python (3.10)</option>
              <option value="javascript">JavaScript (Node.js 20)</option>
            </select>
          </div>
        </div>

        {/* Right: Editor Settings and Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleCopyCode}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: copied ? '#4ade80' : '#cbd5e1',
              borderRadius: '4px',
              padding: '0.2rem 0.55rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>

          <button
            type="button"
            onClick={handleResetStarter}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: '4px',
              padding: '0.2rem 0.55rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
            title="Reset code to starter template"
          >
            ↺ Reset
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8', fontSize: '0.78rem' }}>
            <span>Size:</span>
            {[13, 14, 16].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setFontSize(sz)}
                style={{
                  background: fontSize === sz ? '#007acc' : '#2d2d2d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: fontSize === sz ? 700 : 400,
                }}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Constraints Warning Bar if provided */}
      {constraints && (
        <div style={{
          backgroundColor: '#172554',
          color: '#93c5fd',
          borderBottom: '1px solid #1e3a8a',
          padding: '0.35rem 0.8rem',
          fontSize: '0.8rem',
          display: 'flex',
          gap: '0.4rem',
          alignItems: 'center',
        }}>
          <span>⚡</span>
          <span><strong>Constraints:</strong> {constraints}</span>
        </div>
      )}

      {/* Main Code Editing Canvas */}
      <div style={{
        display: 'flex',
        position: 'relative',
        height: '340px',
        backgroundColor: '#1e1e1e',
      }}>
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          style={{
            width: '48px',
            backgroundColor: '#1e1e1e',
            color: '#858585',
            textAlign: 'right',
            padding: '0.75rem 0.6rem 0.75rem 0',
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
            fontFamily: "'Fira Code', 'Courier New', Courier, monospace",
            userSelect: 'none',
            overflowY: 'hidden',
            borderRight: '1px solid #2d2d2d',
            boxSizing: 'border-box',
          }}
        >
          {lineNumbers.map((num) => (
            <div
              key={num}
              style={{
                color: cursorPos.line === num ? '#ffffff' : '#5a5a5a',
                fontWeight: cursorPos.line === num ? 700 : 400,
              }}
            >
              {num}
            </div>
          ))}
        </div>

        {/* Code Textarea Editor */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          spellCheck={false}
          style={{
            flex: 1,
            backgroundColor: '#1e1e1e',
            color: '#9cdcfe',
            border: 'none',
            outline: 'none',
            resize: 'none',
            padding: '0.75rem 0.8rem',
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
            fontFamily: "'Fira Code', Consolas, 'Courier New', Courier, monospace",
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflowX: 'auto',
            overflowY: 'auto',
            tabSize: 4,
            caretColor: '#ffffff',
          }}
        />
      </div>

      {/* Editor Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#007acc',
        color: '#ffffff',
        padding: '0.2rem 0.8rem',
        fontSize: '0.75rem',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>{lineCount} lines</span>
          <span>{code.length} characters</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>UTF-8</span>
          <span>Spaces: 4</span>
          <span>{language === 'cpp' ? 'C++17' : language === 'python' ? 'Python 3.10' : 'Node.js'}</span>
        </div>
      </div>

      {/* Action Execution Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.65rem 0.8rem',
        backgroundColor: '#252526',
        borderTop: '1px solid #333333',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
          💡 <em>Tip: Run code against visible test cases before final submission.</em>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            disabled={isRunning || isSubmitting}
            onClick={() => {
              setActiveTab('testcases');
              onRunCode(code, language);
            }}
            style={{
              padding: '0.5rem 1.1rem',
              backgroundColor: isRunning ? '#334155' : '#1e293b',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              borderRadius: '6px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: isRunning || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            {isRunning ? (
              <>
                <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                <span>Running Sandbox...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Run Code (Visible Tests)</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isRunning || isSubmitting}
            onClick={() => {
              setActiveTab('summary');
              onSubmitCode(code, language);
            }}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: isSubmitting ? '#065f46' : '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: isRunning || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
            }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                <span>Evaluating All Tests...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Submit Solution (All Tests)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output Console & Test Cases Drawer */}
      <div style={{
        backgroundColor: '#18181b',
        borderTop: '1px solid #27272a',
      }}>
        {/* Drawer Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#202023',
          borderBottom: '1px solid #27272a',
          padding: '0 0.5rem',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('testcases')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'testcases' ? '2px solid #007acc' : '2px solid transparent',
              color: activeTab === 'testcases' ? '#ffffff' : '#a1a1aa',
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>🧪</span>
            <span>Test Cases ({sampleTestCases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('console')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'console' ? '2px solid #007acc' : '2px solid transparent',
              color: activeTab === 'console' ? '#ffffff' : '#a1a1aa',
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>💻</span>
            <span>Console Output</span>
          </button>

          {executionResult && (
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'summary' ? '2px solid #10b981' : '2px solid transparent',
                color: activeTab === 'summary' ? '#ffffff' : '#a1a1aa',
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📊</span>
              <span>Execution Summary</span>
            </button>
          )}
        </div>

        {/* Tab 1: Test Cases View */}
        {activeTab === 'testcases' && (
          <div style={{ padding: '0.85rem' }}>
            {sampleTestCases.length === 0 ? (
              <div style={{ color: '#71717a', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No visible sample test cases provided for this question. Use standard I/O.
              </div>
            ) : (
              <div>
                {/* Test Case Selector Pills */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                  {sampleTestCases.map((_, idx) => {
                    const resultItem = testResults[idx];
                    let badge = '⚪';
                    if (resultItem) {
                      badge = resultItem.status === 'passed' ? '🟢' : '🔴';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedTestCaseIndex(idx)}
                        style={{
                          backgroundColor: selectedTestCaseIndex === idx ? '#27272a' : '#18181b',
                          color: selectedTestCaseIndex === idx ? '#ffffff' : '#a1a1aa',
                          border: selectedTestCaseIndex === idx ? '1px solid #3b82f6' : '1px solid #3f3f46',
                          borderRadius: '6px',
                          padding: '0.3rem 0.75rem',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: selectedTestCaseIndex === idx ? 600 : 400,
                        }}
                      >
                        <span>{badge}</span>
                        <span>Case {idx + 1}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Test Case Details */}
                {sampleTestCases[selectedTestCaseIndex] && (() => {
                  const currentTc = sampleTestCases[selectedTestCaseIndex];
                  const currentRes = testResults[selectedTestCaseIndex];

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.75rem',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: 600 }}>
                          Input:
                        </div>
                        <pre style={{
                          backgroundColor: '#09090b',
                          color: '#f8fafc',
                          padding: '0.6rem',
                          borderRadius: '6px',
                          margin: 0,
                          fontSize: '0.82rem',
                          border: '1px solid #27272a',
                          fontFamily: "'Fira Code', Consolas, monospace",
                          maxHeight: '100px',
                          overflowY: 'auto',
                        }}>
                          {currentTc.input || '(empty input)'}
                        </pre>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: 600 }}>
                          Expected Output:
                        </div>
                        <pre style={{
                          backgroundColor: '#09090b',
                          color: '#4ade80',
                          padding: '0.6rem',
                          borderRadius: '6px',
                          margin: 0,
                          fontSize: '0.82rem',
                          border: '1px solid #27272a',
                          fontFamily: "'Fira Code', Consolas, monospace",
                          maxHeight: '100px',
                          overflowY: 'auto',
                        }}>
                          {currentTc.expectedOutput}
                        </pre>
                      </div>

                      {currentRes && (
                        <div>
                          <div style={{
                            fontSize: '0.78rem',
                            color: currentRes.status === 'passed' ? '#4ade80' : '#f87171',
                            marginBottom: '0.25rem',
                            fontWeight: 600,
                          }}>
                            Actual Output ({currentRes.status.toUpperCase()}):
                          </div>
                          <pre style={{
                            backgroundColor: currentRes.status === 'passed' ? '#052e16' : '#450a0a',
                            color: currentRes.status === 'passed' ? '#bbf7d0' : '#fca5a5',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            margin: 0,
                            fontSize: '0.82rem',
                            border: currentRes.status === 'passed' ? '1px solid #166534' : '1px solid #991b1b',
                            fontFamily: "'Fira Code', Consolas, monospace",
                            maxHeight: '100px',
                            overflowY: 'auto',
                          }}>
                            {currentRes.actualOutput !== undefined ? currentRes.actualOutput : '(no output)'}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Terminal / Compiler Console */}
        {activeTab === 'console' && (
          <div style={{ padding: '0.85rem' }}>
            <div style={{
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              borderRadius: '6px',
              padding: '0.75rem',
              fontFamily: "'Fira Code', Consolas, monospace",
              fontSize: '0.82rem',
              maxHeight: '140px',
              overflowY: 'auto',
              color: '#f4f4f5',
            }}>
              <div style={{ color: '#71717a', marginBottom: '0.35rem' }}>
                $ {language === 'cpp' ? 'g++ -O3 -std=c++17 solution.cpp -o solution && ./solution' : language === 'python' ? 'python3 solution.py' : 'node solution.js'}
              </div>

              {executionResult?.compilerOutput && (
                <div style={{ color: '#f87171', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                  {executionResult.compilerOutput}
                </div>
              )}

              {(executionResult as any)?.stdout && (
                <div style={{ color: '#4ade80', whiteSpace: 'pre-wrap' }}>
                  {(executionResult as any).stdout}
                </div>
              )}

              {(executionResult as any)?.stderr && (
                <div style={{ color: '#f87171', whiteSpace: 'pre-wrap' }}>
                  {(executionResult as any).stderr}
                </div>
              )}

              {!executionResult && (
                <div style={{ color: '#71717a', fontStyle: 'italic' }}>
                  Console ready. Click "Run Code" or "Submit Solution" to see output.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Execution Summary */}
        {activeTab === 'summary' && executionResult && (
          <div style={{ padding: '0.85rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              backgroundColor: '#27272a',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Verdict:</span>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: (executionResult.evaluationStatus === 'completed' && executionResult.passedTests === executionResult.totalTests) ? '#4ade80' : '#f87171',
                }}>
                  {executionResult.evaluationStatus.replace(/_/g, ' ').toUpperCase()}
                </div>
              </div>

              {executionResult.passedTests !== undefined && executionResult.totalTests !== undefined && (
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Passed Tests:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                    {executionResult.passedTests} / {executionResult.totalTests}
                  </div>
                </div>
              )}

              {'score' in executionResult && executionResult.score !== undefined && (
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Score:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>
                    {(executionResult.score * 100).toFixed(0)}%
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Execution Time:</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fde047' }}>
                  {executionResult.executionTimeMs} ms
                </div>
              </div>

              {'memoryUsedMb' in executionResult && executionResult.memoryUsedMb !== undefined && (
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Memory Used:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#c084fc' }}>
                    {executionResult.memoryUsedMb} MB
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
