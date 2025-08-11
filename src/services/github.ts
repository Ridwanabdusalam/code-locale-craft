export interface GitHubFile {
  path: string;
  content: string;
  type: string;
}

export interface CreateBranchResponse {
  branchName: string;
  branchUrl: string;
  prUrl: string;
}

export class GitHubService {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token || '';
  }

  /**
   * Create a new instance using stored GitHub token
   */
  static async fromStoredToken(): Promise<GitHubService> {
    console.log('Creating GitHubService from stored token...');
    const { GitHubAuthService } = await import('./githubAuth');
    const token = await GitHubAuthService.getGitHubToken();
    console.log('Retrieved GitHub token:', { hasToken: !!token, tokenLength: token?.length });
    if (!token) {
      throw new Error('No GitHub token found. Please connect your GitHub account first.');
    }
    return new GitHubService(token);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log('Making GitHub API request:', { url, method: options.method || 'GET' });
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log('GitHub API response:', { status: response.status, url });

    if (!response.ok) {
      const error = await response.text();
      console.error('GitHub API error details:', { status: response.status, error, url });
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2].replace('.git', '') };
  }

  async createLocalizationBranch(
    repoUrl: string, 
    files: GitHubFile[],
    stringsFound?: number
  ): Promise<CreateBranchResponse> {
    console.log('Creating localization branch for repo:', repoUrl);
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    console.log('Parsed repo info:', { owner, repo });
    const branchName = `localization-${Date.now()}`;

    try {
      // Get the default branch reference
      console.log('Fetching repository info...');
      const defaultBranch = await this.request(`/repos/${owner}/${repo}`);
      const mainBranchRef = await this.request(`/repos/${owner}/${repo}/git/ref/heads/${defaultBranch.default_branch}`);
      
      // Create new branch
      await this.request(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: mainBranchRef.object.sha,
        }),
      });

      // Create/update files in the new branch
      for (const file of files) {
        // Use a robust method to encode UTF-8 content to base64
        const fileContent = btoa(
          new TextEncoder().encode(file.content).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        try {
          // Try to get existing file to check if it exists
          const existingFile = await this.request(`/repos/${owner}/${repo}/contents/${file.path}?ref=${branchName}`);
          
          // Update existing file - uses PUT method
          await this.request(`/repos/${owner}/${repo}/contents/${file.path}`, {
            method: 'PUT',
            body: JSON.stringify({
              message: `Update ${file.path} with localization`,
              content: fileContent,
              branch: branchName,
              sha: existingFile.sha,
            }),
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes('404')) {
            // File doesn't exist, create new file (GitHub API requires PUT)
            await this.request(`/repos/${owner}/${repo}/contents/${file.path}`, {
              method: 'PUT',
              body: JSON.stringify({
                message: `Add ${file.path} for localization`,
                content: fileContent,
                branch: branchName,
              }),
            });
          } else {
            // Re-throw other errors (e.g., auth, rate-limiting)
            throw error;
          }
        }
      }

      // Prepare PR summary metrics
      const extractedCount = (typeof stringsFound === 'number' && stringsFound > 0)
        ? stringsFound
        : (() => {
            try {
              const tf = files.find(f => f.type === 'translation');
              if (tf) {
                const parsed: any = JSON.parse(tf.content);
                const firstLang = Object.keys(parsed || {})[0];
                if (firstLang && parsed[firstLang] && typeof parsed[firstLang] === 'object') {
                  return Object.keys(parsed[firstLang]).length;
                }
                return Object.keys(parsed || {}).length;
              }
            } catch (e) {
              console.warn('Failed to infer strings count from translation file:', e);
            }
            return files.filter(f => f.type === 'translation').length;
          })();
          
          // Determine languages added from consolidated translations
          const languagesAdded = (() => {
            try {
              const consolidated = files.find(f => f.path.endsWith('translations.json'));
              if (consolidated) {
                const parsed: any = JSON.parse(consolidated.content);
                const langs = new Set<string>();
                Object.values(parsed || {}).forEach((val: any) => {
                  if (val && typeof val === 'object') {
                    Object.keys(val).forEach((lc) => {
                      if (lc) langs.add(lc);
                    });
                  }
                });
                if (langs.size > 0) {
                  return Array.from(langs).sort().map((lc) => `- ${lc}`).join('\n');
                }
              }
            } catch (e) {
              console.warn('Failed to infer languages from consolidated translations:', e);
            }
            // Fallback to locale files in files array
            const candidates = files
              .map(f => {
                const m = f.path.match(/\/locales\/([a-z-]+)\.json$/i);
                return m?.[1];
              })
              .filter(Boolean) as string[];
            if (candidates.length) {
              const set = new Set(candidates);
              return Array.from(set).sort().map(lc => `- ${lc}`).join('\n');
            }
            // Final fallback to listing translation file paths to avoid empty section
            return files
              .filter(f => f.type === 'translation')
              .map(f => `- ${f.path}`)
              .join('\n');
          })();
      // Create pull request
      const pullRequest = await this.request(`/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Add Internationalization (i18n) Support',
          head: branchName,
          base: defaultBranch.default_branch,
          body: `This PR adds internationalization support with the following changes:\n\n## 📋 Changes Included\n\n- **i18n Configuration**: Complete React i18next setup with language detection\n- **Translation Files**: Pre-generated translation files for selected languages\n- **String Extraction**: Extracted ${extractedCount} translatable strings from the codebase\n- **Setup Instructions**: README with step-by-step integration guide\n\n## 🌍 Languages Added\n\n${languagesAdded}\n\n## 🚀 Next Steps\n\n1. Review the generated files\n2. Install required dependencies: \`npm install react-i18next i18next i18next-browser-languagedetector\`\n3. Import the i18n configuration in your main application file\n4. Replace hardcoded strings with translation functions using \`useTranslation\` hook\n5. Test the application with different languages\n\n## 🔧 Generated by GitHub Localization Tool\n\nThis PR was automatically generated to help internationalize your application`,
        }),
      });

      return {
        branchName,
        branchUrl: `https://github.com/${owner}/${repo}/tree/${branchName}`,
        prUrl: pullRequest.html_url,
      };

    } catch (error) {
      console.error('Failed to create branch and PR:', error);
      throw new Error(`Failed to create localization branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkRepositoryPermissions(repoUrl: string): Promise<boolean> {
    try {
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      const repoData = await this.request(`/repos/${owner}/${repo}`);
      return repoData.permissions?.push === true;
    } catch (error) {
      console.error('Failed to check repository permissions:', error);
      return false;
    }
  }
}