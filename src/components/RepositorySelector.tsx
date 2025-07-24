import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GitHubAuthService } from '@/services/githubAuth';
import { useToast } from '@/hooks/use-toast';
import { Search, GitBranch, Star, Eye } from 'lucide-react';

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
  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repositories);
    }
  }, [searchTerm, repositories]);

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
      setFilteredRepos(repos);
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
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredRepos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No repositories match your search.' : 'No repositories found.'}
            </div>
          ) : (
            filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                  selectedRepo === repo.html_url ? 'border-primary bg-accent' : 'border-border'
                }`}
                onClick={() => onRepositorySelect(repo.html_url)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{repo.name}</h3>
                      {repo.private && (
                        <Badge variant="secondary" className="text-xs">Private</Badge>
                      )}
                      {repo.language && (
                        <Badge variant="outline" className="text-xs">{repo.language}</Badge>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground mb-2">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};