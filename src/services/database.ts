import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type RepositoryAnalysis = Database['public']['Tables']['repository_analyses']['Insert'];
type ExtractedString = Database['public']['Tables']['extracted_strings']['Insert'];
type CodeTransformation = Database['public']['Tables']['code_transformations']['Insert'];
type Translation = Database['public']['Tables']['translations']['Insert'];
type TranslationJob = Database['public']['Tables']['translation_jobs']['Insert'];

// Repository Analysis Database Service
export class RepositoryAnalysisService {
  static async createAnalysis(data: {
    repositoryUrl: string;
    repositoryName: string;
    repositoryOwner: string;
    analysisData: any;
    status?: string;
    estimatedEffort?: string;
    totalFiles?: number;
    localizableFiles?: number;
    stringsFound?: number;
  }) {
    const { data: analysis, error } = await supabase
      .from('repository_analyses')
      .insert({
        repository_url: data.repositoryUrl,
        repository_name: data.repositoryName,
        repository_owner: data.repositoryOwner,
        analysis_data: data.analysisData,
        status: data.status || 'completed',
        estimated_effort: data.estimatedEffort,
        total_files: data.totalFiles,
        localizable_files: data.localizableFiles,
        strings_found: data.stringsFound,
        user_id: (await supabase.auth.getUser()).data.user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return analysis;
  }

  static async getAnalysis(id: string) {
    const { data, error } = await supabase
      .from('repository_analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserAnalyses() {
    const { data, error } = await supabase
      .from('repository_analyses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async updateAnalysis(id: string, updates: Partial<RepositoryAnalysis>) {
    const { data, error } = await supabase
      .from('repository_analyses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// String Extraction Database Service
export class StringExtractionService {
  static async saveExtractedStrings(analysisId: string, strings: any[]) {
    console.log(`Preparing to save ${strings.length} extracted strings for analysis ${analysisId}`);
    
    const extractedStrings = strings.map(string => ({
      analysis_id: analysisId,
      string_value: string.text,
      file_path: string.filePath,
      line_number: string.location?.line || null,
      context: string.context || null,
      translation_key: string.key,
      category: string.context?.type || null,
      component_name: this.extractComponentName(string.filePath),
      priority: this.calculatePriority(string),
    }));

    // Use upsert to handle potential duplicates gracefully
    const { data, error } = await supabase
      .from('extracted_strings')
      .upsert(extractedStrings, { 
        onConflict: 'analysis_id,file_path,string_value',
        ignoreDuplicates: true 
      })
      .select();

    if (error) {
      console.error('Failed to save extracted strings:', error);
      throw error;
    }
    
    console.log(`Successfully saved ${data?.length || 0} extracted strings`);
    return data;
  }

  static async getExtractedStrings(analysisId: string) {
    const { data, error } = await supabase
      .from('extracted_strings')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('priority', { ascending: false });

    if (error) throw error;
    return data;
  }

  private static extractComponentName(filePath: string): string | null {
    const fileName = filePath.split('/').pop();
    if (!fileName) return null;
    
    const nameWithoutExt = fileName.split('.')[0];
    return nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
  }

  private static calculatePriority(string: any): number {
    let priority = 1;
    
    // Higher priority for UI text
    if (string.context?.type === 'button') priority = 3;
    if (string.context?.type === 'title' || string.context?.type === 'heading') priority = 3;
    if (string.context?.type === 'error') priority = 4;
    if (string.context?.type === 'label') priority = 2;
    
    // Higher priority for longer strings
    if (string.text.length > 50) priority += 1;
    
    return priority;
  }
}

// File Generation Database Service
export class FileGenerationService {
  static async saveTransformation(data: {
    analysisId: string;
    filePath: string;
    originalCode: string;
    transformedCode: string;
    transformations: any;
    importsAdded?: string[];
    hooksAdded?: string[];
    status?: string;
  }) {
    const { data: transformation, error } = await supabase
      .from('code_transformations')
      .insert({
        analysis_id: data.analysisId,
        file_path: data.filePath,
        original_code: data.originalCode,
        transformed_code: data.transformedCode,
        transformations: data.transformations,
        imports_added: data.importsAdded || [],
        hooks_added: data.hooksAdded || [],
        status: data.status || 'completed',
      })
      .select()
      .single();

    if (error) throw error;
    return transformation;
  }

  static async getTransformations(analysisId: string) {
    const { data, error } = await supabase
      .from('code_transformations')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}

// Translation Management Database Service
export class TranslationService {
  static async createTranslationJob(data: {
    analysisId: string;
    targetLanguages: string[];
    totalStrings: number;
    totalFiles: number;
    options?: any;
  }) {
    const { data: job, error } = await supabase
      .from('translation_jobs')
      .insert({
        analysis_id: data.analysisId,
        target_languages: data.targetLanguages,
        total_strings: data.totalStrings,
        total_files: data.totalFiles,
        options: data.options || {},
        status: 'pending',
        progress: 0,
        processed_strings: 0,
        processed_files: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return job;
  }

  static async updateTranslationJobProgress(jobId: string, updates: {
    progress?: number;
    processedStrings?: number;
    processedFiles?: number;
    status?: string;
    errorMessage?: string;
  }) {
    const { data, error } = await supabase
      .from('translation_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async saveTranslation(data: {
    analysisId: string;
    translationKey: string;
    originalText: string;
    translatedText: string;
    languageCode: string;
    qualityScore?: number;
    status?: string;
  }) {
    const { data: translation, error } = await supabase
      .from('translations')
      .upsert({
        analysis_id: data.analysisId,
        translation_key: data.translationKey,
        original_text: data.originalText,
        translated_text: data.translatedText,
        language_code: data.languageCode,
        quality_score: data.qualityScore || 0.9,
        status: data.status || 'completed',
      }, {
        onConflict: 'analysis_id,language_code,translation_key'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save translation:', error);
      throw error;
    }
    return translation;
  }

  static async getTranslations(analysisId: string, languageCode?: string) {
    let query = supabase
      .from('translations')
      .select('*')
      .eq('analysis_id', analysisId);

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}

// Cache Service for translations
export class TranslationCacheService {
  static async getCachedTranslation(sourceText: string, targetLanguage: string) {
    const { data, error } = await supabase
      .from('translation_cache')
      .select('*')
      .eq('source_text', sourceText)
      .eq('target_language', targetLanguage)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return data;
  }

  static async cacheTranslation(data: {
    sourceText: string;
    targetLanguage: string;
    translatedText: string;
    qualityScore?: number;
  }) {
    const { data: cached, error } = await supabase
      .from('translation_cache')
      .insert({
        source_text: data.sourceText,
        target_language: data.targetLanguage,
        translated_text: data.translatedText,
        quality_score: data.qualityScore || 0.9,
      })
      .select()
      .single();

    if (error) throw error;
    return cached;
  }
}