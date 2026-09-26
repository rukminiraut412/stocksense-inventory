import TeammatePlaceholder from "@/components/TeammatePlaceholder";

export default function DeliveriesPage() {
  return (
    <TeammatePlaceholder
      title="Outbound Delivery Orders"
      moduleName="Delivery Orders & Shipping"
      owner="Member 3"
      branch="feature/member-3"
      responsibilities={[
        "Customer order fulfillment and dispatch tracking",
        "Picking list generation and status transitions",
        "Automatic stock decrement upon delivery dispatch",
        "Courier assignment and tracking ID logging",
      ]}
      plannedEndpoints={[
        "GET /api/v1/deliveries",
        "POST /api/v1/deliveries",
        "POST /api/v1/deliveries/{id}/dispatch (triggers stock decrease)",
      ]}
    />
  );
}
