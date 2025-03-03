import { GithubUser } from "../types";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.NEXT_PUBLIC_GITHUB_TOKEN,
});

// Custom error types for better error handling
export class GitHubError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "GitHubError";
    this.statusCode = statusCode;
  }
}

export class UserNotFoundError extends GitHubError {
  constructor(username: string) {
    super(`GitHub user '${username}' not found`, 404);
    this.name = "UserNotFoundError";
  }
}

export class RateLimitError extends GitHubError {
  constructor() {
    super("GitHub API rate limit exceeded", 403);
    this.name = "RateLimitError";
  }
}

interface CommitActivity {
  weekly: number;
  monthly: number;
  total: number;
}

export async function fetchGithubUserData(
  username: string
): Promise<GithubUser | { error: GitHubError }> {
  console.log(`🔍 Fetching data for GitHub user: ${username}`);

  try {
    // Validate username
    if (
      !username ||
      !/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username)
    ) {
      return {
        error: new GitHubError(`Invalid GitHub username format: '${username}'`),
      };
    }

    // Step 1: Get basic user info
    let userData;
    try {
      const response = await octokit.users.getByUsername({ username });
      userData = response.data;
    } catch (error: any) {
      if (error.status === 404) {
        return { error: new UserNotFoundError(username) };
      } else if (
        error.status === 403 &&
        error.response?.headers?.["x-ratelimit-remaining"] === "0"
      ) {
        return { error: new RateLimitError() };
      } else {
        return {
          error: new GitHubError(
            `GitHub API error: ${error.message}`,
            error.status
          ),
        };
      }
    }

    // Step 2: Get user's repositories (up to 100)
    let repos = [];
    try {
      const { data: userRepos } = await octokit.repos.listForUser({
        username,
        per_page: 100,
        sort: "pushed", // Get most recently active repos first
      });
      repos = userRepos;
    } catch (error: any) {
      console.warn(`Error fetching repos for ${username}:`, error);
      // Continue with empty repos array
      repos = [];
    }

    // Step A: If we don't have many repos, we can use a different approach
    // to get accurate commit counts
    if (repos.length <= 5) {
      return await detailedAnalysis(username, userData, repos);
    }

    // Step B: Otherwise, use a more efficient approach for users with many repos
    return await efficientAnalysis(username, userData, repos);
  } catch (error: any) {
    console.error(`Error fetching data for ${username}:`, error);
    return {
      error: new GitHubError(
        `Unexpected error fetching data for ${username}: ${error.message}`
      ),
    };
  }
}

// For users with few repositories, we can do a thorough analysis
async function detailedAnalysis(username: string, userData: any, repos: any[]) {
  console.log(
    `Performing detailed analysis for ${username} with ${repos.length} repos`
  );

  // Set up date filters
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  let totalCommits = 0;
  let weeklyCommits = 0;
  let monthlyCommits = 0;

  // Process each repository with detailed commit analysis
  const commitActivities = await Promise.all(
    repos.map(async (repo): Promise<CommitActivity> => {
      const repoActivity = { weekly: 0, monthly: 0, total: 0 };

      try {
        // Get commits for this repo by the user
        let allCommits: any[] = [];
        let page = 1;
        let hasMoreCommits = true;

        while (hasMoreCommits) {
          try {
            const { data: commits } = await octokit.repos.listCommits({
              owner: repo.owner.login,
              repo: repo.name,
              author: username,
              per_page: 100,
              page: page,
            });

            if (commits.length === 0) {
              hasMoreCommits = false;
            } else {
              allCommits = [...allCommits, ...commits];
              page++;

              // Break after a reasonable number of pages to avoid excessive API calls
              if (page > 5) {
                hasMoreCommits = false;
              }
            }
          } catch (error) {
            console.warn(
              `Error fetching commits for ${repo.full_name} page ${page}:`,
              error
            );
            hasMoreCommits = false;
          }
        }

        // Calculate commit stats
        repoActivity.total = allCommits.length;

        // Count commits within time periods
        allCommits.forEach((commit) => {
          const commitDate = new Date(
            commit.commit.author?.date || commit.commit.committer?.date || ""
          );

          if (commitDate >= oneWeekAgo) {
            repoActivity.weekly++;
          }

          if (commitDate >= oneMonthAgo) {
            repoActivity.monthly++;
          }
        });
      } catch (error) {
        console.warn(`Error processing commits for ${repo.full_name}:`, error);
      }

      return repoActivity;
    })
  );

  // Sum up commit activities across all repos
  commitActivities.forEach((activity) => {
    totalCommits += activity.total;
    weeklyCommits += activity.weekly;
    monthlyCommits += activity.monthly;
  });

  // Calculate derived metrics
  const commitsPerDay = Math.round(monthlyCommits / 30);
  const commitsPerWeek = weeklyCommits;

  return {
    username,
    avatarUrl: userData.avatar_url,
    commitCount: totalCommits,
    pullRequests: userData.public_repos,
    repoCount: repos.length,
    stats: {
      commitsPerDay,
      commitsPerWeek,
      weeklyCommits,
      monthlyCommits,
      totalCommits,
      contributionGraph: `https://ghchart.rshah.org/${username}`,
    },
  };
}

// For users with many repositories, use a more efficient approach
async function efficientAnalysis(
  username: string,
  userData: any,
  repos: any[]
) {
  console.log(
    `Performing efficient analysis for ${username} with ${repos.length} repos`
  );

  // First try using the search API for a quick overall count
  let totalCommitCount = 0;
  let weeklyCommits = 0;
  let monthlyCommits = 0;

  try {
    // Set up date filters
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const weekFilter = oneWeekAgo.toISOString().split("T")[0];
    const monthFilter = oneMonthAgo.toISOString().split("T")[0];

    // Get total commits using search API
    const { data: yearlyData } = await octokit.search.commits({
      q: `author:${username}`,
      per_page: 1,
    });
    totalCommitCount = yearlyData.total_count;

    // Get monthly commits
    const { data: monthlyData } = await octokit.search.commits({
      q: `author:${username} author-date:>${monthFilter}`,
      per_page: 1,
    });
    monthlyCommits = monthlyData.total_count;

    // Get weekly commits
    const { data: weeklyData } = await octokit.search.commits({
      q: `author:${username} author-date:>${weekFilter}`,
      per_page: 1,
    });
    weeklyCommits = weeklyData.total_count;
  } catch (error) {
    console.warn(
      `Search API approach failed, falling back to sampling:`,
      error
    );

    // If search API fails, analyze a sample of most recently active repositories
    const sampleRepos = repos.slice(0, 10); // Take 10 most recently active repos

    // Process sample repositories
    const sampleResults = await Promise.all(
      sampleRepos.map(async (repo) => {
        try {
          const { data: participationStats } =
            await octokit.repos.getParticipationStats({
              owner: repo.owner.login,
              repo: repo.name,
            });

          // Repo participation stats gives weekly commit counts for the past year
          // Sum up recent weeks for weekly and monthly estimates
          const weeklyContributions =
            participationStats?.owner.slice(-1)[0] || 0;
          const monthlyContributions =
            participationStats?.owner
              .slice(-4)
              .reduce((sum, val) => sum + val, 0) || 0;

          // Estimate total contributions based on repo creation date
          const repoCreationDate = new Date(repo.created_at);
          const now = new Date();
          const repoAgeInWeeks = Math.ceil(
            (now.getTime() - repoCreationDate.getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          );

          // Get all available participation data or estimate based on recent activity
          const totalContributions =
            participationStats?.owner.reduce((sum, val) => sum + val, 0) ||
            Math.round(monthlyContributions * (repoAgeInWeeks / 4));

          return {
            weekly: weeklyContributions,
            monthly: monthlyContributions,
            total: totalContributions,
          };
        } catch (error) {
          console.warn(
            `Error getting participation stats for ${repo.full_name}:`,
            error
          );
          return { weekly: 0, monthly: 0, total: 0 };
        }
      })
    );

    // Sum up sample results
    sampleResults.forEach((result) => {
      weeklyCommits += result.weekly;
      monthlyCommits += result.monthly;
      totalCommitCount += result.total;
    });

    // Extrapolate to estimate for all repos
    if (sampleRepos.length > 0) {
      const extrapolationFactor = repos.length / sampleRepos.length;
      weeklyCommits = Math.round(weeklyCommits * extrapolationFactor);
      monthlyCommits = Math.round(monthlyCommits * extrapolationFactor);
      totalCommitCount = Math.round(totalCommitCount * extrapolationFactor);
    }
  }

  // Calculate derived metrics
  const commitsPerDay = Math.round(monthlyCommits / 30);
  const commitsPerWeek = weeklyCommits;

  return {
    username,
    avatarUrl: userData.avatar_url,
    commitCount: totalCommitCount,
    pullRequests: userData.public_repos,
    repoCount: repos.length,
    stats: {
      commitsPerDay,
      commitsPerWeek,
      weeklyCommits,
      monthlyCommits,
      totalCommits: totalCommitCount,
      contributionGraph: `https://ghchart.rshah.org/${username}`,
    },
  };
}

// Helper function to fetch pull requests count
export async function fetchUserPullRequests(username: string): Promise<number> {
  try {
    const { data: pullRequestData } =
      await octokit.search.issuesAndPullRequests({
        q: `author:${username} type:pr`,
        per_page: 1,
      });

    return pullRequestData.total_count;
  } catch (error) {
    console.error(`Error fetching PR data for ${username}:`, error);
    return 0;
  }
}
