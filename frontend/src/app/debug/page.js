'use client';

import { useMarket } from '@/hooks/useData';

export default function DebugPage() {
  // We try to fetch the marketplace listings
  const { data, isLoading, error } = useMarket();

  return (
    <div className="min-h-screen bg-black text-white p-10 font-mono">
      <h1 className="text-2xl text-blue-500 mb-5">🔌 API Connection Test</h1>
      
      <div className="mb-5">
        <p>Backend URL: http://localhost:4000/api</p>
        <p>Status: {isLoading ? "Loading..." : error ? "❌ Error" : "✅ Connected"}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-500 rounded text-red-200 mb-5">
          {error.message}
          <br />
          <span className="text-xs opacity-75">Make sure your backend server is running on port 4000!</span>
        </div>
      )}

      <div className="p-4 bg-gray-900 border border-gray-800 rounded overflow-auto">
        <pre className="text-xs text-green-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}