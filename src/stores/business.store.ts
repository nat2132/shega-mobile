import { create } from 'zustand';

interface Business {
  id: string;
  name: string;
  description?: string;
}

interface BusinessState {
  business: Business | null;
  createBusiness: (data: { name: string; description?: string }) => void;
  getBusiness: () => Business | null;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  business: null,
  createBusiness: (data) => {
    const business: Business = {
      id: Date.now().toString(),
      name: data.name,
      description: data.description,
    };
    set({ business });
  },
  getBusiness: () => get().business,
}));