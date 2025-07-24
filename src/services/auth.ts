import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { GitHubAuthService } from './githubAuth';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, {
        hasSession: !!session,
        hasProviderToken: !!session?.provider_token,
        provider: session?.user?.app_metadata?.provider,
        userId: session?.user?.id
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Process GitHub OAuth callback if provider token is available
      // Check if GitHub is either the primary provider or a linked provider
      const isGitHubAuth = session?.user?.app_metadata?.provider === 'github' || 
                          session?.user?.app_metadata?.providers?.includes('github') ||
                          session?.user?.identities?.some(identity => identity.provider === 'github');
      
      if (event === 'SIGNED_IN' && session?.provider_token && isGitHubAuth) {
        console.log('Processing GitHub callback with provider token');
        try {
          await GitHubAuthService.processGitHubCallback();
          console.log('GitHub callback processed successfully');
        } catch (error) {
          console.error('Error processing GitHub callback:', error);
        }
      } else if (event === 'SIGNED_IN' && isGitHubAuth) {
        console.log('GitHub sign-in detected but no provider token available');
      }
    });

    // Then check for existing session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, session, loading };
};
