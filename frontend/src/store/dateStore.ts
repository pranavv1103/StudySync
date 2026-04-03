import { create } from 'zustand';
import { todayDateKey } from '../lib/dateKey';

function getTodayDateKey() {
  return todayDateKey();
}

type DateStore = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  resetToToday: () => void;
};

export const useDateStore = create<DateStore>((set) => ({
  selectedDate: getTodayDateKey(),
  setSelectedDate: (date: string) => set({ selectedDate: date }),
  resetToToday: () => set({ selectedDate: getTodayDateKey() }),
}));
