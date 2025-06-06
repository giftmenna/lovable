import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminTransactions from "./pages/AdminTransactions";
import AdminSettings from "./pages/AdminSettings";
import Dashboard from "./pages/user/Dashboard";
import TransactionHistory from "./pages/user/TransactionHistory";
import TransferMoney from "./pages/user/TransferMoney";
import ForexDemo from "./pages/ForexDemo";
import RetirementPost from "./pages/blog/RetirementPost";
import ForexPost from "./pages/blog/ForexPost";
import BudgetingPost from "./pages/blog/BudgetingPost";
import BudgetPlanner from "./pages/BudgetPlanner";
import LoanCalculator from "./pages/LoanCalculator";
import SavingsGoalCalculator from "./pages/SavingsGoalCalculator";
import AboutUsPage from "./pages/AboutUsPage";
import CookiePolicy from "./pages/CookiePolicy";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Contact from "./pages/Contact";
import Careers from "./pages/Careers";
import Press from "./pages/Press";
import Security from "./pages/Security";
import BankingWithPurpose from "./pages/BankingWithPurpose";
import SustainableAccounts from "./pages/SustainableAccounts";
import SustainabilityReport from "./pages/SustainabilityReport";
import GreenInvestments from "./pages/GreenInvestments";
import  Download  from "./pages/Download";



// Create QueryClient with configuration to prevent excessive refetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

// Protected route component
const ProtectedRoute = ({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) => {
  const { currentUser, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" />;
  }

  return children;
};

// App with routes wrapped in providers
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<Index />} />
      <Route path="/budget-planner" element={<BudgetPlanner />} />
      <Route path="/loan-calculator" element={<LoanCalculator />} />
      <Route path="/savings-goal-calculator" element={<SavingsGoalCalculator />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
      <Route path="/transfer" element={<ProtectedRoute><TransferMoney /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/transactions" element={<ProtectedRoute adminOnly><AdminTransactions /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
      <Route path="/forex/demo" element={<ForexDemo />} />
      <Route path="/blog/retirement" element={<RetirementPost />} />
      <Route path="/blog/forex" element={<ForexPost />} />
      <Route path="/blog/budgeting" element={<BudgetingPost />} />
      <Route path="/about" element={<AboutUsPage />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/careers" element={<Careers />} />
      <Route path="/press" element={<Press />} />
      <Route path="/security" element={<Security />} />
      <Route path="/banking-with-purpose" element={<BankingWithPurpose />} />
      <Route path="/sustainable-accounts" element={<SustainableAccounts />} />
      <Route path="/sustainability-report" element={<SustainabilityReport />} />
      <Route path="/green-investments" element={<GreenInvestments />} />
      <Route path="/download" element={<Download />} />
      
      {/* Add more routes as needed */}
      
      {/* Redirect to home if no match found */}
      {/* Add more routes as needed */}
      
      {/* Redirect to home if no match found */}
      {/* Catch-all route for 404 Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Main App component
const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;