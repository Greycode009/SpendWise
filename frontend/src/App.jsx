import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import Splash from './components/Splash.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { DataProvider } from './hooks/useData.jsx';
import { useSession } from './hooks/useSession.js';
import { Login, Register } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AddEntry from './pages/AddEntry.jsx';
import Transactions from './pages/Transactions.jsx';
import TransactionDetail from './pages/TransactionDetail.jsx';
import People from './pages/People.jsx';
import PersonDetail from './pages/PersonDetail.jsx';
import LoanDetail from './pages/LoanDetail.jsx';
import LoanEdit from './pages/LoanEdit.jsx';
import Settings from './pages/Settings.jsx';
import Categories from './pages/Categories.jsx';
import SyncStatus from './pages/SyncStatus.jsx';
import NotFound from './pages/NotFound.jsx';

// Charts are the heaviest dependency — load the Insights screen on demand.
const Analytics = lazy(() => import('./pages/Analytics.jsx'));

function Protected() {
  const session = useSession();
  const location = useLocation();
  if (!session?.user) return <Navigate to="/login" replace state={{ from: location }} />;
  // key: switching accounts remounts everything with the other account's database.
  return (
    <DataProvider key={session.user.id} userId={session.user.id}>
      <AppLayout />
    </DataProvider>
  );
}

function GuestOnly({ children }) {
  const session = useSession();
  // An expired session may sign in again (reauth) without losing local data.
  if (session?.user && !session.expired) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route element={<Protected />}>
              <Route index element={<Dashboard />} />
              <Route path="add" element={<AddEntry />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="transactions/:id" element={<TransactionDetail />} />
              <Route path="people" element={<People />} />
              <Route path="people/:id" element={<PersonDetail />} />
              <Route path="loans/:id" element={<LoanDetail />} />
              <Route path="loans/:id/edit" element={<LoanEdit />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/categories" element={<Categories />} />
              <Route path="sync" element={<SyncStatus />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
