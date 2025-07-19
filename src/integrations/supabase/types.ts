export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      code_transformations: {
        Row: {
          analysis_id: string
          created_at: string
          file_path: string
          hooks_added: string[] | null
          id: string
          imports_added: string[] | null
          original_code: string
          status: string | null
          transformations: Json
          transformed_code: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          file_path: string
          hooks_added?: string[] | null
          id?: string
          imports_added?: string[] | null
          original_code: string
          status?: string | null
          transformations?: Json
          transformed_code: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          file_path?: string
          hooks_added?: string[] | null
          id?: string
          imports_added?: string[] | null
          original_code?: string
          status?: string | null
          transformations?: Json
          transformed_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      extracted_strings: {
        Row: {
          analysis_id: string
          category: string | null
          component_name: string | null
          context: Json | null
          created_at: string
          file_path: string
          id: string
          line_number: number | null
          priority: number | null
          string_value: string
          translation_key: string | null
        }
        Insert: {
          analysis_id: string
          category?: string | null
          component_name?: string | null
          context?: Json | null
          created_at?: string
          file_path: string
          id?: string
          line_number?: number | null
          priority?: number | null
          string_value: string
          translation_key?: string | null
        }
        Update: {
          analysis_id?: string
          category?: string | null
          component_name?: string | null
          context?: Json | null
          created_at?: string
          file_path?: string
          id?: string
          line_number?: number | null
          priority?: number | null
          string_value?: string
          translation_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_strings_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "repository_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_analyses: {
        Row: {
          analysis_data: Json
          created_at: string
          error_message: string | null
          estimated_effort: string | null
          id: string
          localizable_files: number | null
          repository_name: string
          repository_owner: string
          repository_url: string
          status: string | null
          strings_found: number | null
          total_files: number | null
          transformation_status: string | null
          transformations_count: number | null
          transformed_files: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_data: Json
          created_at?: string
          error_message?: string | null
          estimated_effort?: string | null
          id?: string
          localizable_files?: number | null
          repository_name: string
          repository_owner: string
          repository_url: string
          status?: string | null
          strings_found?: number | null
          total_files?: number | null
          transformation_status?: string | null
          transformations_count?: number | null
          transformed_files?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_data?: Json
          created_at?: string
          error_message?: string | null
          estimated_effort?: string | null
          id?: string
          localizable_files?: number | null
          repository_name?: string
          repository_owner?: string
          repository_url?: string
          status?: string | null
          strings_found?: number | null
          total_files?: number | null
          transformation_status?: string | null
          transformations_count?: number | null
          transformed_files?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      translation_cache: {
        Row: {
          created_at: string
          id: string
          quality_score: number | null
          source_text: string
          target_language: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          quality_score?: number | null
          source_text: string
          target_language: string
          translated_text: string
        }
        Update: {
          created_at?: string
          id?: string
          quality_score?: number | null
          source_text?: string
          target_language?: string
          translated_text?: string
        }
        Relationships: []
      }
      translation_jobs: {
        Row: {
          analysis_id: string
          created_at: string
          error_message: string | null
          id: string
          options: Json | null
          processed_files: number
          processed_strings: number
          progress: number
          results: Json | null
          status: string
          target_languages: string[]
          total_files: number
          total_strings: number
          updated_at: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          options?: Json | null
          processed_files?: number
          processed_strings?: number
          progress?: number
          results?: Json | null
          status?: string
          target_languages: string[]
          total_files?: number
          total_strings?: number
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          options?: Json | null
          processed_files?: number
          processed_strings?: number
          progress?: number
          results?: Json | null
          status?: string
          target_languages?: string[]
          total_files?: number
          total_strings?: number
          updated_at?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          language_code: string
          original_text: string
          quality_score: number | null
          status: string | null
          translated_text: string
          translation_key: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          language_code: string
          original_text: string
          quality_score?: number | null
          status?: string | null
          translated_text: string
          translation_key: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          language_code?: string
          original_text?: string
          quality_score?: number | null
          status?: string | null
          translated_text?: string
          translation_key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
