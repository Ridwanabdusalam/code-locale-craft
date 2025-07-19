import React, { useState } from 'react';
import { Github, Globe, Download, GitPullRequest, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useRepositoryAnalysis } from '@/hooks/useRepositoryAnalysis';
import { useToast } from '@/hooks/use-toast';

const GitHubLocalizationApp = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [githubToken, setGithubToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'complete'>('complete');
  
  const { toast } = useToast();
  const repositoryAnalysis = useRepositoryAnalysis();

  const popularLanguages = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' }
  ];

  const steps = [
    'Repository Analysis',
    'Language Selection', 
    'Localization Processing',
    'Output Generation'
  ];

  const handleAnalyze = async () => {
    if (!repoUrl.includes('github.com')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid GitHub repository URL",
        variant: "destructive",
      });
      return;
    }

    if (!githubToken) {
      setAuthError('GitHub Personal Access Token is required for API access');
      return;
    }

    setCurrentStep(1);
    setAuthError('');

    try {
      await repositoryAnalysis.analyzeRepository(repoUrl, githubToken, analysisMode);
      setCurrentStep(2);
      setSelectedLanguages(popularLanguages.slice(0, 3));
    } catch (error: any) {
      console.error('Analysis failed:', error);
      if (error.message.includes('403')) {
        setAuthError('Authentication failed. Please check your GitHub token and permissions.');
      } else if (error.message.includes('rate limit')) {
        setAuthError('GitHub API rate limit exceeded. Please wait before trying again.');
      } else {
        setAuthError('Failed to analyze repository: ' + error.message);
      }
      setCurrentStep(0);
    }
  };

  const handleLanguageToggle = (language: any) => {
    setSelectedLanguages((prev: any) => 
      prev.find((lang: any) => lang.code === language.code)
        ? prev.filter((lang: any) => lang.code !== language.code)
        : [...prev, language]
    );
  };

  const handleLocalize = async () => {
    if (selectedLanguages.length === 0) {
      toast({
        title: "No Languages Selected", 
        description: "Please select at least one language",
        variant: "destructive",
      });
      return;
    }

    if (!repositoryAnalysis.analysisId) {
      toast({
        title: "No Analysis Found",
        description: "Please analyze the repository first",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep(3);

    try {
      await repositoryAnalysis.generateFiles(
        repositoryAnalysis.analysisId,
        selectedLanguages,
        repositoryAnalysis.analysisResults,
        repositoryAnalysis.extractionResults
      );
      setCurrentStep(4);
    } catch (error) {
      console.error('Localization failed:', error);
      setCurrentStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Github className="w-8 h-8 text-gray-700" />
            <Globe className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            GitHub Codebase Localization Tool
          </h1>
          <p className="text-gray-600">
            Automatically analyze, structure, and localize your GitHub repositories with AI
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
                `}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm ${index <= currentStep ? 'text-blue-600' : 'text-gray-500'}`}>
                  {step}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {currentStep === 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Github className="w-5 h-5" />
              GitHub Repository Analysis
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Personal Access Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for GitHub API access. 
                  <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                    Create token here
                  </a>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository URL
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('fast')}
                    className={`px-4 py-2 rounded-lg border transition-all ${
                      analysisMode === 'fast' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Fast Analysis (≤50 files)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('complete')}
                    className={`px-4 py-2 rounded-lg border transition-all ${
                      analysisMode === 'complete' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Complete Analysis (all files)
                  </button>
                </div>
              </div>
              
              {authError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700">{authError}</span>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleAnalyze}
                disabled={repositoryAnalysis.isAnalyzing || !repoUrl || !githubToken}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {repositoryAnalysis.isAnalyzing ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Analyze Repository
              </button>
            </div>
          </div>
        )}

        {repositoryAnalysis.isAnalyzing && currentStep === 1 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <Loader className="animate-spin text-blue-500" size={20} />
              <span className="text-blue-700 font-medium">
                {repositoryAnalysis.progress.stage === 'analyzing' && 'Analyzing Repository...'}
                {repositoryAnalysis.progress.stage === 'extracting' && 'Extracting Strings...'}
                {repositoryAnalysis.progress.stage === 'saving' && 'Saving to Database...'}
              </span>
            </div>
            
            <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${repositoryAnalysis.progress.total ? (repositoryAnalysis.progress.current / repositoryAnalysis.progress.total) * 100 : 0}%` }}
              />
            </div>
            
            <div className="text-sm text-blue-600">
              {repositoryAnalysis.progress.total ? (
                `${repositoryAnalysis.progress.current} / ${repositoryAnalysis.progress.total} files processed`
              ) : (
                'Initializing analysis...'
              )}
            </div>
          </div>
        )}

        {currentStep >= 1 && repositoryAnalysis.analysisResults && !repositoryAnalysis.isAnalyzing && (
          <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="text-green-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-800">Analysis Complete</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-blue-600">
                  {repositoryAnalysis.analysisResults?.stringsFound || repositoryAnalysis.extractionResults?.totalStrings || 0}
                </div>
                <div className="text-sm text-gray-600">Strings Found</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-green-600">
                  {repositoryAnalysis.analysisResults?.filesAnalyzed || repositoryAnalysis.extractionResults?.totalFiles || 0}
                </div>
                <div className="text-sm text-gray-600">Files Analyzed</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-purple-600">
                  {repositoryAnalysis.analysisResults?.framework || repositoryAnalysis.extractionResults?.framework || 'Unknown'}
                </div>
                <div className="text-sm text-gray-600">Framework</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-2xl font-bold text-orange-600">
                  {repositoryAnalysis.analysisResults?.hasI18nStructure ? 'Yes' : 'No'}
                </div>
                <div className="text-sm text-gray-600">Has i18n Setup</div>
              </div>
            </div>
            
            {repositoryAnalysis.analysisResults?.recommendations && repositoryAnalysis.analysisResults.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-800 mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {repositoryAnalysis.analysisResults.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {currentStep >= 2 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Select Languages ({selectedLanguages.length}/10)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {popularLanguages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageToggle(language)}
                  className={`
                    p-3 rounded-lg border-2 transition-all flex items-center gap-2
                    ${selectedLanguages.find((lang: any) => lang.code === language.code)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="text-lg">{language.flag}</span>
                  <span className="text-sm font-medium">{language.name}</span>
                </button>
              ))}
            </div>
            {currentStep === 2 && (
              <button
                onClick={handleLocalize}
                disabled={selectedLanguages.length === 0}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Globe className="w-5 h-5" />
                Start Localization
              </button>
            )}
          </div>
        )}

        {repositoryAnalysis.progress.stage === 'generating' && currentStep === 3 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <Loader className="animate-spin text-green-500" size={20} />
              <span className="text-green-700 font-medium">{repositoryAnalysis.progress.message}</span>
            </div>
            
            <div className="w-full bg-green-200 rounded-full h-2 mb-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${repositoryAnalysis.progress.total ? (repositoryAnalysis.progress.current / repositoryAnalysis.progress.total) * 100 : 0}%` }}
              />
            </div>
            
            <div className="text-sm text-green-600">
              {repositoryAnalysis.progress.total ? (
                `Step ${repositoryAnalysis.progress.current} of ${repositoryAnalysis.progress.total}`
              ) : (
                'Preparing files...'
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && repositoryAnalysis.generatedFiles && repositoryAnalysis.generatedFiles.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="text-green-500" size={24} />
              <h2 className="text-xl font-semibold text-gray-800">Localization Files Generated</h2>
            </div>
            
            <div className="grid gap-4">
              {repositoryAnalysis.generatedFiles.map((file, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText size={16} className="text-gray-500" />
                      <span className="font-medium text-gray-700">{file.path}</span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {file.type}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const blob = new Blob([file.content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.path.split('/').pop() || 'file.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </button>
                  </div>
                  <div className="p-4">
                    <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                      <code>{file.content}</code>
                    </pre>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Next Steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-700">
                <li>Download and add these files to your repository</li>
                <li>Install the required dependencies: <code className="bg-yellow-100 px-1 rounded">npm install react-i18next i18next i18next-browser-languagedetector</code></li>
                <li>Import the i18n configuration in your main App.tsx file</li>
                <li>Replace hardcoded strings with translation functions</li>
                <li>Test your application with different languages</li>
              </ol>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  repositoryAnalysis.generatedFiles?.forEach(file => {
                    const blob = new Blob([file.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.path.split('/').pop() || 'file.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  });
                }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={20} />
                <span>Download All Files</span>
              </button>
              
              <button
                onClick={() => {
                  setCurrentStep(0);
                  setRepoUrl('');
                  setSelectedLanguages([]);
                  setAuthError('');
                }}
                className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <GitPullRequest size={20} />
                <span>Analyze Another Repository</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitHubLocalizationApp;