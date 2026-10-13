import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PlansPage from './pages/PlansPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage';
import DisclaimerModal from './components/DisclaimerModal';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin' || user?.email === 'owner@solarwealth.com' || user?.email === 'shakirhusain2021@gmail.com';

  return (
    <>
      <DisclaimerModal />
      <Routes>
        <Route path="/" element={<Navigate to={!user ? '/login' : isOwner ? '/admin/withdrawals' : '/home'} replace />} />
        <Route path="/signup" element={user ? <Navigate to={isOwner ? '/admin/withdrawals' : '/home'} /> : <SignupPage />} />
        <Route path="/login" element={user ? <Navigate to={isOwner ? '/admin/withdrawals' : '/home'} /> : <LoginPage />} />
        
        {/* User-Only Routes: If Owner tries to access user UI, redirect them directly to Admin Console */}
        <Route path="/home" element={<PrivateRoute>{isOwner ? <Navigate to="/admin/withdrawals" replace /> : <HomePage />}</PrivateRoute>} />
        <Route path="/plans" element={<PrivateRoute>{isOwner ? <Navigate to="/admin/withdrawals" replace /> : <PlansPage />}</PrivateRoute>} />
        <Route path="/wallet" element={<PrivateRoute>{isOwner ? <Navigate to="/admin/withdrawals" replace /> : <WalletPage />}</PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute>{isOwner ? <Navigate to="/admin/withdrawals" replace /> : <ProfilePage />}</PrivateRoute>} />
        
        {/* Dedicated Owner Console */}
        <Route path="/admin/withdrawals" element={<PrivateRoute><AdminWithdrawalsPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
