import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Mail,
  FileText,
  CheckSquare,
  HardDrive,
  LogOut,
  ShieldCheck,
  X,
  Sparkles,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { enableDemoWorkspaceSession } from '../services/firebaseAuth';

interface WorkspaceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasToken: boolean;
  isLoggingIn: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDemoSignIn?: (demoUser: any, token: string) => void;
}

export const WorkspaceAuthModal: React.FC<WorkspaceAuthModalProps> = ({
  isOpen,
  onClose,
  user,
  hasToken,
  isLoggingIn,
  onSignIn,
  onSignOut,
  onDemoSignIn,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignInClick = async () => {
    setErrorMessage(null);
    try {
      await onSignIn();
    } catch (err: any) {
      if (err?.code === 'auth/network-request-failed' || err?.message?.includes('network-request-failed')) {
        setErrorMessage(
          'Firebase Auth popup connection was restricted by iframe security. You can click below to connect via Sandbox Workspace Mode for instant testing.'
        );
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Sign in failed. Please try again.');
      }
    }
  };

  const handleEnableDemoMode = () => {
    const session = enableDemoWorkspaceSession();
    if (onDemoSignIn) {
      onDemoSignIn(session.user, session.accessToken);
    }
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              OB
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Google Workspace Hub</h2>
              <p className="text-xs text-slate-500">OBESSU European Advocacy Command Centre</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-950">Connection Notice</p>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">{errorMessage}</p>
              <button
                type="button"
                onClick={handleEnableDemoMode}
                className="mt-2.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-amber-200" />
                <span>Enable Sandbox Workspace Mode</span>
              </button>
            </div>
          </div>
        )}

        {user && hasToken ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-900">Connected & Authorized</p>
                <p className="text-xs text-emerald-700 truncate">{user.email || 'panagiotischatzimichail@gmail.com'}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Google Workspace Capabilities
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Google Calendar</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">Google Tasks</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-slate-800">Google Docs</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <HardDrive className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-slate-800">Google Drive</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs col-span-2">
                  <Mail className="w-4 h-4 text-red-600" />
                  <span className="font-semibold text-slate-800">Gmail Compose & Follow-ups</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              Access tokens are securely held in memory only for the active session.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Connect Google Workspace</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                Sign in with your Google account to sync advocacy events to Google Calendar, push Next Best Actions to Google Tasks, export briefings to Google Docs & Drive, and draft stakeholder follow-ups via Gmail.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-left space-y-2 text-xs">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Features Enabled With Permission:</p>
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Sync advocacy invitations & meetings to <strong>Google Calendar</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Sync My Day "Do this next" queue directly to <strong>Google Tasks</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>1-click export of AI policy briefings to <strong>Google Docs</strong> in Drive</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Compose post-engagement follow-up emails via <strong>Gmail</strong></span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSignInClick}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 font-semibold text-xs border border-slate-300 rounded-2xl shadow-xs transition-all disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                    <span>Connecting with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleEnableDemoMode}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-2xl border border-indigo-200 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Enable Sandbox Workspace Mode (Instant)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
