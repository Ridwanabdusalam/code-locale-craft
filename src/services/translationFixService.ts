import { supabase } from '@/integrations/supabase/client';
import { AITranslationService } from './translationService';

export class TranslationFixService {
  /**
   * Re-processes existing "failed" translations to fix their status
   * based on improved logic that properly handles code strings
   */
  static async fixFailedTranslationStatuses(analysisId: string): Promise<{
    fixed: number;
    actualFailures: number;
    total: number;
  }> {
    console.log(`Starting to fix failed translation statuses for analysis ${analysisId}`);

    // Get all "failed" translations
    const { data: failedTranslations, error } = await supabase
      .from('translations')
      .select('*')
      .eq('analysis_id', analysisId)
      .eq('status', 'failed');

    if (error) {
      console.error('Error fetching failed translations:', error);
      throw error;
    }

    if (!failedTranslations || failedTranslations.length === 0) {
      console.log('No failed translations found');
      return { fixed: 0, actualFailures: 0, total: 0 };
    }

    console.log(`Found ${failedTranslations.length} failed translations to review`);

    let fixedCount = 0;
    let actualFailuresCount = 0;

    for (const translation of failedTranslations) {
      const { id, original_text, translated_text } = translation;
      
      // Check if this is actually a code string that was correctly not translated
      const isCodeString = AITranslationService.isCodeString?.(original_text) ?? false;
      
      if (isCodeString && translated_text === original_text) {
        // This is a code string that was correctly kept unchanged - mark as completed
        console.log(`Fixing code string status: \"${original_text.substring(0, 30)}...\"`);
        
        const { error: updateError } = await supabase
          .from('translations')
          .update({
            status: 'completed',
            quality_score: 1.0, // High quality since it's correctly not translated
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          console.error(`Error updating translation ${id}:`, updateError);
        } else {
          fixedCount++;
        }
      } else if (translated_text === original_text) {
        // Text unchanged but not a code string - could be technical content
        // that OpenAI correctly decided not to translate
        console.log(`Fixing unchanged technical text status: \"${original_text.substring(0, 30)}...\"`);
        
        const { error: updateError } = await supabase
          .from('translations')
          .update({
            status: 'completed',
            quality_score: 0.8, // Good quality since OpenAI chose not to translate
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          console.error(`Error updating translation ${id}:`, updateError);
        } else {
          fixedCount++;
        }
      } else {
        // This appears to be an actual translation failure
        actualFailuresCount++;
        console.log(`Actual failure detected: \"${original_text.substring(0, 30)}...\"`);
      }
    }

    console.log(`✅ Fixed ${fixedCount} incorrectly marked failed translations`);
    console.log(`❌ Found ${actualFailuresCount} actual translation failures`);
    
    return {
      fixed: fixedCount,
      actualFailures: actualFailuresCount,
      total: failedTranslations.length
    };
  }

  /**
   * Get statistics about translations for an analysis
   */
  static async getTranslationStats(analysisId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    avgQualityScore: number;
    codeStringsCount: number;
  }> {
    const { data: translations, error } = await supabase
      .from('translations')
      .select('*')
      .eq('analysis_id', analysisId);

    if (error) {
      throw error;
    }

    if (!translations) {
      return { total: 0, completed: 0, failed: 0, avgQualityScore: 0, codeStringsCount: 0 };
    }

    const completed = translations.filter(t => t.status === 'completed').length;
    const failed = translations.filter(t => t.status === 'failed').length;
    const codeStringsCount = translations.filter(t => 
      AITranslationService.isCodeString?.(t.original_text) ?? false
    ).length;
    
    const qualityScores = translations
      .filter(t => t.quality_score != null)
      .map(t => t.quality_score);
    
    const avgQualityScore = qualityScores.length > 0 
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

    return {
      total: translations.length,
      completed,
      failed,
      avgQualityScore: Math.round(avgQualityScore * 100) / 100,
      codeStringsCount
    };
  }
}
