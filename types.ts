export interface GithubUser {
  username: string;
  avatarUrl: string;
  commitCount: number;
  pullRequests: number;
  repoCount: number;
  stats: {
    commitsPerDay: number;
    commitsPerWeek: number;
    weeklyCommits: number;
    monthlyCommits: number;
    totalCommits: number;
    avgCommitSize: number;
    contributionGraph: string; // URL or data for the graph
    topRepos: number;
  };
}
