import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GitHubAuthService } from '@/services/githubAuth';
import { useToast } from '@/hooks/use-toast';
import { GitBranch, Star, Eye } from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  updated_at: string;
}

interface RepositorySelectorProps {
  onRepositorySelect: (repoUrl: string) => void;
  selectedRepo?: string;
}

export const RepositorySelector = ({ onRepositorySelect, selectedRepo }: RepositorySelectorProps) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const token = await GitHubAuthService.getGitHubToken();
      if (!token) {
        toast({
          title: "GitHub Token Required",
          description: "Please connect your GitHub account first.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const repos = await response.json();
      setRepositories(repos);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      toast({
        title: "Error",
        description: "Failed to fetch repositories. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Repositories...</CardTitle>
          <CardDescription>Fetching your GitHub repositories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleRepositorySelect = (repoUrl: string) => {
    onRepositorySelect(repoUrl);
  };

  const getRepositoryDisplayText = (repo: Repository) => {
    const badges = [];
    if (repo.private) badges.push('Private');
    if (repo.language) badges.push(repo.language);
    
    return `${repo.name}${badges.length > 0 ? ` (${badges.join(', ')})` : ''}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Select Repository
        </CardTitle>
        <CardDescription>
          Choose a repository to analyze for localization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleRepositorySelect} value={selectedRepo}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a repository to analyze..." />
          </SelectTrigger>
          <SelectContent className="max-h-96">
            {repositories.length === 0 ? (
              <SelectItem value="" disabled>
                No repositories found
              </SelectItem>
            ) : (
              repositories.map((repo) => (
                <SelectItem key={repo.id} value={repo.html_url}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{repo.name}</span>
                        <div className="flex items-center gap-1">
                          {repo.private && (
                            <Badge variant="secondary" className="text-xs">Private</Badge>
                          )}
                          {repo.language && (
                            <Badge variant="outline" className="text-xs">{repo.language}</Badge>
                          )}
                        </div>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repo.stargazers_count}
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {repo.watchers_count}
                        </div>
                        <span>Updated {formatDate(repo.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};