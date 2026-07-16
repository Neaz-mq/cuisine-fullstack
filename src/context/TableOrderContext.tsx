"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ---------------------------------------------------------------------------
// QR Table Ordering — Table Context
//
// v1 scope (confirmed): "one scan → one order", no persistent running tab/
// session. sessionStorage (NOT localStorage) is used deliberately — it's
// wiped when the browser tab is closed, so a customer's phone doesn't keep
// remembering "Table T5" from a past visit if they open the site normally
// later. It also naturally isolates per-tab, so two people scanning
// different tables on the same phone in two tabs don't clobber each other.
//
// This only stores WHICH table the customer is at — it is NOT a live
// session tied to the DB. The actual Order row (orderType=DINE_IN,
// tableId) is only created once, at checkout, same as any other order.
// clearTable() is called right after a dine-in order is placed (see
// Carts.tsx) so a second order in the same tab doesn't silently reuse the
// same table without a fresh scan.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "dineInTable";

type TableOrderContextType = {
  tableId: string | null;
  tableLabel: string | null;
  isDineIn: boolean;
  setTable: (tableId: string, tableLabel: string) => void;
  clearTable: () => void;
};

const TableOrderContext = createContext<TableOrderContextType | undefined>(undefined);

export const TableOrderProvider = ({ children }: { children: ReactNode }) => {
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState<string | null>(null);

  useEffect(() => {
    // Same reasoning as CartContext: hydrated from sessionStorage in an
    // effect (not a lazy useState initializer) so the first client render
    // matches the server-rendered markup (no table) and only updates after
    // mount. Legitimate "synchronize with an external system" effect use,
    // not derived render state.
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.tableId && parsed?.tableLabel) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setTableId(parsed.tableId);
          setTableLabel(parsed.tableLabel);
        }
      }
    } catch {
      // corrupted/unavailable sessionStorage (e.g. private mode) — just
      // start with no table context, same as a normal (non-dine-in) visit
    }
  }, []);

  const setTable = (id: string, label: string) => {
    setTableId(id);
    setTableLabel(label);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tableId: id, tableLabel: label }));
    } catch {
      // sessionStorage unavailable — table context still works for this
      // render via React state, just won't survive a full page navigation
    }
  };

  const clearTable = () => {
    setTableId(null);
    setTableLabel(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <TableOrderContext.Provider
      value={{ tableId, tableLabel, isDineIn: !!tableId, setTable, clearTable }}
    >
      {children}
    </TableOrderContext.Provider>
  );
};

export const useTableOrder = () => {
  const context = useContext(TableOrderContext);
  if (!context) throw new Error("useTableOrder must be used within TableOrderProvider");
  return context;
};
