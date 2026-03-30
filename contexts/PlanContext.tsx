import { createContext, useContext, useState, ReactNode } from 'react';

export interface CalismaPlani {
  id: string;
  tarih: string;
  ders: string;
  konu: string;
  sure: string;
}

export interface PomodoroSeans {
  id: string;
  tarih: string;        // GG.AA.YYYY
  saat: string;         // SS:DD
  ders: string;
  konu: string;
  hedefDakika: number;
  tamamlananDakika: number;
  durum: 'tamamlandi' | 'erken_bitti';
  neden?: string;
}

interface PlanContextType {
  planlar: CalismaPlani[];
  planEkle: (plan: Omit<CalismaPlani, 'id'>) => void;
  planSil: (id: string) => void;
  seanslar: PomodoroSeans[];
  seansEkle: (seans: Omit<PomodoroSeans, 'id'>) => void;
}

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [planlar, setPlanlar] = useState<CalismaPlani[]>([]);
  const [seanslar, setSeanslar] = useState<PomodoroSeans[]>([]);

  function planEkle(plan: Omit<CalismaPlani, 'id'>) {
    setPlanlar((prev) => [{ id: Date.now().toString(), ...plan }, ...prev]);
  }

  function planSil(id: string) {
    setPlanlar((prev) => prev.filter((p) => p.id !== id));
  }

  function seansEkle(seans: Omit<PomodoroSeans, 'id'>) {
    setSeanslar((prev) => [{ id: Date.now().toString(), ...seans }, ...prev].slice(0, 200));
  }

  return (
    <PlanContext.Provider value={{ planlar, planEkle, planSil, seanslar, seansEkle }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlanlar() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlanlar must be used within PlanProvider');
  return ctx;
}
