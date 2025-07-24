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
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
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
      github_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          scope: string
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          scope: string
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          scope?: string
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      image_metrics: {
        Row: {
          chromatic_aberration: number | null
          contrast_ratio: number | null
          created_at: string
          depth_map_quality: number | null
          dynamic_range: number | null
          edge_acutance: number | null
          exposure_level: number | null
          eye_tracking_accuracy: number | null
          flare_index: number | null
          focus_score: number | null
          id: string
          image_id: string
          motion_blur_score: number | null
          noise: number | null
          passthrough_alignment_error: number | null
          saturation_deviation: number | null
          sharpness: number | null
          white_balance_error: number | null
        }
        Insert: {
          chromatic_aberration?: number | null
          contrast_ratio?: number | null
          created_at?: string
          depth_map_quality?: number | null
          dynamic_range?: number | null
          edge_acutance?: number | null
          exposure_level?: number | null
          eye_tracking_accuracy?: number | null
          flare_index?: number | null
          focus_score?: number | null
          id?: string
          image_id: string
          motion_blur_score?: number | null
          noise?: number | null
          passthrough_alignment_error?: number | null
          saturation_deviation?: number | null
          sharpness?: number | null
          white_balance_error?: number | null
        }
        Update: {
          chromatic_aberration?: number | null
          contrast_ratio?: number | null
          created_at?: string
          depth_map_quality?: number | null
          dynamic_range?: number | null
          edge_acutance?: number | null
          exposure_level?: number | null
          eye_tracking_accuracy?: number | null
          flare_index?: number | null
          focus_score?: number | null
          id?: string
          image_id?: string
          motion_blur_score?: number | null
          noise?: number | null
          passthrough_alignment_error?: number | null
          saturation_deviation?: number | null
          sharpness?: number | null
          white_balance_error?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_metrics_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          camera_module_id: string
          camera_type: Database["public"]["Enums"]["camera_type"]
          capture_time: string
          created_at: string
          created_by: string
          id: string
          image_url: string
          lighting_condition: Database["public"]["Enums"]["lighting_condition"]
          notes: string | null
          perceptual_hash: string | null
          scene_type: Database["public"]["Enums"]["scene_type"]
          tags: string[] | null
          test_campaign: string
          updated_at: string
        }
        Insert: {
          camera_module_id: string
          camera_type: Database["public"]["Enums"]["camera_type"]
          capture_time: string
          created_at?: string
          created_by: string
          id?: string
          image_url: string
          lighting_condition: Database["public"]["Enums"]["lighting_condition"]
          notes?: string | null
          perceptual_hash?: string | null
          scene_type: Database["public"]["Enums"]["scene_type"]
          tags?: string[] | null
          test_campaign: string
          updated_at?: string
        }
        Update: {
          camera_module_id?: string
          camera_type?: Database["public"]["Enums"]["camera_type"]
          capture_time?: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string
          lighting_condition?: Database["public"]["Enums"]["lighting_condition"]
          notes?: string | null
          perceptual_hash?: string | null
          scene_type?: Database["public"]["Enums"]["scene_type"]
          tags?: string[] | null
          test_campaign?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          github_avatar_url: string | null
          github_id: string | null
          github_username: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          github_avatar_url?: string | null
          github_id?: string | null
          github_username?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          github_avatar_url?: string | null
          github_id?: string | null
          github_username?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      find_similar_images: {
        Args: { target_hash: string; similarity_threshold?: number }
        Returns: {
          id: string
          perceptual_hash: string
          similarity_score: number
          image_url: string
          camera_module_id: string
        }[]
      }
      mark_images_for_archival: {
        Args: { archive_before_date: string }
        Returns: {
          id: string
          image_url: string
          archive_status: string
        }[]
      }
      query_images_with_metrics: {
        Args: {
          p_camera_type?: string
          p_scene_type?: string
          p_test_campaign?: string
          p_lighting_condition?: string
          p_tags?: string[]
          p_capture_time_start?: string
          p_capture_time_end?: string
          p_sharpness_min?: number
          p_sharpness_max?: number
          p_noise_min?: number
          p_noise_max?: number
          p_flare_index_min?: number
          p_flare_index_max?: number
          p_motion_blur_score_min?: number
          p_motion_blur_score_max?: number
        }
        Returns: {
          id: string
          image_url: string
          camera_module_id: string
          camera_type_val: string
          test_campaign_val: string
          scene_type_val: string
          lighting_condition_val: string
          capture_time: string
          tags: string[]
          notes: string
          perceptual_hash: string
          created_by: string
          created_at: string
          updated_at: string
          metrics: Json
        }[]
      }
    }
    Enums: {
      camera_type:
        | "RGB"
        | "NIR"
        | "Depth"
        | "IR"
        | "Eye_Tracking"
        | "Passthrough"
        | "CV_Module"
        | "Multispectral"
        | "Stereo"
      lighting_condition:
        | "D65"
        | "tungsten"
        | "sunlight"
        | "fluorescent"
        | "LED"
        | "mixed_lighting"
        | "candlelight"
        | "monochromatic_IR"
        | "low_lux"
        | "HDR_lightbox"
      scene_type:
        | "indoor_lab"
        | "outdoor"
        | "darkroom"
        | "studio"
        | "dynamic_range_chart"
        | "motion_tracking_scene"
        | "calibration_rig"
        | "low_light"
        | "bright_backlight"
        | "natural_daylight"
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
    Enums: {
      camera_type: [
        "RGB",
        "NIR",
        "Depth",
        "IR",
        "Eye_Tracking",
        "Passthrough",
        "CV_Module",
        "Multispectral",
        "Stereo",
      ],
      lighting_condition: [
        "D65",
        "tungsten",
        "sunlight",
        "fluorescent",
        "LED",
        "mixed_lighting",
        "candlelight",
        "monochromatic_IR",
        "low_lux",
        "HDR_lightbox",
      ],
      scene_type: [
        "indoor_lab",
        "outdoor",
        "darkroom",
        "studio",
        "dynamic_range_chart",
        "motion_tracking_scene",
        "calibration_rig",
        "low_light",
        "bright_backlight",
        "natural_daylight",
      ],
    },
  },
} as const
