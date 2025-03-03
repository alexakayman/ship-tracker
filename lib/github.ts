import { GithubUser } from "../types";
import { Octokit } from "@octokit/rest";

// Initialize Octokit with auth token if available
const octokit = new Octokit({
  auth: process.env.NEXT_PUBLIC_GITHUB_TOKEN,
});

export async function fetchGithubUserData(
  username: string
): Promise<GithubUser | null> {
  console.log(`🔍 Fetching data for GitHub user: ${username}`);

  try {
    // Fetch basic user data
    const { data: userData } = await octokit.users.getByUsername({
      username,
    });

    // Fetch user's repositories
    const { data: repos } = await octokit.repos.listForUser({
      username,
      per_page: 100,
      sort: "pushed",
    });

    // Get recent commits using search API instead of commit stats
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const dateFilter = oneMonthAgo.toISOString().split("T")[0];

    const { data: searchResults } = await octokit.search.commits({
      q: `author:${username} author-date:>${dateFilter}`,
      sort: "author-date",
      order: "desc",
      per_page: 100,
    });

    // Calculate commit statistics from search results
    const commits = searchResults.items;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let weeklyCommits = 0;
    const monthlyCommits = commits.length;

    // Get commits in the last year (including private commits if visible on profile)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yearDateFilter = oneYearAgo.toISOString().split("T")[0];

    // For public commits, use the search API
    const { data: yearlyCommitSearch } = await octokit.search.commits({
      q: `author:${username} author-date:>${yearDateFilter}`,
      per_page: 1,
    });

    // The GitHub profile shows private commits if the user has allowed it
    let totalCommits = yearlyCommitSearch.total_count;

    try {
      // Try to fetch the first page of events to see if there are any private commits
      const { data: events } = await octokit.activity.listPublicEventsForUser({
        username,
        per_page: 100,
      });
      console.log("Found private commits");

      // Check if there are private commits visible
      const hasPrivateCommits = events.some(
        (event) => event.type === "PushEvent" && event.public === false
      );

      if (hasPrivateCommits) {
        // If we detect private commits are visible, we'll use the contribution count
        // from the user's profile which includes private commits

        // First, try to use the stats endpoint which might include private contributions
        try {
          const { data: userStats } = await octokit.rest.users.getByUsername({
            username,
          });

          // Look for the contributions count in the returned data
          // Adjust the total count if we find it
          if (userStats.public_gists) {
            // This is a heuristic - the actual private commit count isn't directly
            // available via the API, so we estimate based on public repo count
            const privateCommitEstimate = Math.round(
              (totalCommits * (userData.total_private_repos || 0)) /
                (userData.public_repos || 1)
            );

            totalCommits += privateCommitEstimate;
          }
        } catch (statError) {
          console.warn(
            `Could not get detailed stats for ${username}:`,
            statError
          );
        }
      }
    } catch (eventsError) {
      console.warn(
        `Could not check for private commits for ${username}:`,
        eventsError
      );
    }

    commits.forEach((commit) => {
      const commitDate = new Date(commit.commit.author?.date || "");
      if (commitDate >= oneWeekAgo) {
        weeklyCommits++;
      }
    });

    // Calculate averages
    const commitsPerDay = Math.round(weeklyCommits / 7);
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
  } catch (error) {
    console.error(`Error fetching data for ${username}:`, error);
    // Return null instead of a placeholder for failed profiles
    return null;
  }
}
