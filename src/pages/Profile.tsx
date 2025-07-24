import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { RepositoryAnalysisService } from '@/services/database';
import GitHubProfile from '@/components/GitHubProfile';

export default function Profile() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (user) {
        try {
          const userAnalyses = await RepositoryAnalysisService.getUserAnalyses();
          setAnalyses(userAnalyses);
        } catch (error) {
          toast({ title: 'Error fetching analyses', description: error.message, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchAnalyses();
  }, [user, toast]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: 'Error logging out', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Logged out successfully!' });
      navigate('/login');
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <Button onClick={handleLogout} variant="outline">Log out</Button>
      </div>
      <p className="mb-8 text-lg">Welcome, {user?.email}</p>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <GitHubProfile />
        </div>
        
        <div>
          <h2 className="text-xl font-bold mb-4">Localization History</h2>
          {loading ? (
            <p>Loading history...</p>
          ) : analyses.length === 0 ? (
            <p className="text-muted-foreground">No localization history found.</p>
          ) : (
            <div className="space-y-4">
              {analyses.map((analysis) => (
                <div key={analysis.id} className="border rounded-lg p-4">
                  <h3 className="font-bold">{analysis.repository_name}</h3>
                  <p className="text-sm text-muted-foreground">{analysis.repository_url}</p>
                  <p className="text-sm">Status: {analysis.status}</p>
                  <p className="text-sm">Strings Found: {analysis.strings_found}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
