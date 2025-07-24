import React, { useState, useEffect } from 'react';
import { Github, Globe, Download, GitPullRequest, FileText, CheckCircle, AlertCircle, Loader, GitBranch, Key, Search, Play, ArrowLeft, Zap } from 'lucide-react';
import { useRepositoryAnalysis } from '@/hooks/useRepositoryAnalysis';
import { useToast } from '@/hooks/use-toast';
import { GitHubService } from '@/services/github';
import { RepositorySelector } from '@/components/RepositorySelector';
import GitHubProfile from '@/components/GitHubProfile';
import { useAuth } from '@/services/auth';
import { GitHubAuthService } from '@/services/githubAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const GitHubLocalizationApp = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [githubToken, setGithubToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'complete'>('complete');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [branchCreated, setBranchCreated] = useState<{ branchUrl: string; prUrl: string } | null>(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  
  const { toast } = useToast();
  const repositoryAnalysis = useRepositoryAnalysis();
  const { user, loading } = useAuth();

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
    'GitHub Connection & Repository Selection',
    'Analysis Progress',
    'Language Selection', 
    'File Generation Progress',
    'Results & Actions'
  ];

  useEffect(() => {
    const checkGitHubToken = async () => {
      if (user) {
        const hasToken = await GitHubAuthService.hasValidGitHubToken();
        if (hasToken) {
          const token = await GitHubAuthService.getGitHubToken();
          setGithubToken(token || '');
          setShowRepoSelector(true);
        }
      }
    };

    checkGitHubToken();
  }, [user]);

  const handleRepositorySelect = async (selectedRepoUrl: string) => {
    setRepoUrl(selectedRepoUrl);
    setShowRepoSelector(false);
    setCurrentStep(2);
    
    // Automatically start analysis with complete mode
    if (!githubToken.trim()) {
      toast({
        title: "GitHub Token Required",
        description: "Please connect your GitHub account",
        variant: "destructive",
      });
      return;
    }

    setAuthError('');

    try {
      await repositoryAnalysis.analyzeRepository(selectedRepoUrl, githubToken, 'complete');
      setCurrentStep(3);
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
      setCurrentStep(1);
      setShowRepoSelector(true);
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

    setCurrentStep(4);

    try {
      await repositoryAnalysis.generateFiles(
        repositoryAnalysis.analysisId,
        selectedLanguages,
        repositoryAnalysis.analysisResults,
        repositoryAnalysis.extractionResults
      );
      setCurrentStep(5);
    } catch (error) {
      console.error('Localization failed:', error);
      setCurrentStep(3);
    }
  };

  const handleCreateBranch = async () => {
    if (!repositoryAnalysis.generatedFiles || !repoUrl) {
      toast({
        title: "Missing Information",
        description: "Repository analysis is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingBranch(true);

    try {
      const githubService = await GitHubService.fromStoredToken();
      
      // Check permissions first
      const hasPermissions = await githubService.checkRepositoryPermissions(repoUrl);
      if (!hasPermissions) {
        toast({
          title: "Insufficient Permissions",
          description: "You need push access to this repository to create a branch",
          variant: "destructive",
        });
        setIsCreatingBranch(false);
        return;
      }

      // Convert generated files to GitHub file format
      const githubFiles = repositoryAnalysis.generatedFiles.map(file => ({
        path: file.path,
        content: file.content,
        type: file.type,
      }));

      const result = await githubService.createLocalizationBranch(repoUrl, githubFiles);
      
      setBranchCreated({
        branchUrl: result.branchUrl,
        prUrl: result.prUrl,
      });

      toast({
        title: "Branch Created Successfully!",
        description: "Your localization branch and pull request have been created",
      });

    } catch (error) {
      console.error('Failed to create branch:', error);
      toast({
        title: "Failed to Create Branch",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const restart = () => {
    setCurrentStep(1);
    setRepoUrl("");
    setSelectedLanguages([]);
    setShowRepoSelector(true);
    // Reset analysis state
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access the localization tool</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/login'} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Github className="h-8 w-8" />
            <Globe className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            GitHub Codebase Localization Tool
          </h1>
          <p className="text-muted-foreground">
            Automatically analyze, structure, and localize your GitHub repositories with AI
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${index < currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                `}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm ${index < currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

            {/* Step 1: Repository Selection */}
            {currentStep === 1 && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      GitHub Configuration
                    </CardTitle>
                    <CardDescription>
                      Connect your GitHub account to access repositories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GitHubProfile />
                  </CardContent>
                </Card>

                {showRepoSelector && (
                  <RepositorySelector 
                    onRepositorySelect={handleRepositorySelect}
                    selectedRepo={repoUrl}
                  />
                )}
              </>
            )}


        {repositoryAnalysis.isAnalyzing && currentStep === 2 && (
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

        {currentStep >= 2 && repositoryAnalysis.analysisResults && !repositoryAnalysis.isAnalyzing && (
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

        {currentStep >= 3 && (
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
            {currentStep === 3 && (
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

        {repositoryAnalysis.progress.stage === 'generating' && currentStep === 4 && (
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

        {currentStep === 5 && repositoryAnalysis.generatedFiles && repositoryAnalysis.generatedFiles.length > 0 && (
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
            
            <div className="flex space-x-4 flex-wrap gap-4">
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
              
              {!branchCreated && (
                <button
                  onClick={handleCreateBranch}
                  disabled={isCreatingBranch}
                  className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingBranch ? (
                    <Loader size={20} className="animate-spin" />
                  ) : (
                    <GitBranch size={20} />
                  )}
                  <span>{isCreatingBranch ? 'Creating Feature Branch...' : 'Create Feature Branch'}</span>
                </button>
              )}
              
              {branchCreated && (
                <div className="flex space-x-2">
                  <a
                    href={branchCreated.branchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <GitBranch size={20} />
                    <span>View Branch</span>
                  </a>
                  <a
                    href={branchCreated.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <GitPullRequest size={20} />
                    <span>View Pull Request</span>
                  </a>
                </div>
              )}
              
              <button
                onClick={restart}
                className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Github size={20} />
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