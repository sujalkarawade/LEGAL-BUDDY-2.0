import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/lawyer-login" element={<LawyerLoginPage />} />

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
            <Route path="/document-generator" element={<DocumentGeneratorPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
