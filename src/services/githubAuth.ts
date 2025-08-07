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
    if (!user) {
      console.log('No authenticated user found');
      return null;
    }

    console.log('Fetching GitHub token for user:', user.id);

    const { data, error } = await supabase
      .from('github_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching GitHub token:', error);
      throw error;
    }

    console.log('GitHub token query result:', { hasToken: !!data?.access_token });
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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('GitHub OAuth callback session:', {
      hasSession: !!session,
      hasProviderToken: !!session?.provider_token,
      sessionError,
      provider: session?.user?.app_metadata?.provider,
      userId: session?.user?.id
    });
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return;
    }
    
    if (!session?.provider_token) {
      console.log('No provider token found in session - token might have expired or not been issued');
      return;
    }

    try {
      // Store the GitHub token
      console.log('Storing GitHub token with scopes: repo user');
      const tokenResult = await this.storeGitHubToken(
        session.provider_token,
        'repo user'
      );
      console.log('GitHub token storage result:', tokenResult);

      // Get GitHub user information and update profile
      if (session.user.user_metadata) {
        const metadata = session.user.user_metadata;
        console.log('Updating profile with GitHub metadata:', {
          github_id: metadata.provider_id,
          github_username: metadata.user_name,
          hasAvatar: !!metadata.avatar_url,
          hasFullName: !!metadata.full_name
        });
        
        const profileResult = await this.updateProfile({
          github_id: metadata.provider_id,
          github_username: metadata.user_name,
          github_avatar_url: metadata.avatar_url,
          full_name: metadata.full_name
        });
        console.log('Profile update result:', profileResult);
      } else {
        console.log('No user metadata found in session');
      }
    } catch (error) {
      console.error('Error in processGitHubCallback:', error);
      throw error;
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
    if (!user) throw new Error('User not authenticated');

    try {
      // Delete stored token
      const { error: tokenError } = await supabase
        .from('github_tokens')
        .delete()
        .eq('user_id', user.id);

      if (tokenError) {
        console.error('Error deleting GitHub token:', tokenError);
        throw new Error('Failed to delete GitHub token');
      }

      // Clear ALL GitHub info from profile including full_name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          github_id: null,
          github_username: null,
          github_avatar_url: null,
          full_name: null
        })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error clearing GitHub profile data:', profileError);
        throw new Error('Failed to clear GitHub profile data');
      }

      console.log('Successfully revoked GitHub access for user:', user.id);
    } catch (error) {
      console.error('Error in revokeGitHubAccess:', error);
      throw error;
    }
  }
}