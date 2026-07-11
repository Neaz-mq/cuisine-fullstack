"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.tableId && parsed?.tableLabel) {
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