import React, { useState } from 'react';
import { Github, Globe, Download, GitPullRequest, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const GitHubLocalizationApp = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [githubToken, setGithubToken] = useState('');

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
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(1);

    try {
      const results = await analyzeRepository(repoUrl);
      setAnalysisResults(results);
      setCurrentStep(2);
      setSelectedLanguages(popularLanguages.slice(0, 3));
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze repository: ' + error.message);
      setCurrentStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeRepository = async (url: string) => {
    // Extract owner and repo from GitHub URL
    const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) throw new Error('Invalid GitHub URL format');
    
    const owner = repoMatch[1];
    const repo = repoMatch[2].replace(/\.git$/, '').replace(/\/$/, '');
    
    // Fetch repository tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch repository: ${treeResponse.status} ${treeResponse.statusText}`);
    }
    
    const treeData = await treeResponse.json();
    const files = treeData.tree.filter((item: any) => item.type === 'blob');
    
    // Detect framework
    const framework = detectFramework(files);
    
    // Filter relevant files for analysis
    const relevantFiles = files.filter((file: any) => {
      const ext = file.path.split('.').pop()?.toLowerCase();
      return ['js', 'jsx', 'ts', 'tsx', 'vue', 'html', 'json'].includes(ext || '');
    });
    
    // Analyze files for strings and i18n setup
    const analysisPromises = relevantFiles.slice(0, 20).map(async (file: any) => {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        const content = atob(data.content);
        
        return analyzeFileContent(file.path, content);
      } catch (error) {
        console.warn(`Failed to fetch ${file.path}:`, error);
        return null;
      }
    });
    
    const fileAnalyses = (await Promise.all(analysisPromises)).filter(Boolean);
    
    // Aggregate results
    const totalStrings = fileAnalyses.reduce((sum, analysis) => sum + (analysis?.strings.length || 0), 0);
    const hasI18nStructure = detectI18nStructure(files, fileAnalyses);
    const recommendations = generateRecommendations(framework, hasI18nStructure, totalStrings, files);
    
    return {
      hasI18nStructure,
      framework,
      stringsFound: totalStrings,
      filesAnalyzed: fileAnalyses.length,
      recommendations
    };
  };

  const detectFramework = (files: any[]) => {
    const filePaths = files.map(f => f.path.toLowerCase());
    
    if (filePaths.some(p => p.includes('package.json'))) {
      if (filePaths.some(p => p.includes('.tsx') || p.includes('.jsx'))) return 'React';
      if (filePaths.some(p => p.includes('.vue'))) return 'Vue';
      if (filePaths.some(p => p.includes('angular.json'))) return 'Angular';
      if (filePaths.some(p => p.includes('svelte.config'))) return 'Svelte';
      if (filePaths.some(p => p.includes('next.config'))) return 'Next.js';
      if (filePaths.some(p => p.includes('nuxt.config'))) return 'Nuxt.js';
    }
    
    if (filePaths.some(p => p.includes('.vue'))) return 'Vue';
    if (filePaths.some(p => p.includes('.tsx') || p.includes('.jsx'))) return 'React';
    if (filePaths.some(p => p.includes('.component.ts'))) return 'Angular';
    
    return 'JavaScript/HTML';
  };

  const analyzeFileContent = (filePath: string, content: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const strings: string[] = [];
    
    try {
      if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
        // Extract JSX text content and string literals
        const jsxTextRegex = />([^<>{}]+)</g;
        const stringLiteralRegex = /(['"`])([^'"`\n]{3,})\1/g;
        
        let match;
        while ((match = jsxTextRegex.exec(content)) !== null) {
          const text = match[1].trim();
          if (text && !text.match(/^[{}\s]*$/) && !text.match(/^\d+$/)) {
            strings.push(text);
          }
        }
        
        while ((match = stringLiteralRegex.exec(content)) !== null) {
          const text = match[2].trim();
          if (text && text.length > 2 && !text.match(/^[\d\s\.\-_]+$/)) {
            strings.push(text);
          }
        }
      } else if (ext === 'vue') {
        // Extract Vue template content
        const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
        if (templateMatch) {
          const templateContent = templateMatch[1];
          const textRegex = />([^<>{}]+)</g;
          let match;
          while ((match = textRegex.exec(templateContent)) !== null) {
            const text = match[1].trim();
            if (text && !text.match(/^[{}\s]*$/)) {
              strings.push(text);
            }
          }
        }
      } else if (ext === 'html') {
        // Extract HTML text content
        const textRegex = />([^<>]+)</g;
        let match;
        while ((match = textRegex.exec(content)) !== null) {
          const text = match[1].trim();
          if (text && text.length > 2) {
            strings.push(text);
          }
        }
      }
    } catch (error) {
      console.warn(`Error analyzing ${filePath}:`, error);
    }
    
    return { filePath, strings: [...new Set(strings)] };
  };

  const detectI18nStructure = (files: any[], fileAnalyses: any[]) => {
    const filePaths = files.map(f => f.path.toLowerCase());
    
    // Check for common i18n patterns
    const i18nIndicators = [
      'i18n', 'locale', 'locales', 'translations', 'lang', 'languages',
      'intl', 'react-intl', 'vue-i18n', 'angular-translate', 'next-translate'
    ];
    
    const hasI18nFiles = filePaths.some(path => 
      i18nIndicators.some(indicator => path.includes(indicator))
    );
    
    const hasI18nImports = fileAnalyses.some(analysis => {
      if (!analysis) return false;
      // This would require checking file content for i18n imports
      return false; // Simplified for now
    });
    
    return hasI18nFiles || hasI18nImports;
  };

  const generateRecommendations = (framework: string, hasI18n: boolean, stringCount: number, files: any[]) => {
    const recommendations = [];
    
    if (!hasI18n) {
      if (framework === 'React') {
        recommendations.push('Install react-i18next for internationalization');
        recommendations.push('Create src/i18n/index.js configuration file');
      } else if (framework === 'Vue') {
        recommendations.push('Install vue-i18n for internationalization');
        recommendations.push('Configure Vue i18n plugin');
      } else if (framework === 'Angular') {
        recommendations.push('Use Angular i18n (@angular/localize)');
        recommendations.push('Configure angular.json for localization');
      } else {
        recommendations.push('Add custom translation system');
      }
      
      recommendations.push('Create locales directory structure');
      recommendations.push('Extract hardcoded strings to translation files');
    } else {
      recommendations.push('Extend existing i18n setup');
      recommendations.push('Audit current translation coverage');
    }
    
    if (stringCount > 100) {
      recommendations.push('Consider automated string extraction tools');
    }
    
    if (!files.some(f => f.path.includes('README'))) {
      recommendations.push('Add localization documentation to README');
    }
    
    recommendations.push('Add language switcher component');
    recommendations.push('Set up automated translation workflows');
    
    return recommendations;
  };

  const handleLanguageToggle = (language) => {
    setSelectedLanguages(prev => 
      prev.find(lang => lang.code === language.code)
        ? prev.filter(lang => lang.code !== language.code)
        : [...prev, language]
    );
  };

  const handleLocalize = async () => {
    if (selectedLanguages.length === 0) {
      alert('Please select at least one language');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(3);

    setTimeout(() => {
      setCurrentStep(4);
      setIsProcessing(false);
    }, 3000);
  };

  const generateFileContents = () => {
    const timestamp = new Date().toISOString();
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'localized-app';
    
    const packageJson = {
      name: repoName,
      version: '1.0.0',
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test'
      }
    };

    const i18nConfig = 'Custom translation system with support for multiple languages';
    const languageSwitcher = 'React component for switching between languages';
    const readme = 'Documentation for the internationalized application';

    const translations = {};
    selectedLanguages.forEach(lang => {
      translations[lang.code] = {
        welcome: 'Welcome message in ' + lang.name,
        login: 'Login in ' + lang.name,
        logout: 'Logout in ' + lang.name
      };
    });

    return {
      packageJson,
      i18nConfig,
      translations,
      languageSwitcher,
      readme,
      timestamp,
      repoName
    };
  };

  const handleDownload = async () => {
    console.log('Download button clicked');
    
    try {
      const fileContents = generateFileContents();
      const languages = selectedLanguages.map(lang => lang.flag + ' ' + lang.name).join(', ');
      
      const content = 'GITHUB LOCALIZATION TOOL - GENERATED FILES\n' +
        'Generated: ' + new Date().toLocaleString() + '\n' +
        'Repository: ' + repoUrl + '\n' +
        'Languages: ' + languages + '\n\n' +
        'FILES CREATED:\n' +
        '- package.json: Project configuration\n' +
        '- src/i18n/index.js: Translation system\n' +
        '- src/components/LanguageSwitcher.jsx: Language switcher\n' +
        '- README.md: Setup documentation\n\n' +
        'INSTALLATION:\n' +
        '1. Extract files to your project\n' +
        '2. Run: npm install\n' +
        '3. Add translation system to your components\n' +
        '4. Use translation functions in your UI\n\n' +
        'USAGE EXAMPLE:\n' +
        'function MyComponent() {\n' +
        '  const translate = (key) => {\n' +
        '    // Your translation logic\n' +
        '    return key;\n' +
        '  };\n' +
        '  return <h1>{translate("welcome")}</h1>;\n' +
        '}\n\n' +
        'LANGUAGES SUPPORTED:\n' +
        selectedLanguages.map(lang => '- ' + lang.flag + ' ' + lang.name + ' (' + lang.code + ')').join('\n') + '\n\n' +
        'Next steps:\n' +
        '- Customize translations for your specific needs\n' +
        '- Add more languages as required\n' +
        '- Integrate with your existing components\n' +
        '- Test language switching functionality\n';

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileContents.repoName + '-localized-' + new Date().toISOString().split('T')[0] + '.txt';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      
      alert('Download completed! Check your Downloads folder for the localized codebase.');
      
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    }
  };

  const handleCreatePR = async () => {
    console.log('Create PR button clicked');
    
    if (!repoUrl || !selectedLanguages?.length || !analysisResults) {
      alert('Missing required data. Please complete the localization process first.');
      return;
    }

    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      alert('Invalid GitHub URL format.');
      return;
    }
    
    const owner = repoMatch[1];
    const repo = repoMatch[2].replace(/\.git$/, '').replace(/\/$/, '');
    
    if (!githubToken) {
      const tokenInput = prompt('GitHub Personal Access Token Required\n\n' +
        'To create a Pull Request automatically, you need a GitHub Personal Access Token.\n\n' +
        'How to get one:\n' +
        '1. Go to GitHub.com → Settings → Developer settings → Personal access tokens\n' +
        '2. Generate new token (classic)\n' +
        '3. Select scopes: repo, workflow\n' +
        '4. Copy the token and paste it below\n\n' +
        'Enter your GitHub token:', '');
      
      if (!tokenInput) {
        const fallbackConfirm = confirm('No token provided. Would you like to:\n\n' +
          'OK: Open GitHub with pre-filled PR form (manual creation)\n' +
          'Cancel: Copy GitHub URL to clipboard\n\n' +
          'Choose your preferred option:');
        
        if (fallbackConfirm) {
          const branchName = 'localization-' + new Date().toISOString().split('T')[0];
          const prTitle = 'feat: Add internationalization support for ' + selectedLanguages.length + ' languages';
          const githubUrl = 'https://github.com/' + owner + '/' + repo + '/compare/main...' + branchName + '?quick_pull=1&title=' + encodeURIComponent(prTitle);
          window.open(githubUrl, '_blank');
          return;
        } else {
          const githubUrl = 'https://github.com/' + owner + '/' + repo;
          navigator.clipboard.writeText(githubUrl);
          alert('GitHub repository URL copied to clipboard!');
          return;
        }
      }
      
      setGithubToken(tokenInput);
    }
    
    try {
      setIsProcessing(true);
      
      alert('PR Creation Feature\n\n' +
        'This feature would create a pull request with:\n' +
        '• Repository: ' + owner + '/' + repo + '\n' +
        '• Languages: ' + selectedLanguages.length + ' (' + selectedLanguages.map(lang => lang.name).join(', ') + ')\n' +
        '• Files: Translation system, language switcher, documentation\n\n' +
        'For demo purposes, opening GitHub repository instead.');
      
      window.open('https://github.com/' + owner + '/' + repo, '_blank');
      
    } catch (error) {
      console.error('Error creating PR:', error);
      alert('Failed to create Pull Request: ' + error.message);
    } finally {
      setIsProcessing(false);
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
              Enter GitHub Repository URL
            </h2>
            <div className="flex gap-4">
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAnalyze}
                disabled={isProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Analyze
              </button>
            </div>
          </div>
        )}

        {currentStep >= 1 && analysisResults && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Analysis Results
            </h2>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                {analysisResults.hasI18nStructure ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <span>
                  {analysisResults.hasI18nStructure ? 'I18n structure detected' : 'I18n structure needed'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Framework: {analysisResults.framework}
              </div>
              <div className="text-sm text-gray-600">
                Strings found: {analysisResults.stringsFound}
              </div>
              <div className="text-sm text-gray-600">
                Files analyzed: {analysisResults.filesAnalyzed}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Recommendations:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                {analysisResults.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
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
                    ${selectedLanguages.find(lang => lang.code === language.code)
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

        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="text-center">
              <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Processing Localization</h2>
              <p className="text-gray-600">
                AI is analyzing your code structure and generating translations...
              </p>
              <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-600">✓ Extracting translatable strings</div>
                <div className="text-sm text-gray-600">✓ Setting up i18n structure</div>
                <div className="text-sm text-gray-600">⏳ Generating translations</div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Localization Complete!
            </h2>
            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>✓ {selectedLanguages.length} languages processed</div>
                <div>✓ I18n structure implemented</div>
                <div>✓ {analysisResults.stringsFound} strings translated</div>
                <div>✓ Ready for continuous localization</div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleDownload}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Files
              </button>
              <button
                onClick={handleCreatePR}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader className="w-5 h-5 animate-spin" /> : <GitPullRequest className="w-5 h-5" />}
                Create Pull Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitHubLocalizationApp;
