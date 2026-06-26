import { Routes, Route, Navigate } from 'react-router-dom';
import { UIProvider } from './contexts/UIContext';
import { AuthProvider } from './contexts/AuthContext';
import { useActivityTimeout } from './hooks/useActivityTimeout';
import Layout from './components/Layout';
import LockScreen from './components/LockScreen';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';

function ActivityWatcher() {
  useActivityTimeout();
  return null;
}

export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <LockScreen />
        <ActivityWatcher />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/inbox" replace />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/compose/:replyToId" element={<Compose />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </UIProvider>
  );
}
