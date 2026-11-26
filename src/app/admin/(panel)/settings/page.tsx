import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { requireSuperAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { inboxEnabled } from "@/lib/inbox";
import SettingsForm from "./SettingsForm";
import InboxToggle from "./InboxToggle";

export const dynamic = "force-dynamic";

/** Super admin only — a sub admin opening this address is sent back to the dashboard. */
export default async function SettingsPage() {
  await requireSuperAdmin();
  return (
    <div className="space-y-4">
      <InboxToggle initial={await inboxEnabled(await db())} />
      <SettingsForm initial={await getSettings()} />
    </div>
  );
}
