"use client";

import { useState, useMemo } from "react";
import { UserCard } from "./UserCard";
import { GithubUser } from "../types";
import Image from "next/image";

interface GitHubTableProps {
  users: GithubUser[];
}

type SortKey =
  | "commitsPerDay"
  | "commitsPerWeek"
  | "weeklyCommits"
  | "monthlyCommits"
  | "totalCommits"
  | "avgCommitSize";

export default function GitHubTable({ users }: GitHubTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("commitsPerWeek"); // Default sort key
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const valueA = a.stats[sortKey];
      const valueB = b.stats[sortKey];

      return sortOrder === "asc" ? valueA - valueB : valueB - valueA;
    });
  }, [users, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const SortArrow = ({
    active,
    direction,
  }: {
    active: boolean;
    direction: "asc" | "desc";
  }) => (
    <span className="ml-1">
      {active ? (direction === "asc" ? "↑" : "↓") : ""}
    </span>
  );

  return (
    <div className="overflow-x-auto relative z-10">
      <table className="min-w-full bg-transparent">
        <thead>
          <tr className="border-b border-[#2C2C2C]/20">
            <th className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider">
              User
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider cursor-pointer hover:text-[#2C2C2C]/70"
              onClick={() => handleSort("commitsPerDay")}
            >
              Commits/Day
              <SortArrow
                active={sortKey === "commitsPerDay"}
                direction={sortOrder}
              />
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider cursor-pointer hover:text-[#2C2C2C]/70"
              onClick={() => handleSort("commitsPerWeek")}
            >
              Commits/Week
              <SortArrow
                active={sortKey === "commitsPerWeek"}
                direction={sortOrder}
              />
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider cursor-pointer hover:text-[#2C2C2C]/70"
              onClick={() => handleSort("weeklyCommits")}
            >
              Weekly Commits
              <SortArrow
                active={sortKey === "weeklyCommits"}
                direction={sortOrder}
              />
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider cursor-pointer hover:text-[#2C2C2C]/70"
              onClick={() => handleSort("monthlyCommits")}
            >
              Monthly Commits
              <SortArrow
                active={sortKey === "monthlyCommits"}
                direction={sortOrder}
              />
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider cursor-pointer hover:text-[#2C2C2C]/70"
              onClick={() => handleSort("totalCommits")}
            >
              Total Commits
              <SortArrow
                active={sortKey === "totalCommits"}
                direction={sortOrder}
              />
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider cursor-pointer hover:text-[#2C2C2C]/70"
              onClick={() => handleSort("avgCommitSize")}
            >
              Avg. Commit Size
              <SortArrow
                active={sortKey === "avgCommitSize"}
                direction={sortOrder}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[#2C2C2C] uppercase tracking-wider">
              Contribution Graph
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2C2C2C]/10">
          {sortedUsers.map((user) => (
            <tr
              key={user.username}
              className="hover:bg-black/5 transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <UserCard user={user} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C2C2C] font-mono">
                {user.stats.commitsPerDay}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C2C2C] font-mono">
                {user.stats.commitsPerWeek}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C2C2C] font-mono">
                {user.stats.weeklyCommits}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C2C2C] font-mono">
                {user.stats.monthlyCommits}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C2C2C] font-mono">
                {user.stats.totalCommits}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C2C2C] font-mono">
                {user.stats.avgCommitSize} LOC
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <Image
                  src={user.stats.contributionGraph}
                  alt={`${user.username} contribution graph`}
                  width={300}
                  height={100}
                  className="max-w-xs rounded shadow-sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
