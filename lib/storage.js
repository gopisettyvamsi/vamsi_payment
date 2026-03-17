import AsyncStorage from "@react-native-async-storage/async-storage";

export const getItem = async (key, defaultVal = null) => {
  try {
    const val = await AsyncStorage.getItem(key);
    return val !== null ? JSON.parse(val) : defaultVal;
  } catch { return defaultVal; }
};

export const setItem = async (key, val) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// Keys
export const KEYS = {
  CURRENCY: "settings_currency",
  BUDGET: "settings_budget",
  ONBOARDED: "settings_onboarded",
};
