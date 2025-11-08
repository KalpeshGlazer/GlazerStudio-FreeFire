'use client';
import LiveScoring from '@/component/LiveScoring/LiveScoring';
import Login from '@/component/Login/Login';
import useAuthStore from '@/store/useAuthStore';


export default function Home() {
  const { authFlag, logout, email } = useAuthStore();

  // if (authFlag !== 1) {
  //   return <Login />;
  // }

  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <span className="text-sm text-white/70">{email}</span>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition"
        >
          Logout
        </button>
      </div>
      <LiveScoring />
    </div>
  );
}