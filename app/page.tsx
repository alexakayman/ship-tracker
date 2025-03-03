"use client";

import { useState } from "react";
import UserInput from "../components/UserInput";
import GitHubTable from "../components/GitHubTable";
import { fetchGithubUserData } from "../lib/github";
import { GithubUser } from "../types";

export default function Home() {
  const [users, setUsers] = useState<GithubUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddUsers = async (usernames: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const uniqueUsernames = usernames.filter(
        (username) => !users.some((user) => user.username === username)
      );

      if (uniqueUsernames.length === 0) {
        setLoading(false);
        return;
      }

      const newUsersPromises = uniqueUsernames.map((username) =>
        fetchGithubUserData(username)
      );

      const newUsers = await Promise.all(newUsersPromises);

      setUsers((prevUsers) => [...prevUsers, ...newUsers]);
    } catch (err) {
      setError("Failed to fetch GitHub user data. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
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
                Loading user data...
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 overflow-hidden">
                {error}
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
