import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getSuperAdmin } from "@/lib/session";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

/** Super admin only — a sub admin opening this address is sent back to the dashboard. */
export default async function SettingsPage() {
  if (!(await getSuperAdmin())) redirect("/admin");
  return <SettingsForm initial={await getSettings()} />;
}
