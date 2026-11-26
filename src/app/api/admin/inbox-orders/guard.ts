import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad } from "@/lib/http";
import { inboxEnabled } from "@/lib/inbox";

/** Every Inbox Orders API goes through this: owner (super admin) only, and only while the feature is switched ON. Stored orders are never touched by the switch. */
export async function inboxGuard() {
  const me = await getSuperAdmin();
  if (!me) return { error: bad("Only the super admin can manage inbox orders", 403) } as const;
  const c = await db();
  if (!(await inboxEnabled(c))) return { error: bad("Inbox Orders is turned off in Settings", 403) } as const;
  return { me, c } as const;
}
