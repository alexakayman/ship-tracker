export async function fetchGithubUserData(
  username: string
): Promise<GithubUser> {
  console.log(`🔍 Fetching data for GitHub user: ${username}`);
  // In a real implementation, you would use the GitHub API
  // This is a placeholder for the actual API call
  try {
    console.log(`📡 Making API request for user: ${username}`);
    const userResponse = await fetch(
      `https://api.github.com/users/${username}`
    );

    if (!userResponse.ok) {
      console.error(
        `❌ Failed to fetch data for ${username}: ${userResponse.statusText}`
      );
      throw new Error(`GitHub API error: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    console.log(`✅ Successfully fetched basic data for ${username}`);

    // For the commit data, you would need to use the GitHub API to fetch repositories
    // and then aggregate commit data. Since this is complex and would require multiple
    // API calls, this is just a simulation.

    // In a real implementation, you would:
    // 1. Fetch all user repositories
    // 2. For each repository, fetch commit history
    // 3. Aggregate and calculate statistics

    // Random stats for demo purposes
    const commitsPerWeek = Math.floor(Math.random() * 20) + 1;

    const userDataWithStats = {
      username,
      avatarUrl: userData.avatar_url,
      stats: {
        commitsPerDay: +(commitsPerWeek / 7).toFixed(2),
        commitsPerWeek,
        weeklyCommits: commitsPerWeek,
        monthlyCommits: commitsPerWeek * 4,
        totalCommits: commitsPerWeek * 52, // Rough estimate for a year
        contributionGraph: `https://ghchart.rshah.org/${username}`, // Uses an external service to render GitHub contribution graph
      },
    };

    console.log(`📊 Generated statistics for ${username}`);
    return userDataWithStats;
  } catch (error) {
    console.error(`❌ Error processing data for ${username}:`, error);
    throw error;
  }
}
