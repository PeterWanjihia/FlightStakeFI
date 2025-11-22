// src/lib/api.js

// This points to your local Express server
const API_BASE_URL = 'http://localhost:4000/api'; 

export const api = {
  // Generic GET fetcher
  get: async (endpoint) => {
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      console.error('API Request Failed:', err);
      throw err;
    }
  },

  // Specific Endpoint Helpers
  getPortfolio: (address) => api.get(`/user/${address}/portfolio`),
  getListings: () => api.get('/market/listings'),
  getTicket: (id) => api.get(`/ticket/${id}`),
};