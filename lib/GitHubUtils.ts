import { Octokit } from "@octokit/rest";
import { GitHubError, RateLimitError } from "./github";

// Type for API request functions
type ApiRequestFunction<T> = () => Promise<T>;

// Cache to store responses and avoid duplicate requests
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const responseCache: Map<string, CacheEntry<any>> = new Map();

/**
 * Executes a GitHub API request with retry logic for rate limits
 * @param fn The API function to call
 * @param cacheKey Optional cache key to store and retrieve results
 * @param cacheDuration Time in milliseconds to cache results (default: 5 minutes)
 * @param maxRetries Maximum number of retries for rate limit errors
 * @param initialDelay Initial delay in ms before retrying
 */
export async function executeWithRetry<T>(
  fn: ApiRequestFunction<T>,
  cacheKey?: string,
  cacheDuration: number = 5 * 60 * 1000, // 5 minutes
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  // Check cache first if cacheKey provided
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && now < cached.expiresAt) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached.data;
    }
  }
  
  let retries = 0;
  let delay = initialDelay;
  
  while (true) {
    try {
      const result = await fn();
      
      if (cacheKey) {
        const now = Date.now();
        responseCache.set(cacheKey, {
          data: result,
          timestamp: now,
          expiresAt: now + cacheDuration
        });
      }
      
      return result;
    } catch (error: any) {
      // Handle rate limiting
      if (error.status === 403 && 
          error.response?.headers?.['x-ratelimit-remaining'] === '0') {
        
        if (retries >= maxRetries) {
          throw new RateLimitError();
        }
        
        const resetTime = error.response?.headers?.['x-ratelimit-reset'];
        const waitTime = resetTime 
          ? (parseInt(resetTime, 10) * 1000) - Date.now() + 1000 // Add 1s buffer
          : delay;
        
        console.warn(`Rate limited, retrying after ${waitTime}ms (attempt ${retries + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        delay *= 2;
        retries++;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Runs multiple API requests in parallel with rate limit consideration
 * @param requests Array of request functions to execute
 * @param batchSize Number of concurrent requests to make at once
 */
export async function executeInBatches<T>(
  requests: ApiRequestFunction<T>[],
  batchSize: number = 5
): Promise<Array<T | Error>> {
  const results: Array<T | Error> = [];
  
  // Process requests in batches to avoid rate limits
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(fn => executeWithRetry(fn))
    );
    
    // Process results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push(result.reason);
      }
    });
    
    // Add a small delay between batches
    if (i + batchSize < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Checks the current rate limit status
 * @param octokit Initialized Octokit instance
 */
export async function checkRateLimitStatus(octokit: Octokit): Promise<{
  remaining: number;
  limit: number;
  resetTime: Date;
}> {
  try {
    const { data } = await octokit.rateLimit.get();
    
    return {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      resetTime: new Date(data.rate.reset * 1000)
    };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    throw new GitHubError("Failed to check rate limit status");
  }
}

/**
 * Checks if a GitHub repository exists and is accessible
 */
export async function repositoryExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await octokit.repos.get({ owner, repo });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Gets commit counts for a user in a specific repository
 */
export async function getCommitCountForRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string
): Promise<number> {
  const cacheKey = `commits-${owner}-${repo}-${username}`;
  
  return executeWithRetry(
    async () => {
      // Use the search API to get a count quickly
      const { data } = await octokit.search.commits({
        q: `repo:${owner}/${repo} author:${username}`,
        per_page: 1
      });
      
      return data.total_count;
    },
    cacheKey,
    60 * 60 * 1000 // Cache for 1 hour
  );
}

/**
 * Gets detailed commit statistics for a user in a repository
 */
export async function getDetailedCommitStats(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string
): Promise<{
  totalCount: number;
  lastWeekCount: number;
  lastMonthCount: number;
}> {
  // Set up date filters