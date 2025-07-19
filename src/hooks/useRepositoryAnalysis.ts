import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { RepositoryAnalysisService, StringExtractionService, FileGenerationService } from '@/services/database';

interface AnalysisProgress {
  current: number;
  total: number;
  stage: 'analyzing' | 'extracting' | 'generating' | 'saving';
  message: string;
}

interface AnalysisState {
  isAnalyzing: boolean;
  progress: AnalysisProgress;
  analysisId: string | null;
  analysisResults: any | null;
  extractionResults: any | null;
  generatedFiles: any[] | null;
}

export const useRepositoryAnalysis = () => {
  const { toast } = useToast();
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: { current: 0, total: 0, stage: 'analyzing', message: '' },
    analysisId: null,
    analysisResults: null,
    extractionResults: null,
    generatedFiles: null,
  });

  const updateProgress = useCallback((progress: Partial<AnalysisProgress>) => {
    setState(prev => ({
      ...prev,
      progress: { ...prev.progress, ...progress }
    }));
  }, []);

  const analyzeRepository = useCallback(async (
    repoUrl: string,
    githubToken: string,
    analysisMode: 'fast' | 'complete' = 'complete'
  ) => {
    setState(prev => ({ ...prev, isAnalyzing: true }));
    updateProgress({ stage: 'analyzing', current: 0, total: 0 });

    try {
      // Extract repository info
      const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) throw new Error('Invalid GitHub URL format');
      
      const owner = repoMatch[1];
      const repo = repoMatch[2].replace(/\.git$/, '').replace(/\/$/, '');

      // 1. Create initial repository analysis record
      const analysisData = {
        repositoryUrl: repoUrl,
        repositoryName: repo,
        repositoryOwner: owner,
        analysisData: { mode: analysisMode, startTime: new Date().toISOString() },
        status: 'processing',
      };

      const analysis = await RepositoryAnalysisService.createAnalysis(analysisData);
      
      setState(prev => ({ ...prev, analysisId: analysis.id }));

      // 2. Perform GitHub API analysis (existing logic)
      const analysisResults = await performGitHubAnalysis(repoUrl, githubToken, analysisMode, updateProgress);
      
      // 3. Update analysis with results
      await RepositoryAnalysisService.updateAnalysis(analysis.id, {
        analysis_data: {
          ...analysisData.analysisData,
          results: analysisResults,
          completedTime: new Date().toISOString()
        } as any,
        status: 'completed',
        total_files: analysisResults.totalFiles,
        localizable_files: analysisResults.filesAnalyzed,
        strings_found: analysisResults.stringsFound,
        estimated_effort: estimateEffort(analysisResults.stringsFound, analysisResults.filesAnalyzed),
      });

      // 4. Save extracted strings to database
      updateProgress({ stage: 'saving' });
      
      if (analysisResults.extractedStrings && analysisResults.extractedStrings.length > 0) {
        await StringExtractionService.saveExtractedStrings(analysis.id, analysisResults.extractedStrings);
      }

      setState(prev => ({
        ...prev,
        analysisResults,
        extractionResults: {
          totalStrings: analysisResults.stringsFound,
          totalFiles: analysisResults.filesAnalyzed,
          framework: analysisResults.framework,
          keyMap: analysisResults.keyMap || {},
        }
      }));

      toast({
        title: "Analysis Complete",
        description: `Found ${analysisResults.stringsFound} strings in ${analysisResults.filesAnalyzed} files`,
      });

      return analysis.id;

    } catch (error) {
      console.error('Repository analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [toast, updateProgress]);

  const generateFiles = useCallback(async (
    analysisId: string,
    selectedLanguages: any[],
    analysisResults: any,
    extractionResults: any
  ) => {
    // Calculate total steps: config + english + translation for each language + file for each language + readme
    const totalSteps = 2 + selectedLanguages.length * 2 + 1;
    updateProgress({ stage: 'generating', current: 0, total: totalSteps, message: 'Starting file generation...' });

    try {
      const { I18nGenerator } = await import('../utils/i18nGenerator.js');
      const { AITranslationService } = await import('../services/translationService');
      const detectedFramework = analysisResults?.framework || 'React';
      const generator = new I18nGenerator(detectedFramework);

      const extractedStrings = await StringExtractionService.getExtractedStrings(analysisId);
      updateProgress({ message: `Found ${extractedStrings.length} strings to process.` });

      const generatedFiles = [];
      let currentStep = 0;

      // 1. I18n configuration
      updateProgress({ current: currentStep, message: 'Generating i18n configuration file...' });
      try {
        const configFile = {
          path: 'src/i18n/index.js',
          content: generator.generateI18nConfig(),
          type: 'config'
        };
        generatedFiles.push(configFile);
        await FileGenerationService.saveTransformation({
          analysisId,
          filePath: configFile.path,
          originalCode: '',
          transformedCode: configFile.content,
          transformations: { type: 'i18n_config', framework: detectedFramework },
        });
        currentStep++;
        updateProgress({ current: currentStep, message: 'Configuration file generated.' });
      } catch (error) {
        console.error('❌ Failed to generate config file:', error);
        throw new Error(`Config file generation failed: ${error.message}`);
      }

      // 2. English translation file
      updateProgress({ current: currentStep, message: 'Generating English translation file...' });
      try {
        const englishTranslations = {};
        extractedStrings.forEach(item => {
          if (item.translation_key) {
            englishTranslations[item.translation_key] = item.string_value;
          }
        });
        const enFile = {
          path: 'src/i18n/locales/en.json',
          content: JSON.stringify(englishTranslations, null, 2),
          type: 'translation'
        };
        generatedFiles.push(enFile);
        await FileGenerationService.saveTransformation({
          analysisId,
          filePath: enFile.path,
          originalCode: '',
          transformedCode: enFile.content,
          transformations: { type: 'translation_file', language: 'en', stringCount: Object.keys(englishTranslations).length },
        });
        currentStep++;
        updateProgress({ current: currentStep, message: 'English file generated.' });
      } catch (error) {
        console.error('❌ Failed to generate English file:', error);
        throw new Error(`English file generation failed: ${error.message}`);
      }

      // 3. Translate strings to target languages
      const stringsToTranslate = {};
      extractedStrings.forEach(item => {
        if (item.translation_key && item.string_value) {
          stringsToTranslate[item.translation_key] = item.string_value;
        }
      });
      const nonEnglishLanguages = selectedLanguages.filter(lang => lang.code !== 'en');

      for (const language of nonEnglishLanguages) {
        updateProgress({ current: currentStep, message: `Translating strings to ${language.name}...` });
        try {
          await AITranslationService.translateStrings(
            analysisId,
            stringsToTranslate,
            language.code,
          );
          currentStep++;
          updateProgress({ current: currentStep, message: `Translation to ${language.name} complete.` });
        } catch (translationError) {
          console.error(`❌ Translation failed for ${language.code}:`, translationError);
          toast({
            title: `Translation Error for ${language.name}`,
            description: `Skipping ${language.name} due to an error.`,
            variant: "destructive",
          });
          // Still increment step to avoid getting stuck
          currentStep++;
          updateProgress({ current: currentStep, message: `Skipped ${language.name} translation due to error.` });
        }
      }

      // 4. Generate translation files from database
      updateProgress({ current: currentStep, message: 'Generating all translation files...' });
      try {
        const translationFiles = await AITranslationService.generateTranslationFiles(
          analysisId,
          selectedLanguages
        );

        for (const file of translationFiles) {
          const language = selectedLanguages.find(l => l.code === file.language);
          updateProgress({ current: currentStep, message: `Generating file for ${language?.name || file.language}...` });
          
          const translationFile = {
            path: file.path,
            content: file.content,
            type: 'translation' as const,
            language: file.language
          };
          generatedFiles.push(translationFile);

          await FileGenerationService.saveTransformation({
            analysisId,
            filePath: translationFile.path,
            originalCode: '',
            transformedCode: translationFile.content,
            transformations: {
              type: 'translation_file',
              language: file.language,
              stringCount: Object.keys(JSON.parse(file.content)).length,
            },
          });
          currentStep++;
          updateProgress({ current: currentStep, message: `File for ${language?.name || file.language} generated.` });
        }
      } catch (error) {
        console.error('❌ Failed to generate one or more translation files:', error);
        toast({
          title: "Translation File Generation Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
        // Skip remaining language file generation steps
        currentStep += selectedLanguages.filter(l => l.code !== 'en').length;
        updateProgress({ current: currentStep, message: 'Skipping file generation due to error.' });
      }

      // 5. Generate README
      updateProgress({ current: currentStep, message: 'Generating README file...' });
      try {
        const readmeContent = generator.generateReadme();
        const readmeFile = {
          path: 'README_LOCALIZATION.md',
          content: readmeContent,
          type: 'documentation'
        };
        generatedFiles.push(readmeFile);
        await FileGenerationService.saveTransformation({
          analysisId,
          filePath: readmeFile.path,
          originalCode: '',
          transformedCode: readmeFile.content,
          transformations: { type: 'documentation' },
        });
        currentStep++;
        updateProgress({ current: currentStep, message: 'README file generated.' });
      } catch (error) {
        console.error('❌ Failed to generate README:', error);
      }

      setState(prev => ({ ...prev, generatedFiles }));

      toast({
        title: "Files Generated Successfully",
        description: `Generated ${generatedFiles.length} files for ${selectedLanguages.length} languages`,
      });

      console.log(`🎉 File generation completed: ${generatedFiles.length} files generated`);
      return generatedFiles;

    } catch (error) {
      console.error('❌ File generation failed:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Unknown error occurred during file generation",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast, updateProgress]);

  const loadAnalysis = useCallback(async (analysisId: string) => {
    try {
      const analysis = await RepositoryAnalysisService.getAnalysis(analysisId);
      const extractedStrings = await StringExtractionService.getExtractedStrings(analysisId);
      const transformations = await FileGenerationService.getTransformations(analysisId);

      const analysisData = analysis.analysis_data as any;
      const transformationData = transformations.map(t => {
        const transData = t.transformations as any;
        return {
          path: t.file_path,
          content: t.transformed_code,
          type: transData?.type || 'unknown'
        };
      });

      setState(prev => ({
        ...prev,
        analysisId,
        analysisResults: analysisData?.results || null,
        extractionResults: {
          totalStrings: analysis.strings_found || 0,
          totalFiles: analysis.localizable_files || 0,
          framework: analysisData?.results?.framework || 'React',
          keyMap: extractedStrings.reduce((acc: any, str) => {
            if (str.translation_key) {
              acc[str.translation_key] = str;
            }
            return acc;
          }, {}),
        },
        generatedFiles: transformationData,
      }));

      return analysis;
    } catch (error) {
      console.error('Failed to load analysis:', error);
      toast({
        title: "Load Failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  return {
    ...state,
    analyzeRepository,
    generateFiles,
    loadAnalysis,
  };
};

// Helper functions
async function performGitHubAnalysis(repoUrl: string, githubToken: string, analysisMode: string, updateProgress: any) {
  // This is the existing GitHub analysis logic from Index.tsx
  // Import and use the existing analysis functions
  const { StringExtractor } = await import('../utils/stringExtractor.js');
  
  // Extract owner and repo from GitHub URL
  const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!repoMatch) throw new Error('Invalid GitHub URL format');
  
  const owner = repoMatch[1];
  const repo = repoMatch[2].replace(/\.git$/, '').replace(/\/$/, '');
  
  // Make GitHub API request with auth
  const makeGitHubRequest = async (url: string) => {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Localization-Tool'
    };
    
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return response;
  };

  // Fetch repository tree
  const treeResponse = await makeGitHubRequest(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
  const treeData = await treeResponse.json();
  const files = treeData.tree.filter((item: any) => item.type === 'blob');
  
  // Detect framework and prioritize files (existing logic)
  const framework = detectFramework(files);
  const prioritizedFiles = prioritizeFiles(files);
  
  updateProgress({ total: prioritizedFiles.length });
  
  // Analyze files progressively
  const extractor = new StringExtractor();
  const analysisResults = [];
  const allExtractedStrings = [];
  
  const maxFiles = analysisMode === 'fast' ? Math.min(prioritizedFiles.length, 50) : prioritizedFiles.length;
  
  for (let i = 0; i < maxFiles; i++) {
    const file = prioritizedFiles[i];
    updateProgress({ current: i + 1 });
    
    try {
      const response = await makeGitHubRequest(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`);
      const data = await response.json();
      
      if (data.size > 1000000) continue; // Skip large files
      
      const content = atob(data.content);
      const extractedStrings = extractor.extractStrings(content, file.path);
      
      if (extractedStrings.length > 0) {
        analysisResults.push({ filePath: file.path, strings: extractedStrings.map(s => s.text) });
        allExtractedStrings.push(...extractedStrings);
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.warn(`Failed to fetch ${file.path}:`, error);
      continue;
    }
  }
  
  // Create key map for extracted strings
  const keyMap = {};
  allExtractedStrings.forEach(item => {
    keyMap[item.key] = item;
  });
  
  return {
    hasI18nStructure: detectI18nStructure(files),
    framework,
    stringsFound: allExtractedStrings.length,
    filesAnalyzed: analysisResults.length,
    totalFiles: prioritizedFiles.length,
    recommendations: generateRecommendations(framework, false, allExtractedStrings.length),
    extractedStrings: allExtractedStrings,
    keyMap,
  };
}

function detectFramework(files: any[]) {
  const filePaths = files.map(f => f.path.toLowerCase());
  
  if (filePaths.some(p => p.includes('.tsx') || p.includes('.jsx'))) return 'React';
  if (filePaths.some(p => p.includes('.vue'))) return 'Vue';
  if (filePaths.some(p => p.includes('angular.json'))) return 'Angular';
  if (filePaths.some(p => p.includes('next.config'))) return 'Next.js';
  
  return 'JavaScript/HTML';
}

function prioritizeFiles(files: any[]) {
  return files.filter((file: any) => {
    const path = file.path.toLowerCase();
    const ext = path.split('.').pop();
    
    const supportedExts = ['js', 'jsx', 'ts', 'tsx', 'vue', 'html', 'json'];
    const skipPatterns = ['node_modules/', '.git/', 'dist/', 'build/', 'test/'];
    
    if (skipPatterns.some(pattern => path.includes(pattern))) return false;
    return supportedExts.includes(ext || '');
  }).sort((a, b) => {
    const scoreA = getFilePriority(a.path);
    const scoreB = getFilePriority(b.path);
    return scoreB - scoreA;
  });
}

function getFilePriority(filePath: string): number {
  const path = filePath.toLowerCase();
  let score = 0;
  
  if (path.includes('app.') || path.includes('main.') || path.includes('index.')) score += 80;
  if (path.includes('src/') || path.includes('app/')) score += 60;
  if (path.includes('component')) score += 50;
  if (path.includes('i18n') || path.includes('locale')) score += 90;
  
  return score;
}

function detectI18nStructure(files: any[]) {
  const filePaths = files.map(f => f.path.toLowerCase());
  const i18nIndicators = ['i18n', 'locale', 'locales', 'translations', 'lang'];
  
  return filePaths.some(path => 
    i18nIndicators.some(indicator => path.includes(indicator))
  );
}

function generateRecommendations(framework: string, hasI18n: boolean, stringCount: number) {
  const recommendations = [];
  
  if (!hasI18n) {
    if (framework === 'React') {
      recommendations.push('Install react-i18next for internationalization');
    } else if (framework === 'Vue') {
      recommendations.push('Install vue-i18n for internationalization');
    }
    recommendations.push('Create locales directory structure');
  }
  
  if (stringCount > 100) {
    recommendations.push('Consider automated string extraction tools');
  }
  
  recommendations.push('Add language switcher component');
  recommendations.push('Set up automated translation workflows');
  
  return recommendations;
}

function estimateEffort(stringCount: number, fileCount: number): string {
  const baseHours = Math.ceil(stringCount / 50) + Math.ceil(fileCount / 10);
  
  if (baseHours < 8) return 'Small (< 1 day)';
  if (baseHours < 24) return 'Medium (1-3 days)';
  if (baseHours < 80) return 'Large (1-2 weeks)';
  return 'Extra Large (> 2 weeks)';
}