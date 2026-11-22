import React, { useState } from 'react';
import {
  ShieldAlert,
  Bell,
  ExternalLink,
  UserCheck,
  ChevronDown,
  Building2,
  User,
  CheckCircle2,
} from 'lucide-react';

interface HeaderProps {
  currentUser: { id: number; name: string; role: string; email: string };
  demoUsers: Array<{ id: number; name: string; role: string; email: string }>;
  notifications: Array<{ id: number; message: string; created_at: string; is_read: number }>;
  onSwitchUser: (userId: number) => void;
  onMarkNotificationsRead: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  demoUsers,
  notifications,
  onSwitchUser,
  onMarkNotificationsRead,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#c9ddd3] shadow-xs">
      {/* Top synthetic disclaimer banner */}
      <div className="bg-[#fff7e0] border-b border-[#ecd9a6] text-[#7a5200] text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-[#7a5200] shrink-0" />
        <span>
          Demo mode: all data is synthetic. Provident360 is an independent verification platform and has no direct access to internal EPFO systems.
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0b3d2e] flex items-center justify-center text-white font-bold text-lg shadow-xs">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-[#0b3d2e] tracking-tight">Provident360</span>
              <span className="bg-[#e8f2ee] text-[#0b3d2e] text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[#c9ddd3]">
                PROTOTYPE
              </span>
            </div>
            <p className="text-[11px] text-[#4b5f56] leading-none hidden sm:block">
              Employment Timeline & EPF Integrity Platform
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Official EPFiGMS quick link */}
          <a
            href="https://epfigms.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#14573f] hover:text-[#0b3d2e] font-medium bg-[#e8f2ee] px-2.5 py-1.5 rounded-md border border-[#c9ddd3] transition-colors"
            title="Official EPFO Grievance Management System"
          >
            <span>EPFiGMS Grievance Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowBellDropdown(!showBellDropdown);
                if (unreadCount > 0) onMarkNotificationsRead();
              }}
              className="relative p-2 rounded-full text-[#16251f] hover:bg-[#e8f2ee] border border-[#c9ddd3] transition-colors cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4 text-[#0b3d2e]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#9b1c1c] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showBellDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#c9ddd3] py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[#e8f2ee] flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#0b3d2e]">Notifications</span>
                  <span className="text-[11px] text-[#4b5f56]">{notifications.length} recent</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#f5f9f7]">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#4b5f56]">
                      No new notifications.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 text-xs ${n.is_read ? 'text-[#4b5f56]' : 'bg-[#f5f9f7] text-[#16251f] font-medium'}`}
                      >
                        <p>{n.message}</p>
                        <span className="text-[10px] text-[#4b5f56] block mt-1">{n.created_at}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 bg-[#f5f9f7] hover:bg-[#e8f2ee] border border-[#c9ddd3] py-1.5 px-3 rounded-lg text-xs font-medium text-[#16251f] transition-colors cursor-pointer"
            >
              {currentUser.role === 'employer' ? (
                <Building2 className="w-3.5 h-3.5 text-[#0b3d2e]" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#0b3d2e]" />
              )}
              <span className="max-w-[120px] truncate">{currentUser.name}</span>
              <span className="text-[10px] uppercase font-bold text-[#14573f] bg-white px-1.5 py-0.5 rounded border border-[#c9ddd3]">
                {currentUser.role}
              </span>
              <ChevronDown className="w-3 h-3 text-[#4b5f56]" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#c9ddd3] py-2 z-50">
                <div className="px-3 py-1.5 border-b border-[#e8f2ee]">
                  <span className="text-[11px] font-semibold text-[#4b5f56] uppercase tracking-wider">
                    Switch Demo Persona
                  </span>
                </div>
                <div className="p-1 space-y-1">
                  {demoUsers.map(u => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u.id);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#e8f2ee] text-[#0b3d2e] font-semibold'
                            : 'hover:bg-[#f5f9f7] text-[#16251f]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {u.role === 'employer' ? (
                            <Building2 className="w-3.5 h-3.5 text-[#14573f] shrink-0" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-[#0b3d2e] shrink-0" />
                          )}
                          <div className="truncate">
                            <div className="truncate font-medium">{u.name}</div>
                            <div className="text-[10px] text-[#4b5f56] truncate">{u.email}</div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#0b3d2e] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
