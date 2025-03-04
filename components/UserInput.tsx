"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";
import { toast } from "react-hot-toast";

interface UserInputProps {
  onAddUsers: (usernames: string[]) => Promise<{
    success: number;
    errors: number;
  }>;
  isBatchProcessing?: boolean;
}

interface CSVRow {
  username?: string;
  [key: string]: string | undefined;
}

export default function UserInput({
  onAddUsers,
  isBatchProcessing = false,
}: UserInputProps) {
  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUsernames, setCsvUsernames] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    processed: number;
    inProgress: boolean;
  }>({ total: 0, processed: 0, inProgress: false });

  const handleAddUser = async () => {
    if (username.trim()) {
      try {
        setIsLoading(true);
        console.log(`Adding single user: ${username.trim()}`);
        await onAddUsers([username.trim()]);
        setUsername("");
      } catch (error: unknown) {
        console.error("Error adding user:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast?.error(`Failed to add user: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Process CSV file when selected
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log(`CSV file selected: ${file.name}`);
    setCsvFile(file);
    setIsLoading(true);

    Papa.parse<CSVRow>(file, {
      complete: (results) => {
        console.log("CSV parsing complete", results);
        const extractedUsernames: string[] = [];
        const invalidRows: number[] = [];

        results.data.forEach((row, index) => {
          // Try to get username from a column named 'username' or from the first column
          const username = row.username || Object.values(row)[0];

          if (username && typeof username === "string" && username.trim()) {
            // Validate GitHub username format
            const trimmedUsername = username.trim();
            if (
              /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(trimmedUsername)
            ) {
              console.log(
                `Found valid username at row ${index + 1}: ${trimmedUsername}`
              );
              extractedUsernames.push(trimmedUsername);
            } else {
              console.log(
                `Invalid GitHub username format at row ${
                  index + 1
                }: ${trimmedUsername}`
              );
              invalidRows.push(index + 1);
            }
          } else {
            console.log(`Skipping empty row ${index + 1}:`, row);
            invalidRows.push(index + 1);
          }
        });

        // Report invalid rows if any
        if (invalidRows.length > 0) {
          const message =
            invalidRows.length === 1
              ? `Row ${invalidRows[0]} contains an invalid GitHub username and will be skipped.`
              : `${invalidRows.length} rows contain invalid GitHub usernames and will be skipped.`;
          toast(`⚠️ ${message}`, { icon: "⚠️" });
        }

        console.log(
          `Found ${extractedUsernames.length} valid usernames:`,
          extractedUsernames
        );

        if (extractedUsernames.length > 0) {
          setCsvUsernames(extractedUsernames);
          setUploadProgress({
            total: extractedUsernames.length,
            processed: 0,
            inProgress: false,
          });

          // If only a few users, process automatically
          if (extractedUsernames.length <= 5) {
            processCsvUsers(extractedUsernames);
          } else {
            // Otherwise, show confirmation for large batches
            setIsLoading(false);
            toast?.success(
              `CSV parsed with ${extractedUsernames.length} users. Click "Process CSV" to continue.`,
              { duration: 5000 }
            );
          }
        } else {
          setIsLoading(false);
          toast?.error("No valid GitHub usernames found in CSV");
          // Reset file input
          event.target.value = "";
          setCsvFile(null);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        toast?.error(`Error parsing CSV: ${error.message}`);
        setIsLoading(false);
        // Reset file input
        event.target.value = "";
        setCsvFile(null);
      },
      header: true, // Assumes CSV has headers
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
    });
  };

  // Function to process CSV users in batches
  const processCsvUsers = async (usernames: string[] = csvUsernames) => {
    if (!usernames.length) return;

    try {
      setIsLoading(true);
      setUploadProgress({
        total: usernames.length,
        processed: 0,
        inProgress: true,
      });

      // Start processing
      console.log(`Starting batch processing of ${usernames.length} users...`);
      const result = await onAddUsers(usernames);

      // Update progress when complete
      setUploadProgress((prev) => ({
        ...prev,
        processed: prev.total,
        inProgress: false,
      }));

      // Show completion message
      const successCount = result?.success || 0;

      if (successCount > 0) {
        toast?.success(
          `Successfully processed ${successCount} GitHub ${
            successCount === 1 ? "user" : "users"
          }`
        );
      }

      // Reset state
      setCsvFile(null);
      setCsvUsernames([]);
    } catch (error) {
      console.error("Error processing batch:", error);
      toast?.error("An error occurred during batch processing");
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel CSV processing
  const cancelCsvProcessing = () => {
    setCsvFile(null);
    setCsvUsernames([]);
    setUploadProgress({ total: 0, processed: 0, inProgress: false });
    toast("CSV processing cancelled", { icon: "ℹ️" });
  };

  // Track external batch processing state
  useEffect(() => {
    if (!isBatchProcessing && uploadProgress.inProgress) {
      // External processing completed
      setUploadProgress((prev) => ({
        ...prev,
        inProgress: false,
        processed: prev.total,
      }));
    }
  }, [isBatchProcessing, uploadProgress.inProgress]);

  const showCsvPreview = Boolean(csvFile && csvUsernames.length > 0);
  const isBusy = isLoading || isBatchProcessing || uploadProgress.inProgress;

  return (
    <div className="relative z-10">
      <div className="p-4">
        <div className="flex flex-col md:flex-row mb-4 gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="GitHub username"
            className="flex-1 px-3 py-2 border border-[#2C2C2C]/20 rounded bg-white/50 text-[#2C2C2C] placeholder-[#2C2C2C]/50 font-serif"
            disabled={isBusy || showCsvPreview}
          />

          <div className="flex gap-2">
            <button
              onClick={handleAddUser}
              disabled={isBusy || !username.trim() || showCsvPreview}
              className={`px-6 py-2 bg-[#FF5D0A] text-white rounded font-medium shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:bg-[#FF5D0A]/90 hover:shadow-[inset_0_-3px_4px_rgba(0,0,0,0.3)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all ${
                isBusy || !username.trim() || showCsvPreview
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {isLoading && !showCsvPreview ? "Adding..." : "Add User"}
            </button>

            <label
              className={`max-w-fit flex-1 px-6 py-2 bg-[#FF5D0A] text-white rounded font-medium shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:bg-[#FF5D0A]/90 hover:shadow-[inset_0_-3px_4px_rgba(0,0,0,0.3)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all ${
                isBusy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${showCsvPreview ? "hidden" : ""}`}
            >
              Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isBusy}
              />
            </label>
          </div>
        </div>

        {/* CSV Preview and Processing Controls */}
        {showCsvPreview && (
          <div className="mt-4 p-4 border border-[#2C2C2C]/20 rounded bg-white/70">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-[#2C2C2C]">
                {csvFile?.name} ({csvUsernames.length} users)
              </h3>
              <button
                onClick={cancelCsvProcessing}
                disabled={uploadProgress.inProgress}
                className="text-red-500 text-sm hover:text-red-700"
              >
                Cancel
              </button>
            </div>

            <div className="mb-3 max-h-24 overflow-y-auto text-sm">
              <div className="flex flex-wrap gap-1">
                {csvUsernames.slice(0, 20).map((name, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-100 rounded text-gray-800"
                  >
                    {name}
                  </span>
                ))}
                {csvUsernames.length > 20 && (
                  <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                    +{csvUsernames.length - 20} more
                  </span>
                )}
              </div>
            </div>

            {uploadProgress.inProgress ? (
              <div className="w-full">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-[#FF5D0A] h-2.5 rounded-full"
                    style={{
                      width: `${
                        (uploadProgress.processed / uploadProgress.total) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Processing users... This may take a while due to GitHub API
                  rate limits.
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => processCsvUsers()}
                  disabled={isBusy}
                  className={`px-6 py-2 bg-[#FF5D0A] text-white rounded font-medium shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:bg-[#FF5D0A]/90 hover:shadow-[inset_0_-3px_4px_rgba(0,0,0,0.3)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all ${
                    isBusy ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Process CSV
                </button>
                <button
                  onClick={cancelCsvProcessing}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {isBatchProcessing && !isLoading && !showCsvPreview && (
          <div className="mt-4 text-[#2C2C2C] font-serif">
            Processing GitHub users in the background... This may take several
            minutes due to API rate limits.
          </div>
        )}
      </div>
    </div>
  );
}
