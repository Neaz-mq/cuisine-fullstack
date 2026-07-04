import { getRestaurantSettings } from "@/lib/get-settings";
import SettingsForm from "./SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getRestaurantSettings();

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Control your restaurant&apos;s operating hours and timezone. These
        settings decide when customers see &quot;Kitchen available&quot; on
        the site.
      </p>
      <SettingsForm initialData={settings} />
    </div>
  );
}