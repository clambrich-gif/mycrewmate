import { useCallback, useEffect, useMemo, useState } from "react";

export type MyTasksPreferenceUser = {
  name?: string | null;
  role?: string | null;
} | null | undefined;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const MY_TASKS_DEFAULT_STORAGE_PREFIX =
  "mycrewmate:my-tasks-default:v1";

function normalizedIdentity(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Die Präferenz ist absichtlich an den bei der Anmeldung gewählten Namen und
 * die Rolle gebunden. Damit teilen sich zwei Administratoren an einem Gerät
 * nicht unbeabsichtigt dieselbe Standardansicht.
 */
export function myTasksDefaultStorageKey(user: MyTasksPreferenceUser) {
  const name = normalizedIdentity(user?.name);
  const role = normalizedIdentity(user?.role);
  if (!name || !role) return null;
  return `${MY_TASKS_DEFAULT_STORAGE_PREFIX}:${role}:${encodeURIComponent(name)}`;
}

export function readMyTasksDefaultPreference(
  user: MyTasksPreferenceUser,
  storage: StorageLike | null = browserStorage()
) {
  const key = myTasksDefaultStorageKey(user);
  if (!key || !storage) return false;
  try {
    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function writeMyTasksDefaultPreference(
  user: MyTasksPreferenceUser,
  enabled: boolean,
  storage: StorageLike | null = browserStorage()
) {
  const key = myTasksDefaultStorageKey(user);
  if (!key || !storage) return false;
  try {
    if (enabled) storage.setItem(key, "true");
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Speichert die persönliche Standardansicht lokal und lädt sie bei einem Identitätswechsel neu. */
export function useMyTasksDefault(user: MyTasksPreferenceUser) {
  const storageKey = useMemo(
    () => myTasksDefaultStorageKey(user),
    [user?.name, user?.role]
  );
  const [isDefaultMyTasks, setIsDefaultMyTasks] = useState(() =>
    readMyTasksDefaultPreference(user)
  );

  useEffect(() => {
    setIsDefaultMyTasks(readMyTasksDefaultPreference(user));
  }, [storageKey, user?.name, user?.role]);

  const setDefaultMyTasks = useCallback(
    (enabled: boolean) => {
      if (!storageKey) return;
      setIsDefaultMyTasks(enabled);
      writeMyTasksDefaultPreference(user, enabled);
    },
    [storageKey, user]
  );

  const toggleDefaultMyTasks = useCallback(
    () => setDefaultMyTasks(!isDefaultMyTasks),
    [isDefaultMyTasks, setDefaultMyTasks]
  );

  return {
    isDefaultMyTasks,
    setDefaultMyTasks,
    toggleDefaultMyTasks,
    canRememberMyTasksDefault: Boolean(storageKey),
  };
}
