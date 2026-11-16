import { AppShell } from "@/components/app-shell";
import { AddAssetForm } from "@/features/portfolio/add-asset-form";

export default function NewPortfolioAssetPage() {
  return <AppShell active="/carteira"><AddAssetForm /></AppShell>;
}
