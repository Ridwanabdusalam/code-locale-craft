import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { GitHubAuthService, UserProfile } from '@/services/githubAuth';
import { supabase } from '@/integrations/supabase/client';

export default function GitHubProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Try to process GitHub callback if needed
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.provider_id && user?.app_metadata?.providers?.includes('github')) {
        // User has GitHub metadata but might be missing token, try to create profile
        await GitHubAuthService.updateProfile({
          github_id: user.user_metadata.provider_id,
          github_username: user.user_metadata.user_name,
          github_avatar_url: user.user_metadata.avatar_url,
          full_name: user.user_metadata.full_name
        });
      }

      const [profileData, tokenExists] = await Promise.all([
        GitHubAuthService.getUserProfile(),
        GitHubAuthService.hasValidGitHubToken()
      ]);
      
      setProfile(profileData);
      setHasToken(tokenExists);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          scopes: 'repo user',
          redirectTo: `${window.location.origin}/profile`
        }
      });
      
      if (error) {
        toast({
          title: 'Error connecting GitHub',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        // Reload profile after successful OAuth initiation
        setTimeout(() => {
          loadProfile();
        }, 1000);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect GitHub account',
        variant: 'destructive'
      });
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      await GitHubAuthService.revokeGitHubAccess();
      setProfile(null);
      setHasToken(false);
      toast({
        title: 'GitHub Disconnected',
        description: 'Your GitHub account has been disconnected'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect GitHub account',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile && profile.github_username ? (
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src={profile.github_avatar_url} alt={profile.github_username} />
              <AvatarFallback>
                {profile.github_username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-medium">@{profile.github_username}</p>
              {profile.full_name && (
                <p className="text-sm text-muted-foreground">{profile.full_name}</p>
              )}
              <div className="flex items-center space-x-2">
                <Badge variant={hasToken ? "default" : "secondary"}>
                  {hasToken ? "Connected" : "Token Missing"}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Connect your GitHub account to enable repository features
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Required permissions: repo access and user profile
            </p>
          </div>
        )}
        
        <div className="flex space-x-2">
          {profile && profile.github_username ? (
            <>
              {!hasToken && (
                <Button onClick={handleConnectGitHub} variant="outline">
                  Reconnect GitHub
                </Button>
              )}
              <Button onClick={handleDisconnectGitHub} variant="destructive">
                Disconnect GitHub
              </Button>
            </>
          ) : (
            <Button onClick={handleConnectGitHub}>
              Connect GitHub Account
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}