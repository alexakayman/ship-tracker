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
    const octokit = new Octokit();

    // Fetch basic user info
    const userResponse = await octokit.users.getByUsername({ username });
    const userData = userResponse.data;

    // Fetch repositories
    const reposResponse = await octokit.repos.listForUser({
      username,
      sort: "updated",
      per_page: 100,
    });

    const repos = reposResponse.data;

    // Get commit stats
    let totalCommits = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const repo of repos.slice(0, 5)) {
      try {
        const commitsResponse = await octokit.repos.listCommits({
          owner: username,
          repo: repo.name,
          author: username,
          per_page: 100,
        });

        totalCommits += commitsResponse.data.length;

        for (const commit of commitsResponse.data.slice(0, 10)) {
          const commitResponse = await octokit.repos.getCommit({
            owner: username,
            repo: repo.name,
            ref: commit.sha,
          });

          if (commitResponse.data.stats) {
            totalAdditions += commitResponse.data.stats.additions ?? 0;
            totalDeletions += commitResponse.data.stats.deletions ?? 0;
          }
        }
      } catch (error) {
        console.warn(`Error fetching commits for ${repo.name}:`, error);
        continue;
      }
    }

    const avgCommitSize =
      totalCommits > 0
        ? Math.round((totalAdditions + totalDeletions) / totalCommits)
        : 0;

    const commitsPerDay = Math.round(totalCommits / 30);
    const commitsPerWeek = Math.round(totalCommits / 4);

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
        monthlyCommits: totalCommits,
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
