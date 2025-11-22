import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="flex flex-col items-center justify-center h-[80vh] text-center px-4">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Unlock Your Travel Capital.
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mb-8">
          Don't let your flight ticket be dead money. Stake it for yield, borrow against it for cash, or sell it instantly.
        </p>
      </div>
    </main>
  );
}