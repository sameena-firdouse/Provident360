import React from 'react';
import {
  CalendarClock,
  LayoutDashboard,
  FileSpreadsheet,
  Coins,
  LifeBuoy,
  BadgeCheck,
  FolderLock,
  Calculator,
  FileCheck2,
  Building,
} from 'lucide-react';

export type NavTab =
  | 'timeline'
  | 'dashboard'
  | 'discrepancy'
  | 'contributions'
  | 'issues'
  | 'identity'
  | 'documents'
  | 'calculator'
  | 'claims'
  | 'employer_portal';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  isNew?: boolean;
}

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole: 'employee' | 'employer';
  overlapCount?: number;
  openIssueCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  overlapCount = 0,
  openIssueCount = 0,
}) => {
  const employeeNavItems: NavItem[] = [
    {
      id: 'timeline' as NavTab,
      label: 'Employment Timeline',
      icon: CalendarClock,
      badge: overlapCount > 0 ? `${overlapCount} alerts` : undefined,
      badgeColor: 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]',
      isNew: true,
    },
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'discrepancy' as NavTab,
      label: 'Discrepancy Check',
      icon: FileSpreadsheet,
    },
    {
      id: 'contributions' as NavTab,
      label: 'Contribution History',
      icon: Coins,
    },
    {
      id: 'issues' as NavTab,
      label: 'Issue Assistant & Tracker',
      icon: LifeBuoy,
      badge: openIssueCount > 0 ? `${openIssueCount}` : undefined,
      badgeColor: 'bg-[#e8f2ee] text-[#0b3d2e] border-[#c9ddd3]',
    },
    {
      id: 'identity' as NavTab,
      label: 'Identity Verification',
      icon: BadgeCheck,
    },
    {
      id: 'documents' as NavTab,
      label: 'Documents & Evidence',
      icon: FolderLock,
    },
    {
      id: 'calculator' as NavTab,
      label: 'Future PF Calculator',
      icon: Calculator,
    },
    {
      id: 'claims' as NavTab,
      label: 'EPF Claims Tracker',
      icon: FileCheck2,
    },
  ];

  const employerNavItems: NavItem[] = [
    {
      id: 'employer_portal' as NavTab,
      label: 'Employer Portal',
      icon: Building,
      isNew: true,
    },
    {
      id: 'identity' as NavTab,
      label: 'Identity Records',
      icon: BadgeCheck,
    },
  ];

  const items = userRole === 'employer' ? employerNavItems : employeeNavItems;

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-[#12233f] text-white rounded-xl p-3 shadow-md">
      <div className="px-3 py-2 mb-2 border-b border-[#1c3560] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#9cc2ff]">
          {userRole === 'employer' ? 'Employer Console' : 'Employee Portal'}
        </span>
      </div>

      <nav className="space-y-1">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#2a4a82] text-white shadow-xs font-semibold'
                  : 'text-[#dbe4f3] hover:bg-[#1c3560] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#9cc2ff]' : 'text-[#8aa8cf]'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.isNew && (
                  <span className="bg-[#14573f] text-[#dff3e8] text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                    Feature
                  </span>
                )}
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${item.badgeColor || 'bg-white text-[#16251f]'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Helpful context card */}
      <div className="mt-6 p-3 bg-[#1c3560] rounded-lg text-[11px] text-[#bed0ec] leading-relaxed border border-[#2a4a82]">
        <p className="font-semibold text-white mb-1">Notice on EPFO Records:</p>
        <p>
          Provident360 helps you identify date conflicts, compare passbooks with employer returns, and draft inquiries. Official record updates require employer joint declaration or the EPFiGMS portal.
        </p>
      </div>
    </aside>
  );
};
