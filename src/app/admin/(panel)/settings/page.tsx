import { getSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return <SettingsForm initial={await getSettings()} />;
}
