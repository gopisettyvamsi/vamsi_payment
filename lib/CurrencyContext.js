import { createContext, useContext, useState, useEffect } from "react";
import { getItem, setItem, KEYS } from "./storage";

const CurrencyContext = createContext({ currency: "INR", setCurrency: () => {} });

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState("INR");

  useEffect(() => { getItem(KEYS.CURRENCY, "INR").then(c => setCurrencyState(c)); }, []);

  const setCurrency = (c) => { setCurrencyState(c); setItem(KEYS.CURRENCY, c); };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);

export const fmtCurrency = (amount, currency = "INR") => {
  const locales = { INR: "en-IN", USD: "en-US", EUR: "de-DE" };
  return new Intl.NumberFormat(locales[currency] || "en-IN", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
};
