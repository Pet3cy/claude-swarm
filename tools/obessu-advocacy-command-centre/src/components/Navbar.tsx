import React from 'react';
import {
  Sun,
  Users,
  Compass,
  Building2,
  BarChart3,
  Sparkles,
  ShieldAlert,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/advocacy';

export type NavTab = 'my_day' | 'team' | 'opportunities' | 'stakeholders' | 'impact' | 'ai_copilot' | 'data_health';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  googleUser: User | null;
  hasGoogleToken: boolean;
  onOpenWorkspaceModal: () => void;
  actionCount: number;
  outcomesCount: number;
  healthIssueCount: number;
  onOpenQuickSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  allUsers,
  onSelectUser,
  googleUser,
  hasGoogleToken,
  onOpenWorkspaceModal,
  actionCount,
  outcomesCount,
  healthIssueCount,
  onOpenQuickSearch,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);

  const tabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'my_day', label: 'My Day', icon: Sun, badge: actionCount },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'opportunities', label: 'Opportunities', icon: Compass },
    { id: 'stakeholders', label: 'Stakeholders', icon: Building2 },
    { id: 'impact', label: 'Impact & Evidence', icon: BarChart3, badge: outcomesCount },
    { id: 'ai_copilot', label: 'AI Co-Pilot', icon: Sparkles },
    { id: 'data_health', label: 'Data Health', icon: ShieldAlert, badge: healthIssueCount > 0 ? healthIssueCount : undefined },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-blue-600 to-cyan-400 flex items-center justify-center font-black text-sm tracking-tight text-white shadow-md shadow-indigo-950/50">
              OB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-white">OBESSU</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Advocacy
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Command Centre</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600/90 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-white text-indigo-700'
                          : tab.id === 'data_health'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Quick Search, Workspace Auth, Active User */}
          <div className="flex items-center gap-2.5">
            {/* Quick Search */}
            <button
              onClick={onOpenQuickSearch}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
              title="Search opportunities, papers & stakeholders (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Search...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 text-slate-400 rounded-sm border border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Google Workspace Connection Pill */}
            <button
              onClick={onOpenWorkspaceModal}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                hasGoogleToken
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {hasGoogleToken ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline font-semibold">Workspace Connected</span>
                  <span className="sm:hidden font-semibold">Google</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Connect Google</span>
                  <span className="sm:hidden">Google</span>
                </>
              )}
            </button>

            {/* Active User Switcher */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 transition-colors"
              >
                <div className={`w-6 h-6 rounded-lg ${currentUser.avatarColor} text-white flex items-center justify-center font-bold text-xs`}>
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold leading-tight">{currentUser.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-slate-400 leading-none">{currentUser.role}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 max-h-[80vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-slate-800">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Switch Active OBESSU Profile
                      </p>
                      <p className="text-[10px] text-slate-500">Secretariat & Governing Board</p>
                    </div>

                    {/* Secretariat Group */}
                    <div className="px-3 pt-2.5 pb-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-400">
                          Secretariat (Brussels Hub)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-bold">
                          {allUsers.filter((u) => u.department === 'Secretariat').length}
                        </span>
                      </div>
                    </div>
                    <div className="p-1 space-y-0.5">
                      {allUsers
                        .filter((u) => u.department === 'Secretariat')
                        .map((u) => {
                          const isSelected = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              onClick={() => {
                                onSelectUser(u);
                                setUserDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/30'
                                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg ${u.avatarColor} text-white flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                                {u.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{u.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{u.role}</p>
                              </div>
                              {isSelected && <UserCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                    </div>

                    {/* Governing Board Group */}
                    <div className="px-3 pt-3 pb-1 border-t border-slate-800/80 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400">
                          Governing Board (Elected)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold">
                          {allUsers.filter((u) => u.department === 'Governing Board').length}
                        </span>
                      </div>
                    </div>
                    <div className="p-1 space-y-0.5">
                      {allUsers
                        .filter((u) => u.department === 'Governing Board')
                        .map((u) => {
                          const isSelected = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              onClick={() => {
                                onSelectUser(u);
                                setUserDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/30'
                                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg ${u.avatarColor} text-white flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                                {u.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{u.name}</p>
                                <p className="text-[10px] text-amber-400/80 truncate">
                                  {u.portfolio || u.role}
                                </p>
                              </div>
                              {isSelected && <UserCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center gap-1 py-2 overflow-x-auto no-scrollbar border-t border-slate-800/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
