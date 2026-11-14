import { supabase } from "./supabase";

const LOCAL_SNAPSHOT_KEY = "nova.device.snapshot.v1";

export type NovaDeviceSnapshot = {
  schemaVersion: 1;
  savedAt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  watchlistSymbols: string[];
  tasks: Array<{ id: number; title: string; done: boolean }>;
  preferences: Record<string, unknown>;
};

export async function readLocalSnapshot(): Promise<NovaDeviceSnapshot | null> {
  try {
    const raw = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovaDeviceSnapshot;
    if (parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLocalSnapshot(snapshot: NovaDeviceSnapshot): Promise<void> {
  localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

/**
 * Creates a Supabase anonymous identity silently when no device session exists.
 * This is not an email/password account, but it is an Auth user record used by RLS.
 */
export async function ensureDeviceIdentity() {
  if (!supabase) throw new Error("Supabase is not configured for this build.");

  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;
  if (current.data.session) return current.data.session;

  const created = await supabase.auth.signInAnonymously();
  if (created.error) throw created.error;
  if (!created.data.session) throw new Error("Supabase did not return a device session.");
  return created.data.session;
}

export async function readCloudSnapshot(): Promise<NovaDeviceSnapshot | null> {
  if (!supabase) return null;
  const session = await ensureDeviceIdentity();
  const { data, error } = await supabase
    .from("device_snapshots")
    .select("payload, updated_at")
    .eq("device_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.payload ? (data.payload as NovaDeviceSnapshot) : null;
}

export async function writeCloudSnapshot(snapshot: NovaDeviceSnapshot): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured for this build.");
  const session = await ensureDeviceIdentity();
  const { error } = await supabase.from("device_snapshots").upsert(
    {
      device_id: session.user.id,
      payload: snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" },
  );
  if (error) throw error;
}

/**
 * Local data is retained first. When cloud data is newer it is returned for
 * hydration; otherwise the local snapshot is uploaded.
 */
export async function syncDeviceSnapshot(
  localSnapshot: NovaDeviceSnapshot | null,
): Promise<NovaDeviceSnapshot | null> {
  if (!supabase) return localSnapshot;

  const session = await ensureDeviceIdentity();
  const { data, error } = await supabase
    .from("device_snapshots")
    .select("payload, updated_at")
    .eq("device_id", session.user.id)
    .maybeSingle();

  if (error) throw error;

  const cloudSnapshot = data?.payload as NovaDeviceSnapshot | undefined;
  const cloudTime = data?.updated_at ? Date.parse(data.updated_at) : 0;
  const localTime = localSnapshot?.savedAt ? Date.parse(localSnapshot.savedAt) : 0;

  if (cloudSnapshot && cloudTime > localTime) {
    await writeLocalSnapshot(cloudSnapshot);
    return cloudSnapshot;
  }

  if (localSnapshot) {
    await writeCloudSnapshot(localSnapshot);
    return localSnapshot;
  }

  return null;
}
