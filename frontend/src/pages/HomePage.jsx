import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const features = [
  { icon: '🎹', title: 'Grand Piano Plans',   desc: 'Start striking the keys of wealth from ₹500 up to ₹25,000 with 2× returns.' },
  { icon: '🎶', title: 'Midnight Melodies',   desc: 'Guaranteed daily earnings credited to your wallet like clockwork every midnight.' },
  { icon: '🎼', title: 'Symphony of Profits', desc: 'Double your money with transparent 200% returns across 20 continuous days.' },
  { icon: '👑', title: 'VIP Maestro Plans',   desc: 'High-yield piano plans designed for serious investors with up to 3× returns.' },
  { icon: '🏦', title: 'Direct Bank Cashout', desc: 'Withdraw earnings seamlessly to your Bank Account or UPI (Min ₹500).' },
  { icon: '🎁', title: 'Duet Referral Bonus', desc: 'Invite friends to play along and earn lucrative bonus commission on signups.' },
];

const stats = [
  { value: '50K+',  label: 'Pianists'   },
  { value: '₹2.8Cr+', label: 'Disbursed' },
  { value: '20 Days', label: '2× Cycle'   },
  { value: '4.9★',  label: 'App Rating' },
];

const steps = [
  { step: '01', title: 'Tune Your Wallet',    desc: 'Deposit funds securely using UPI, Cards or Net Banking via Razorpay.', icon: '💳', color: '#6C63FF' },
  { step: '02', title: 'Select Piano Plan',   desc: 'Pick your piano key from ₹500 (Prelude) to ₹25,000 (Grand Royal).',  icon: '🎹', color: '#FF6584' },
  { step: '03', title: 'Daily Night Rhythm',  desc: 'Watch daily earnings flow directly into your wallet every midnight.', icon: '🎵', color: '#43D08A' },
  { step: '04', title: 'Cash Out to Bank',    desc: 'Withdraw your accumulated profit into your Bank or UPI account.',    icon: '🏦', color: '#F7B731' },
];

export default function HomePage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  return (
    <div className="min-h-screen bg-dark pb-28 overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div
        className="relative px-5 pt-12 pb-14 text-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0a192f 0%,#16213e 50%,#6C63FF22 100%)' }}
      >
        {/* Background ambient lights */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle,rgba(108,99,255,.25),transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="absolute bottom-0 left-0 w-52 h-52 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle,rgba(255,101,132,.15),transparent 70%)', transform: 'translate(-30%,30%)' }} />

        <div className="relative z-10">
          {/* Piano Icon Badge */}
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-3 flex items-center justify-center text-4xl"
            style={{ background: 'linear-gradient(135deg,#111 0%,#24243e 100%)', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 10px 30px rgba(0,0,0,.6)' }}
          >
            🎹
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-[11px] font-semibold text-primary mb-2">
            <span>🎵</span> SOUND INVESTMENTS · SWEET RETURNS
          </div>

          <h1 className="text-4xl font-black text-white tracking-tight">PianoWealth</h1>
          <p className="text-gray-300 text-sm mt-1.5">
            Welcome, Maestro <span className="font-bold text-yellow-300">{user?.name || user?.email?.split('@')[0]}</span>!
          </p>
          <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
            Where your capital plays harmonious melodies and earns guaranteed 2× daily profits.
          </p>

          <button
            onClick={() => navigate('/plans')}
            className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-primary to-purple-600 text-white text-sm font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-primary/30 hover:scale-105 transition-all"
          >
            <span>🎹</span> Explore Piano Plans
          </button>
        </div>
      </div>

      {/* ── Interactive Piano Key Banner ────────────────── */}
      <div className="mx-4 -mt-5 relative z-10">
        <div
          className="rounded-2xl p-2 flex justify-between items-center shadow-2xl border border-white/10"
          style={{ background: 'linear-gradient(180deg,#111827 0%,#030712 100%)' }}
        >
          {['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'].map((note, i) => (
            <div
              key={i}
              onClick={() => navigate('/plans')}
              className="flex-1 mx-0.5 py-3 rounded-lg text-center cursor-pointer transition-all hover:bg-primary/20 active:scale-95"
              style={{
                background: i % 2 === 0 ? '#ffffff' : '#f3f4f6',
                color: '#111827',
                boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)'
              }}
            >
              <span className="text-[10px] font-black">{note}</span>
              <p className="text-[8px] text-gray-500 font-medium">₹{(i + 1) * 500}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Floating Stats Card ────────────────────────── */}
      <div className="mx-4 mt-4">
        <div
          className="rounded-2xl p-4 grid grid-cols-4 divide-x divide-white/5"
          style={{ background: 'rgba(22,33,62,0.95)', border: '1px solid rgba(108,99,255,.2)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center px-1">
              <p className="text-primary font-extrabold text-sm">{s.value}</p>
              <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── About PianoWealth ─────────────────────────── */}
      <div className="mx-4 mt-6">
        <div
          className="rounded-2xl p-5 border border-white/5"
          style={{ background: 'linear-gradient(135deg,rgba(22,33,62,1),rgba(15,52,96,.6))' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎼</span>
            <h2 className="text-lg font-bold text-white">About PianoWealth</h2>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed">
            PianoWealth transforms personal investment into a synchronized symphony of wealth creation.
            Just like a masterfully tuned grand piano delivers acoustic perfection, our financial instruments
            are engineered to deliver <strong>exact 2× returns</strong> across 20-day cycles with automatic midnight wallet credits.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px] text-gray-300">
            <div className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> 100% Transparent Returns
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> Automated Midnight Payouts
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> Fast Bank / UPI Withdrawals
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> Verified Razorpay Gateway
            </div>
          </div>
        </div>
      </div>

      {/* ── How It Works (Piano Melodies) ─────────────── */}
      <div className="mx-4 mt-6">
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-primary block" />
          How The Melody Plays
        </h2>
        <div className="space-y-3">
          {steps.map((item) => (
            <div
              key={item.step}
              className="flex items-center gap-4 rounded-xl p-4 border border-white/5 hover:border-primary/30 transition-all"
              style={{ background: 'rgba(22,33,62,0.8)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}
              >
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
              </div>
              <div
                className="text-xs font-black"
                style={{ color: item.color }}
              >
                {item.step}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Why Choose Us ─────────────────────────────── */}
      <div className="mx-4 mt-6">
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-secondary block" />
          Harmonious Features
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-4 border border-white/5 hover:border-primary/30 transition-all"
              style={{ background: 'rgba(22,33,62,0.8)' }}
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="text-white font-semibold text-xs mt-2 mb-1">{f.title}</h3>
              <p className="text-gray-400 text-[11px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Call to Action ────────────────────────────── */}
      <div className="mx-4 mt-6 mb-4">
        <button
          onClick={() => navigate('/plans')}
          className="w-full rounded-2xl p-5 text-center border border-primary/40 hover:border-primary/70 transition-all"
          style={{ background: 'linear-gradient(135deg,rgba(108,99,255,.2),rgba(255,101,132,.1))' }}
        >
          <span className="text-3xl block mb-1">🎹</span>
          <p className="text-white font-bold text-base">Start Playing Your Piano Plan</p>
          <p className="text-gray-400 text-xs mt-1">Select from ₹500 up to ₹25,000 · 2× Returns Guaranteed</p>
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
