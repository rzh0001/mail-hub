import { Routes, Route, Navigate } from 'react-router-dom';
import { UIProvider } from './contexts/UIContext';
import Layout from './components/Layout';
import Inbox from './pages/Inbox';
import Compose from './pages/Compose';
import Accounts from './pages/Accounts';

export default function App() {
  return (
    <UIProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/compose/:replyToId" element={<Compose />} />
          <Route path="/accounts" element={<Accounts />} />
        </Route>
      </Routes>
    </UIProvider>
  );
}
