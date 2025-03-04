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

type CachedResponseData = string | number | boolean | object | null;

const responseCache: Map<string, CacheEntry<CachedResponseData>> = new Map();

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

interface GitHubErrorResponse {
  message: string;
  documentation_url?: string;
}

interface GitHubApiError {
  status: number;
  response?: {
    headers: {
      "x-ratelimit-remaining": string;
      "x-ratelimit-reset": string;
    };
  };
}

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
      return cached.data as T;
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
          data: result as CachedResponseData,
          timestamp: now,
          expiresAt: now + cacheDuration,
        });
      }

      return result;
    } catch (error: unknown) {
      // Handle rate limiting
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error as GitHubApiError).status === 403 &&
        "response" in error &&
        (error as GitHubApiError).response?.headers["x-ratelimit-remaining"] ===
          "0"
      ) {
        if (retries >= maxRetries) {
          throw new RateLimitError("GitHub API rate limit exceeded");
        }

        const resetTime = (error as GitHubApiError).response?.headers[
          "x-ratelimit-reset"
        ];
        if (!resetTime) {
          // If no reset time, use exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          // Wait until rate limit resets plus 1 second buffer
          const waitTime = Math.max(
            parseInt(resetTime, 10) * 1000 - Date.now() + 1000,
            1000
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        retries++;
        continue;
      }
      throw error;
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

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map((fn) => executeWithRetry(fn))
    );

    batchResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push(result.reason);
      }
    });

    if (i + batchSize < requests.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
      resetTime: new Date(data.rate.reset * 1000),
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
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
        per_page: 1,
      });

      return data.total_count;
    },
    cacheKey,
    60 * 60 * 1000 // Cache for 1 hour
  );
}

export async function fetchWithRateLimit<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Accept: "application/vnd.github.v3+json",
    },
  });

  const data = (await response.json()) as T;
  return {
    data,
    status: response.status,
    headers: response.headers,
  };
}

export function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || !error) return false;

  const err = error as GitHubErrorResponse;
  return err.message?.includes("API rate limit exceeded");
}

export function calculateAverageCommitSize(
  additions: number[],
  deletions: number[]
): number {
  if (additions.length === 0 || deletions.length === 0) return 0;

  const totalChanges =
    additions.reduce((sum, val) => sum + val, 0) +
    deletions.reduce((sum, val) => sum + val, 0);
  return Math.round(totalChanges / additions.length);
}

export function processGitHubError(error: unknown): {
  error: { message: string };
} {
  if (error instanceof Error) {
    return { error: { message: error.message } };
  }
  if (typeof error === "object" && error && "message" in error) {
    return {
      error: { message: String((error as { message: unknown }).message) },
    };
  }
  return { error: { message: "An unknown error occurred" } };
}
