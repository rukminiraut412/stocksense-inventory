import TeammatePlaceholder from "@/components/TeammatePlaceholder";

export default function MoveHistoryPage() {
  return (
    <TeammatePlaceholder
      title="Stock Ledger & Move History"
      moduleName="Move History & Audit Ledger"
      owner="Member 4"
      branch="feature/member-4"
      responsibilities={[
        "Immutable append-only stock transaction ledger",
        "Chronological tracking of all ins, outs, and internal transfers",
        "Full-text search and date/category filtering support",
        "Compliance and financial inventory value reporting",
      ]}
      plannedEndpoints={[
        "GET /api/v1/ledger",
        "GET /api/v1/ledger/moves",
        "GET /api/v1/ledger/export",
      ]}
    />
  );
}
