import { GithubUser } from "../types";
import { Octokit } from "@octokit/rest";
import { executeWithRetry } from "./GitHubUtils";

const octokit = new Octokit({
  auth: process.env.NEXT_PUBLIC_GITHUB_TOKEN,
});

export class GitHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

export class RateLimitError extends GitHubError {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class UserNotFoundError extends GitHubError {
  constructor(username: string) {
    super(`GitHub user '${username}' not found`);
    this.name = "UserNotFoundError";
  }
}

export async function fetchGithubUserData(
  username: string
): Promise<GithubUser | { error: { message: string } }> {
  try {
    // Reuse octokit instance
    const octokit = new Octokit({
      auth: process.env.NEXT_PUBLIC_GITHUB_TOKEN,
    });

    // Fetch basic user info with rate limit protection
    const userData = await executeWithRetry(
      async () => {
        const { data } = await octokit.users.getByUsername({ username });
        return data;
      },
      `user-${username}`,
      60 * 60 * 1000 // Cache user data for 1 hour
    );

    // Fetch repositories with rate limit protection
    const repos = await executeWithRetry(
      async () => {
        const { data } = await octokit.repos.listForUser({
          username,
          sort: "updated",
          per_page: 100,
        });
        return data;
      },
      `repos-${username}`,
      30 * 60 * 1000 // Cache repos for 30 minutes
    );

    // Get total commit count using search API with rate limit protection
    let totalCommits = 0;
    try {
      const searchData = await executeWithRetry(
        async () => {
          const { data } = await octokit.search.commits({
            q: `author:${username}`,
            per_page: 1,
          });
          return data;
        },
        `total-commits-${username}`,
        30 * 60 * 1000 // Cache for 30 minutes
      );
      totalCommits = searchData.total_count;
    } catch (error) {
      console.warn(`Error fetching total commits for ${username}:`, error);
      totalCommits = 0;
    }

    // Sample commits from recent repos for size calculation
    let totalAdditions = 0;
    let totalDeletions = 0;
    let commitsWithStats = 0;

    for (const repo of repos.slice(0, 4)) {
      try {
        const commits = await executeWithRetry(
          async () => {
            const { data } = await octokit.repos.listCommits({
              owner: username,
              repo: repo.name,
              author: username,
              per_page: 10,
            });
            return data;
          },
          `commits-${username}-${repo.name}`,
          15 * 60 * 1000 // Cache for 15 minutes
        );

        // Get commit details with stats
        for (const commit of commits) {
          const commitData = await executeWithRetry(
            async () => {
              const { data } = await octokit.repos.getCommit({
                owner: username,
                repo: repo.name,
                ref: commit.sha,
              });
              return data;
            },
            `commit-${username}-${repo.name}-${commit.sha}`,
            60 * 60 * 1000 // Cache for 1 hour
          );

          // Only include commits that have actual changes in size calculation
          const stats = commitData.stats;
          if (
            stats?.additions !== undefined &&
            stats?.deletions !== undefined &&
            (stats.additions > 0 || stats.deletions > 0)
          ) {
            totalAdditions += stats.additions;
            totalDeletions += stats.deletions;
            commitsWithStats++;
          }
        }
      } catch (error) {
        // If we can't access this repo's commits, try the next one
        console.warn(`Error fetching commits for ${repo.name}:`, error);
        continue;
      }
    }

    // Calculate average size only from commits with stats
    const avgCommitSize =
      commitsWithStats > 0
        ? Math.round((totalAdditions + totalDeletions) / commitsWithStats)
        : 0;

    // Calculate commit frequencies based on total commits
    const monthlyCommits = Math.round(totalCommits / 12); // Average per month over a year
    const commitsPerDay = Math.round(monthlyCommits / 30); // Average per day in a month
    const commitsPerWeek = Math.round(monthlyCommits / 4); // Average per week in a month

    // Get pull requests count
    const pullRequests = await fetchUserPullRequests(username);

    return {
      username: userData.login,
      avatarUrl: userData.avatar_url,
      commitCount: totalCommits,
      pullRequests,
      repoCount: repos.length,
      stats: {
        commitsPerDay,
        commitsPerWeek,
        weeklyCommits: commitsPerWeek,
        monthlyCommits,
        totalCommits,
        avgCommitSize,
        contributionGraph: `https://ghchart.rshah.org/${username}`,
        topRepos: repos.length,
      },
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { error: { message: error.message } };
    }
    return { error: { message: "An unknown error occurred" } };
  }
}

export async function fetchUserPullRequests(username: string): Promise<number> {
  try {
    const pullRequestData = await executeWithRetry(
      async () => {
        const { data } = await octokit.search.issuesAndPullRequests({
          q: `author:${username} type:pr`,
          per_page: 1,
        });
        return data;
      },
      `pull-requests-${username}`,
      60 * 60 * 1000
    );

    return pullRequestData.total_count;
  } catch (error) {
    console.error(`Error fetching PR data for ${username}:`, error);
    return 0;
  }
}
