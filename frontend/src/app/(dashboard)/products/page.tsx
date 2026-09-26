import TeammatePlaceholder from "@/components/TeammatePlaceholder";

export default function ProductsPage() {
  return (
    <TeammatePlaceholder
      title="Products Management"
      moduleName="Products & SKU Catalog"
      owner="Member 2"
      branch="feature/member-2"
      responsibilities={[
        "Product SKU catalog creation and maintenance",
        "Product categories, barcodes, and units of measure",
        "On-hand stock levels tracking",
        "Integration into StockSense shared database Base",
      ]}
      plannedEndpoints={[
        "GET /api/v1/products",
        "POST /api/v1/products",
        "GET /api/v1/products/{id}",
      ]}
    />
  );
}
