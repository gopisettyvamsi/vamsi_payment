import { Platform } from "react-native";
import { getCategoryById } from "./categories";

/**
 * Generates a CSV string from transactions.
 *
 * @param {Array} transactions
 * @returns {string} CSV content
 */
export function transactionsToCSV(transactions = []) {
  const header = "Date,Type,Amount,Category,Description,Source";
  const rows = transactions.map((t) => {
    const date = new Date(t.date).toISOString().split("T")[0];
    const cat = getCategoryById(t.category || "other");
    const desc = `"${(t.description || "").replace(/"/g, '""')}"`;
    return `${date},${t.type},${t.amount},${cat.label},${desc},${t.source || "manual"}`;
  });
  return [header, ...rows].join("\n");
}

/**
 * Opens Google Sheets with pre-filled data via a data URI or share sheet.
 *
 * Strategy:
 * - Web: Creates a downloadable CSV and opens Google Sheets import URL.
 * - Native: Uses expo-sharing to share the CSV file which can be opened in Sheets.
 *
 * @param {Array}  transactions
 * @param {string} fileName
 */
export async function exportToGoogleSheets(transactions = [], fileName = "Vamsify_Transactions") {
  const csv = transactionsToCSV(transactions);
  const fullName = `${fileName}.csv`;

  if (Platform.OS === "web") {
    // Download CSV and open Google Sheets import page
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fullName;
    a.click();
    URL.revokeObjectURL(url);

    // Open Google Sheets - user can import the downloaded file
    window.open("https://sheets.google.com", "_blank");
    return { success: true, method: "download" };
  }

  // Native: write CSV to file and share
  try {
    const FileSystem = await import("expo-file-system");
    const Sharing = await import("expo-sharing");

    const fileUri = FileSystem.cacheDirectory + fullName;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export to Google Sheets",
      });
      return { success: true, method: "share" };
    }

    return { success: false, error: "Sharing not available" };
  } catch (error) {
    console.error("Google Sheets export error:", error);
    return { success: false, error: error.message };
  }
}
