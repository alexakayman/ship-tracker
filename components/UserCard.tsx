"use client";

import { GithubUser } from "../types";
import Image from "next/image";

interface UserCardProps {
  user: GithubUser;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="flex items-center gap-4">
      <Image
        src={user.avatarUrl}
        alt={`${user.username} avatar`}
        width={40}
        height={40}
        className="rounded-full border-2 border-[#2C2C2C]/10"
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
