import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { AppLayout } from './components/layout/AppLayout.js';

// Pages
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { LawyerLoginPage } from './pages/LawyerLoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { DocumentSummaryPage } from './pages/DocumentSummaryPage.js';
import { DocumentOcrPreviewPage } from './pages/DocumentOcrPreviewPage.js';
import { DocumentClausesPage } from './pages/DocumentClausesPage.js';
import { DocumentChatPage } from './pages/DocumentChatPage.js';
import { DocumentCompletenessPage } from './pages/DocumentCompletenessPage.js';
import { DocumentObligationsPage } from './pages/DocumentObligationsPage.js';
import { DocumentGeneratorPage } from './pages/DocumentGeneratorPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { DocumentCompliancePage } from './pages/DocumentCompliancePage.js';
import { DocumentComparePage } from './pages/DocumentComparePage.js';
import { EvaluationPage } from './pages/EvaluationPage.js';
// Legal Buddy Connect
import { RequireRole } from './components/connect/RequireRole.js';
import { FindLawyerPage } from './pages/connect/FindLawyerPage.js';
import { LawyerProfilePage } from './pages/connect/LawyerProfilePage.js';
import { MyConsultationsPage } from './pages/connect/MyConsultationsPage.js';
import { LawyerRegisterPage } from './pages/connect/LawyerRegisterPage.js';
import { LawyerDashboardPage } from './pages/connect/LawyerDashboardPage.js';
import { AdminConnectPage } from './pages/connect/AdminConnectPage.js';
import { AdminLawyerReviewPage } from './pages/connect/AdminLawyerReviewPage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9]">
        <div className="h-8 w-8 animate-spin border-3 border-[#0a0a0a] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/lawyer-login" element={<LawyerLoginPage />} />
            <Route path="/connect/lawyer/register" element={<LawyerRegisterPage />} />

            {/* Protected Application Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:id/summary" element={<DocumentSummaryPage />} />
              <Route path="/documents/:id/ocr-preview" element={<DocumentOcrPreviewPage />} />
              <Route path="/documents/:id/clauses" element={<DocumentClausesPage />} />
              <Route path="/documents/:id/chat" element={<DocumentChatPage />} />
              <Route path="/documents/:id/completeness" element={<DocumentCompletenessPage />} />
              <Route path="/documents/:id/obligations" element={<DocumentObligationsPage />} />
              <Route path="/documents/:id/compliance" element={<DocumentCompliancePage />} />
              <Route path="/documents/:id/compare" element={<DocumentComparePage />} />
              <Route path="/evaluation" element={<EvaluationPage />} />
              <Route path="/document-generator" element={<DocumentGeneratorPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Legal Buddy Connect (server enforces roles on every endpoint; these guards are UX only) */}
              <Route path="/connect/find" element={<FindLawyerPage />} />
              <Route path="/connect/lawyers/:id" element={<LawyerProfilePage />} />
              <Route path="/connect/consultations" element={<RequireRole roles={['USER']}><MyConsultationsPage /></RequireRole>} />
              <Route path="/connect/lawyer" element={<RequireRole roles={['LAWYER']}><LawyerDashboardPage /></RequireRole>} />
              <Route path="/connect/admin" element={<RequireRole roles={['ADMIN']}><AdminConnectPage /></RequireRole>} />
              <Route path="/connect/admin/lawyers/:id" element={<RequireRole roles={['ADMIN']}><AdminLawyerReviewPage /></RequireRole>} />
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
