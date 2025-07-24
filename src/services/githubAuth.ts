import { supabase } from '@/integrations/supabase/client';

export interface GitHubToken {
  id: string;
  user_id: string;
  access_token: string;
  token_type: string;
  scope: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  github_id?: string;
  github_username?: string;
  github_avatar_url?: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export class GitHubAuthService {
  /**
   * Store GitHub access token for the current user
   */
  static async storeGitHubToken(token: string, scope: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('github_tokens')
      .upsert({
        user_id: user.id,
        access_token: token,
        scope,
        token_type: 'bearer'
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
  }

  /**
   * Get the stored GitHub token for the current user
   */
  static async getGitHubToken(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('github_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.access_token || null;
  }

  /**
   * Get the user's profile including GitHub information
   */
  static async getUserProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Update user profile with GitHub information
   */
  static async updateProfile(profileData: Partial<UserProfile>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        ...profileData
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
  }

  /**
   * Process GitHub OAuth callback and store user data
   */
  static async processGitHubCallback(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.provider_token) return;

    // Store the GitHub token
    await this.storeGitHubToken(
      session.provider_token,
      'repo user' // The scopes we requested
    );

    // Get GitHub user information and update profile
    if (session.user.user_metadata) {
      const metadata = session.user.user_metadata;
      await this.updateProfile({
        github_id: metadata.provider_id,
        github_username: metadata.user_name,
        github_avatar_url: metadata.avatar_url,
        full_name: metadata.full_name
      });
    }
  }

  /**
   * Check if the current user has a valid GitHub token
   */
  static async hasValidGitHubToken(): Promise<boolean> {
    try {
      const token = await this.getGitHubToken();
      return !!token;
    } catch {
      return false;
    }
  }

  /**
   * Revoke GitHub access and clear stored data
   */
  static async revokeGitHubAccess(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete stored token
    await supabase
      .from('github_tokens')
      .delete()
      .eq('user_id', user.id);

    // Clear GitHub info from profile
    await supabase
      .from('profiles')
      .update({
        github_id: null,
        github_username: null,
        github_avatar_url: null
      })
      .eq('user_id', user.id);
  }
}