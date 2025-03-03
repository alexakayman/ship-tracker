"use client";

import { GithubUser } from "../types";

interface UserCardProps {
  user: GithubUser;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="flex items-center gap-4">
      <img
        src={user.avatarUrl}
        alt={`${user.username} avatar`}
        className="w-10 h-10 rounded-full border-2 border-[#2C2C2C]/10"
      />
      <div className="flex flex-col gap-1">
        <a
          href={`https://github.com/${user.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#FF5D0A] hover:text-[#FF5D0A]/80 font-serif transition-colors"
        >
          {user.username}
        </a>
      </div>
    </div>
  );
}
