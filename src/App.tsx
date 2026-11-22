import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { EmploymentHistoryPage } from './components/EmploymentHistoryPage.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { DiscrepancyCheckView } from './components/DiscrepancyCheckView.tsx';
import { ContributionHistoryView } from './components/ContributionHistoryView.tsx';
import { PfCalculatorView } from './components/PfCalculatorView.tsx';
import { IdentityVerificationView } from './components/IdentityVerificationView.tsx';
import { IssueAssistantView } from './components/IssueAssistantView.tsx';
import { DocumentsView } from './components/DocumentsView.tsx';
import { ClaimsView } from './components/ClaimsView.tsx';
import { EmployerCorrectionView } from './components/EmployerCorrectionView.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>({
    id: 1,
    name: 'Asha Demo',
    email: 'asha@demo.test',
    role: 'employee',
  });
  const [demoUsers, setDemoUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<NavTab>('timeline');
  const [overlapCount, setOverlapCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me').then(r => r.json());
      if (res.user) {
        setCurrentUser(res.user);
        setDemoUsers(res.demoUsers || []);
        if (res.user.role === 'employer') {
          setCurrentTab('employer_portal');
        } else {
          setCurrentTab('timeline');
        }
      }

      const notifRes = await fetch('/api/notifications').then(r => r.json());
      setNotifications(notifRes.notifications || []);

      if (res.user?.role === 'employee') {
        const timelineRes = await fetch('/api/employee/timeline').then(r => r.json());
        setOverlapCount((timelineRes.overlaps || []).length);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleSwitchUser = async (userId: number) => {
    try {
      setLoading(true);
      await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await fetchSession();
    } catch (err) {
      console.error('Failed to switch user:', err);
      setLoading(false);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f9f7] text-[#16251f] flex flex-col font-sans">
      {/* Brand & Demo Switcher Header */}
      <Header
        currentUser={currentUser}
        demoUsers={demoUsers}
        notifications={notifications}
        onSwitchUser={handleSwitchUser}
        onMarkNotificationsRead={handleMarkNotificationsRead}
      />

      {/* Main App Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Navigation Sidebar */}
          <Sidebar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            userRole={currentUser.role}
            overlapCount={overlapCount}
          />

          {/* Active View Container */}
          <div className="flex-1 min-w-0 w-full">
            {loading ? (
              <div className="flex items-center justify-center p-24 text-[#4b5f56]">
                <div className="w-8 h-8 border-3 border-[#0b3d2e] border-t-transparent rounded-full animate-spin mb-3"></div>
              </div>
            ) : (
              <>
                {currentTab === 'timeline' && <EmploymentHistoryPage />}
                {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
                {currentTab === 'discrepancy' && <DiscrepancyCheckView />}
                {currentTab === 'contributions' && <ContributionHistoryView />}
                {currentTab === 'issues' && <IssueAssistantView />}
                {currentTab === 'identity' && <IdentityVerificationView />}
                {currentTab === 'documents' && <DocumentsView />}
                {currentTab === 'calculator' && <PfCalculatorView />}
                {currentTab === 'claims' && <ClaimsView />}
                {currentTab === 'employer_portal' && <EmployerCorrectionView />}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#c9ddd3] py-6 text-center text-xs text-[#4b5f56] space-y-1">
        <div className="flex items-center justify-center gap-2">
          <span className="font-bold text-[#0b3d2e]">Provident360 Prototype</span>
          <span>·</span>
          <span>Independent Employee Employment Timeline & PF Record Reconciler</span>
        </div>
        <p className="text-[11px] text-[#6b857a]">
          Synthetic demo data. Employer-entered information is not officially verified by EPFO. For official grievances visit epfigms.gov.in.
        </p>
      </footer>
    </div>
  );
}
