"use client";

import { useState } from "react";
import Papa from "papaparse";

interface UserInputProps {
  onAddUsers: (usernames: string[]) => void;
}

interface CSVRow {
  username?: string;
  [key: string]: string | undefined;
}

export default function UserInput({ onAddUsers }: UserInputProps) {
  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAddUser = () => {
    if (username.trim()) {
      console.log(`Adding single user: ${username.trim()}`);
      onAddUsers([username.trim()]);
      setUsername("");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log(`Processing CSV file: ${file.name}`);
    setIsLoading(true);

    Papa.parse<CSVRow>(file, {
      complete: (results) => {
        console.log("CSV parsing complete", results);
        const usernames: string[] = [];

        results.data.forEach((row, index) => {
          // Try to get username from a column named 'username' or from the first column
          const username = row.username || Object.values(row)[0];

          if (username && typeof username === "string" && username.trim()) {
            console.log(
              `Found valid username at row ${index + 1}: ${username.trim()}`
            );
            usernames.push(username.trim());
          } else {
            console.log(`Skipping invalid row ${index + 1}:`, row);
          }
        });

        console.log(`Found ${usernames.length} valid usernames:`, usernames);

        if (usernames.length > 0) {
          onAddUsers(usernames);
        } else {
          console.log("No valid usernames found in CSV");
        }

        setIsLoading(false);
        // Reset file input
        event.target.value = "";
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setIsLoading(false);
      },
      header: true, // Assumes CSV has headers
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
    });
  };

  return (
    <div className="relative z-10">
      <div className="p-4">
        <div className="flex mb-4 gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="GitHub username"
            className="flex-1 px-3 py-2 border border-[#2C2C2C]/20 rounded bg-white/50 text-[#2C2C2C] placeholder-[#2C2C2C]/50 font-serif"
          />

          <button
            onClick={handleAddUser}
            className="px-6 py-2 bg-[#FF5D0A] text-white rounded font-medium shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:bg-[#FF5D0A]/90 hover:shadow-[inset_0_-3px_4px_rgba(0,0,0,0.3)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all"
          >
            Add User
          </button>

          <label className="max-w-fit flex-1 px-6 py-2 bg-[#FF5D0A] text-white rounded font-medium shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:bg-[#FF5D0A]/90 hover:shadow-[inset_0_-3px_4px_rgba(0,0,0,0.3)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all cursor-pointer text-center">
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {isLoading && (
          <div className="mt-4 text-[#2C2C2C] font-serif">
            Processing CSV file...
          </div>
        )}
      </div>
    </div>
  );
}
