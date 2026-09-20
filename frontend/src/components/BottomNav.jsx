import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/home',    icon: '🏠', label: 'Home'    },
  { path: '/plans',   icon: '💰', label: 'Plans'   },
  { path: '/wallet',  icon: '👛', label: 'Wallet'  },
  { path: '/profile', icon: '👤', label: 'Profile' },
];

export default function BottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* glassmorphism bar */}
      <div
        className="mx-auto max-w-lg"
        style={{
          background: 'rgba(22, 33, 62, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(108, 99, 255, 0.2)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
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
                    style={{ background: 'rgba(108,99,255,0.15)' }}
                  />
                )}

                <span
                  className={`text-2xl transition-transform duration-200 ${
                    isActive ? 'scale-110' : 'scale-100'
                  }`}
                >
                  {item.icon}
                </span>

                <span
                  className={`text-[10px] font-bold tracking-wide transition-all duration-200 ${
                    isActive ? 'text-primary' : 'text-gray-500'
                  }`}
                >
                  {item.label}
                </span>

                {/* active dot */}
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
