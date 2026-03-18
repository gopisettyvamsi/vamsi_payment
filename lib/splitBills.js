import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "split_bills";

const load = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const save = async (bills) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
};

/** Return all split bills. */
export async function getSplitBills() {
  return load();
}

/**
 * Save a new split bill.
 * Bill shape: { id, title, totalAmount, paidBy,
 *   participants: [{ name, share, paid }], createdAt, settled }
 */
export async function saveSplitBill(bill) {
  const bills = await load();
  const newBill = {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    settled: false,
    ...bill,
  };
  bills.push(newBill);
  await save(bills);
  return newBill;
}

/** Update a bill by id with partial updates. */
export async function updateSplitBill(id, updates) {
  const bills = await load();
  const idx = bills.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  bills[idx] = { ...bills[idx], ...updates };
  await save(bills);
  return bills[idx];
}

/** Delete a bill by id. */
export async function deleteSplitBill(id) {
  const bills = await load();
  const filtered = bills.filter((b) => b.id !== id);
  await save(filtered);
  return filtered;
}

/** Mark a bill as settled. */
export async function settleBill(id) {
  return updateSplitBill(id, { settled: true });
}

/**
 * Calculate simplified balances across bills.
 * Returns [{ from, to, amount }, ...] showing who owes whom.
 */
export function calculateBalances(bills) {
  // Net balance per person: positive = is owed money, negative = owes money
  const net = {};

  for (const bill of bills) {
    if (bill.settled) continue;

    const payer = bill.paidBy;
    for (const p of bill.participants) {
      const owes = p.share - (p.paid || 0);
      if (owes === 0 || p.name === payer) continue;
      // p.name owes `owes` to payer
      net[p.name] = (net[p.name] || 0) - owes;
      net[payer] = (net[payer] || 0) + owes;
    }
  }

  // Simplify debts: split into creditors and debtors
  const creditors = []; // { name, amount }
  const debtors = [];

  for (const [name, balance] of Object.entries(net)) {
    if (balance > 0) creditors.push({ name, amount: balance });
    else if (balance < 0) debtors.push({ name, amount: -balance });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0) {
      result.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: Math.round(transfer * 100) / 100,
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return result;
}
