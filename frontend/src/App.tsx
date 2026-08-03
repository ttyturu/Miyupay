import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SendPage from './pages/SendPage';
import TransactionsPage from './pages/TransactionsPage';
import AuditPage from './pages/AuditPage';
import ConvertPage from './pages/ConvertPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="convert"      element={<ConvertPage />} />
        <Route path="send"         element={<SendPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="audit"        element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
