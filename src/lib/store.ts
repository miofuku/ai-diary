import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  birthData: {
    solar: string;
    lunar: {
      year: number;
      month: number;
      day: number;
    };
  } | null;
  setBirthData: (data: UserState['birthData']) => void;
}

export const useStore = create<UserState>()(
  persist(
    (set) => ({
      birthData: null,
      setBirthData: (data) => set({ birthData: data }),
    }),
    {
      name: 'lunar-calendar-storage',
    }
  )
)