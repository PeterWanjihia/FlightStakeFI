// src/hooks/useData.js
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Hook to fetch a user's portfolio
export function usePortfolio(address) {
  return useQuery({
    queryKey: ['portfolio', address], // Unique cache key
    queryFn: () => api.getPortfolio(address),
    enabled: !!address, // Only run if address exists
    refetchInterval: 5000, // Poll every 5 seconds (The "Real-Time" trick)
  });
}

// Hook to fetch the marketplace listings
export function useMarket() {
  return useQuery({
    queryKey: ['listings'],
    queryFn: () => api.getListings(),
    refetchInterval: 5000,
  });
}

// Hook to fetch a single ticket's details
export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicket(id),
    enabled: !!id,
    refetchInterval: 5000,
  });
}