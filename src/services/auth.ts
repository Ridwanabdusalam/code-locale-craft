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
      setSession(session);
      setUser(session?.user ?? null);
      
      // Process GitHub OAuth callback if provider token is available
      if (event === 'SIGNED_IN' && session?.provider_token && session?.user?.app_metadata?.provider === 'github') {
        try {
          await GitHubAuthService.processGitHubCallback();
        } catch (error) {
          console.error('Error processing GitHub callback:', error);
        }
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
