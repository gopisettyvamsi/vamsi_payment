import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offline_tx_queue";

export async function queueTransaction(txn) {
  const queue = await getQueuedTransactions();
  queue.push({ ...txn, queued_at: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueuedTransactions() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function isOnline() {
  try {
    await fetch("https://www.google.com/generate_204", {
      method: "HEAD",
      cache: "no-store",
    });
    return true;
  } catch {
    return false;
  }
}

export async function syncQueue(supabase, userId) {
  const queue = await getQueuedTransactions();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (const txn of queue) {
    const { queued_at, ...payload } = txn;
    const { error } = await supabase
      .from("transactions")
      .insert({ ...payload, user_id: userId });

    if (error) {
      remaining.push(txn);
      failed++;
    } else {
      synced++;
    }
  }

  if (remaining.length > 0) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } else {
    await clearQueue();
  }

  return { synced, failed };
}
