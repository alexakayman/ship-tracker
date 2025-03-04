"use client";

import { useState } from "react";
import UserInput from "../components/UserInput";
import GitHubTable from "../components/GitHubTable";
import { fetchGithubUserData } from "../lib/github";
import { GithubUser } from "../types";
import { Toaster, toast } from "react-hot-toast";

export default function Home() {
  const [users, setUsers] = useState<GithubUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingInfo, setLoadingInfo] = useState<{ count: number }>({
    count: 0,
  });
  const [failedUsers, setFailedUsers] = useState<
    Array<{ username: string; error: string }>
  >([]);

  const handleAddUsers = async (usernames: string[]) => {
    if (usernames.length === 0) return { success: 0, errors: 0 };

    // Filter out duplicates
    const uniqueUsernames = usernames.filter(
      (username) =>
        !users.some((user) => user.username === username) &&
        !failedUsers.some((user) => user.username === username)
    );

    if (uniqueUsernames.length === 0) {
      toast.error(
        "These GitHub users have already been added or failed previously"
      );
      return { success: 0, errors: 0 };
    }

    // Set loading state with count info
    setLoading(true);
    setLoadingInfo({ count: uniqueUsernames.length });

    try {
      // Process users one at a time with delays to avoid rate limits
      const successfulUsers: GithubUser[] = [];
      const erroredUsers: Array<{ username: string; error: string }> = [];

      for (const username of uniqueUsernames) {
        try {
          const result = await fetchGithubUserData(username);

          // Check if the result is a successful user or an error
          if (result && "error" in result) {
            // This is an error result
            console.error(
              `Error fetching user ${username}:`,
              result.error.message
            );
            erroredUsers.push({
              username,
              error: result.error.message,
            });
          } else {
            // This is a successful user result
            successfulUsers.push(result as GithubUser);
          }

          // Add a small delay to avoid rate limits
          if (uniqueUsernames.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (err) {
          console.error(`Error processing user ${username}:`, err);
          erroredUsers.push({
            username,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      // Update users and failed users
      if (successfulUsers.length > 0) {
        setUsers((prevUsers) => [...prevUsers, ...successfulUsers]);
      }

      if (erroredUsers.length > 0) {
        setFailedUsers((prev) => [...prev, ...erroredUsers]);
      }

      // Show summary message
      if (successfulUsers.length > 0) {
        toast.success(
          `Successfully fetched ${successfulUsers.length} GitHub ${
            successfulUsers.length === 1 ? "user" : "users"
          }`
        );
      }

      if (erroredUsers.length > 0) {
        // Only show error toast if ALL users failed
        if (successfulUsers.length === 0) {
          toast.error(
            `Failed to fetch GitHub users. See the failed users section for details.`
          );
        } else {
          // Some succeeded, some failed - show a warning instead
          toast.error(
            `${erroredUsers.length} ${
              erroredUsers.length === 1 ? "user" : "users"
            } couldn't be processed. See details below.`
          );
        }
      }

      return {
        success: successfulUsers.length,
        errors: erroredUsers.length,
      };
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error(err);
      return { success: 0, errors: uniqueUsernames.length };
    } finally {
      setLoading(false);
      setLoadingInfo({ count: 0 });
    }
  };

  // Handle retrying a failed user
  const handleRetryUser = async (username: string) => {
    setFailedUsers((prev) => prev.filter((user) => user.username !== username));
    await handleAddUsers([username]);
  };

  return (
    <div className="min-h-screen relative">
      {/* Add the Toaster component to show toast notifications */}
      <Toaster position="top-right" />

      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="relative container mx-auto px-4 py-8 z-10 w-full flex flex-col gap-[300px]">
        <div className="mb-8 justify-center items-center">
          <h1 className="w-full text-center text-7xl text-[#E9E2C3] font-serif font-extrabold tracking-tight">
            Ship Tracker
          </h1>
        </div>

        <div className="relative flex flex-col p-8 rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-[#EDE6DE]" />
          <div className="absolute inset-0 bg-[url('/paper.jpg')] bg-cover bg-center opacity-20" />
          <div className="relative z-10">
            <UserInput onAddUsers={handleAddUsers} />

            {loading && (
              <div className="text-center py-4 text-[#2C2C2C]">
                <div className="flex justify-center items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#FF5D0A]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading GitHub data for {loadingInfo.count}{" "}
                  {loadingInfo.count === 1 ? "user" : "users"}... This may take
                  a moment due to API rate limits.
                </div>
              </div>
            )}

            {/* Failed Users Section */}
            {failedUsers.length > 0 && (
              <div className="mt-4 mb-6 bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">
                    Failed to load these GitHub users:
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {failedUsers.map(({ username, error }) => (
                      <div
                        key={username}
                        className="flex items-center justify-between p-2 bg-yellow-100 text-yellow-800 rounded text-sm"
                      >
                        <div className="truncate flex-1 mr-2">
                          <span className="font-medium">{username}</span>:{" "}
                          {error}
                        </div>
                        <div className="flex space-x-2 flex-shrink-0">
                          <button
                            onClick={() => handleRetryUser(username)}
                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                          >
                            Retry
                          </button>
                          <button
                            onClick={() =>
                              setFailedUsers((prev) =>
                                prev.filter(
                                  (user) => user.username !== username
                                )
                              )
                            }
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {users.length > 0 ? (
              <GitHubTable users={users} />
            ) : (
              <div className="text-center py-8 rounded-lg text-[#2C2C2C]">
                No users added yet. Add GitHub usernames to see the leaderboard.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
