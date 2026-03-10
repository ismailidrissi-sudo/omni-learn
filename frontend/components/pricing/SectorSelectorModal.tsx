"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type Sector = { id: string; name: string; icon: string };

interface SectorSelectorModalProps {
  open: boolean;
  onClose: () => void;
  sectors: readonly Sector[];
  onSelect: (sectorId: string) => void;
}

export function SectorSelectorModal({
  open,
  onClose,
  sectors,
  onSelect,
}: SectorSelectorModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Choose Your Sector
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Specialist plan gives you full access to one sector. Select the one that fits your focus.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {sectors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    selected === s.id
                      ? "border-brand-green bg-brand-green/10 dark:bg-brand-green/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfirm}
                disabled={!selected}
              >
                Continue
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
