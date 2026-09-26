import TeammatePlaceholder from "@/components/TeammatePlaceholder";

export default function TransfersPage() {
  return (
    <TeammatePlaceholder
      title="Internal Warehouse Transfers"
      moduleName="Internal Stock Transfers"
      owner="Member 3"
      branch="feature/member-3"
      responsibilities={[
        "Inter-bin, inter-bay, and inter-location stock relocations",
        "Transfer scheduling and status monitoring (scheduled, in_transit, completed)",
        "Source location stock decrement and destination increment",
        "Move history event emission",
      ]}
      plannedEndpoints={[
        "GET /api/v1/transfers",
        "POST /api/v1/transfers",
        "POST /api/v1/transfers/{id}/complete",
      ]}
    />
  );
}
