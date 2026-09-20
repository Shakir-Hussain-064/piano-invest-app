import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/home',    icon: '🏠', label: 'Home'    },
  { path: '/plans',   icon: '☀️', label: 'Plans'   },
  { path: '/wallet',  icon: '👛', label: 'Wallet'  },
  { path: '/profile', icon: '👤', label: 'Profile' },
];

export default function BottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Light glassmorphism bar */}
      <div
        className="mx-auto max-w-[480px]"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid #E2E8F0',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="flex justify-around items-center py-2 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-0.5 py-1.5 px-5 rounded-2xl transition-all duration-200 relative"
              >
                {/* active pill glow */}
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'rgba(234, 179, 8, 0.15)' }}
                  />
                )}

                <span
                  className={`text-2xl transition-transform duration-200 ${
                    isActive ? 'scale-110 drop-shadow' : 'opacity-60'
                  }`}
                >
                  {item.icon}
                </span>

                <span
                  className={`text-[11px] font-bold tracking-wide transition-colors duration-200 ${
                    isActive ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
