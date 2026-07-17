import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import AssessmentForm from './pages/AssessmentForm';
import Results from './pages/Results';
import Loader from './components/Loader';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { generateQuestions, evaluateAnswers } from './services/api';

function App() {
  const [view, setView] = useState('home'); // 'home', 'form', 'loading', 'results', 'error'
  const [requestData, setRequestData] = useState(null);
  const [responseData, setResponseData] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [apiError, setApiError] = useState('');

  const handleStart = () => {
    setView('form');
  };

  const handleFormSubmit = async (formData) => {
    setRequestData(formData);
    setView('loading');
    setApiError('');

    try {
      const data = await generateQuestions(formData.field, formData.subject, formData.topic);
      setResponseData(data);
      setView('results');
    } catch (err) {
      console.error(err);
      setApiError(err.message || 'Failed to connect to the server or Gemini API. Please make sure the backend server is running and the Gemini API key is valid.');
      setView('error');
    }
  };

  const handleAnswersSubmit = async (answers) => {
    setView('loading');
    setApiError('');

    try {
      const result = await evaluateAnswers(requestData.field, requestData.subject, answers);
      setEvaluationResult(result);
      setView('results');
    } catch (err) {
      console.error(err);
      setApiError(err.message || 'Failed to evaluate answers. Make sure the backend server is running and the Gemini API key is valid.');
      setView('error');
    }
  };

  const handleRestart = () => {
    setResponseData(null);
    setEvaluationResult(null);
    setApiError('');
    setView('form');
  };

  const handleResetToHome = () => {
    setResponseData(null);
    setEvaluationResult(null);
    setApiError('');
    setView('home');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 bg-grid-pattern text-slate-100 selection:bg-indigo-600/30 selection:text-indigo-200">
      {/* Header Navbar */}
      <Navbar onReset={handleResetToHome} />

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center py-6 px-4">
        {view === 'home' && (
          <Home onStart={handleStart} />
        )}

        {view === 'form' && (
          <AssessmentForm 
            onSubmit={handleFormSubmit} 
            onBack={handleResetToHome} 
          />
        )}

        {view === 'loading' && (
          <div className="w-full max-w-md glass-panel rounded-3xl p-8 relative overflow-hidden">
            <Loader />
          </div>
        )}

        {view === 'results' && (
          <Results 
            responseData={responseData} 
            requestData={requestData} 
            evaluationResult={evaluationResult}
            onAnswersSubmit={handleAnswersSubmit}
            onRestart={handleRestart} 
          />
        )}

        {view === 'error' && (
          <div className="w-full max-w-lg glass-panel rounded-3xl p-8 relative overflow-hidden text-center animate-fade-in">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500"></div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-6">
              <AlertCircle className="h-7 w-7" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-100 font-sans">
              Operation Failed
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400 bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl text-left font-mono whitespace-pre-wrap break-words">
              {apiError}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleRestart}
                className="btn-primary w-full sm:w-auto px-6 py-3 font-semibold flex items-center justify-center gap-2 group"
              >
                <RotateCcw className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-45" />
                Try Again
              </button>
              <button
                onClick={handleResetToHome}
                className="btn-secondary w-full sm:w-auto px-6 py-3 font-semibold"
              >
                Go Home
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;

