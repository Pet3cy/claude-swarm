import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Navbar, NavTab } from './components/Navbar';
import { MyDayView } from './components/MyDayView';
import { TeamView } from './components/TeamView';
import { OpportunitiesView } from './components/OpportunitiesView';
import { StakeholdersView } from './components/StakeholdersView';
import { ImpactDashboardView } from './components/ImpactDashboardView';
import { AIAssistantView } from './components/AIAssistantView';
import { DataHealthView } from './components/DataHealthView';
import { WorkspaceAuthModal } from './components/WorkspaceAuthModal';
import { RecordOutcomeModal } from './components/RecordOutcomeModal';
import { QuickSearchModal } from './components/QuickSearchModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';

import {
  ActionItem,
  Opportunity,
  Outcome,
  Paper,
  Stakeholder,
  UserProfile
} from './types/advocacy';

import {
  initialUsers,
  initialStakeholders,
  initialPapers,
  initialOutcomes,
  initialOpportunities
} from './data/initialData';

import { generateAllActions, generateOpportunityActions } from './services/nbaEngine';
import { initAuth, googleSignIn, logout, setCachedAccessToken } from './services/firebaseAuth';

export function App() {
  // App navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('my_day');

  // Google Workspace Auth state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessTokenState] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  // Active Team User Profile
  const [allUsers] = useState<UserProfile[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('obessu_active_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const match = initialUsers.find(
          (u) => u.id === parsed.id || u.name === parsed.name || u.email === parsed.email
        );
        if (match) return match;
      } catch (e) {
        // ignore JSON parse error
      }
    }
    // Default to Panagiotis Chatzimichail or Secretariat Lead
    return initialUsers.find((u) => u.name.includes('Panagiotis')) || initialUsers[0];
  });

  // Domain state with local persistence
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const saved = localStorage.getItem('obessu_opportunities');
    return saved ? JSON.parse(saved) : initialOpportunities;
  });

  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(() => {
    const saved = localStorage.getItem('obessu_stakeholders');
    return saved ? JSON.parse(saved) : initialStakeholders;
  });

  const [papers, setPapers] = useState<Paper[]>(() => {
    const saved = localStorage.getItem('obessu_papers');
    return saved ? JSON.parse(saved) : initialPapers;
  });

  const [outcomes, setOutcomes] = useState<Outcome[]>(() => {
    const saved = localStorage.getItem('obessu_outcomes');
    return saved ? JSON.parse(saved) : initialOutcomes;
  });

  // Action items (NBA queue)
  const [actions, setActions] = useState<ActionItem[]>(() => {
    const saved = localStorage.getItem('obessu_actions');
    if (saved) return JSON.parse(saved);
    return generateAllActions(initialOpportunities, initialStakeholders, initialPapers);
  });

  // Modal / Interaction states
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [outcomeModalOpp, setOutcomeModalOpp] = useState<Opportunity | null>(null);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // Confirmation dialog state (for destructive/mutating operations)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('obessu_opportunities', JSON.stringify(opportunities));
  }, [opportunities]);

  useEffect(() => {
    localStorage.setItem('obessu_stakeholders', JSON.stringify(stakeholders));
  }, [stakeholders]);

  useEffect(() => {
    localStorage.setItem('obessu_papers', JSON.stringify(papers));
  }, [papers]);

  useEffect(() => {
    localStorage.setItem('obessu_outcomes', JSON.stringify(outcomes));
  }, [outcomes]);

  useEffect(() => {
    localStorage.setItem('obessu_actions', JSON.stringify(actions));
  }, [actions]);

  useEffect(() => {
    localStorage.setItem('obessu_active_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessTokenState(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessTokenState(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Global Keyboard Shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auth actions
  const handleGoogleSignIn = async () => {
    try {
      setIsLoggingIn(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleAccessTokenState(res.accessToken);
        setIsWorkspaceModalOpen(false);
      }
    } catch (err: any) {
      console.warn('Google sign-in notice:', err?.message || err);
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoSignIn = (demoUser: any, token: string) => {
    setGoogleUser(demoUser);
    setGoogleAccessTokenState(token);
    setIsWorkspaceModalOpen(false);
  };

  const handleGoogleSignOut = async () => {
    await logout();
    setGoogleUser(null);
    setGoogleAccessTokenState(null);
    setIsWorkspaceModalOpen(false);
  };

  // NBA Action actions
  const handleCompleteAction = useCallback((actionId: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id === actionId) {
          return { ...a, status: 'done', completedAt: new Date().toISOString() };
        }
        return a;
      })
    );
  }, []);

  const handleDeferAction = useCallback((actionId: string, days: number) => {
    const deferDate = new Date(Date.now() + days * 86400000).toISOString();
    setActions((prev) =>
      prev.map((a) => {
        if (a.id === actionId) {
          return {
            ...a,
            deferredUntil: deferDate,
            nbaScore: Math.max(10, a.nbaScore - 20), // Demote temporarily
          };
        }
        return a;
      })
    );
  }, []);

  const handleReassignAction = useCallback((actionId: string, newAssignee: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id === actionId) {
          return { ...a, assignedTo: newAssignee, updatedAt: new Date().toISOString() };
        }
        return a;
      })
    );
  }, []);

  const handleUpdateActionStatus = useCallback((actionId: string, newStatus: ActionItem['status']) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id === actionId) {
          return {
            ...a,
            status: newStatus,
            completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
  }, []);

  // Opportunity & Stakeholder handlers
  const handleUpdateOpportunity = useCallback((updatedOpp: Opportunity) => {
    setOpportunities((prev) =>
      prev.map((opp) => (opp.id === updatedOpp.id ? updatedOpp : opp))
    );
  }, []);

  const handleUpdateStakeholder = useCallback((updatedStk: Stakeholder) => {
    setStakeholders((prev) =>
      prev.map((stk) => (stk.id === updatedStk.id ? updatedStk : stk))
    );
  }, []);

  const handleBulkUpdateStakeholders = useCallback((updatedStks: Stakeholder[]) => {
    setStakeholders((prev) => {
      const updateMap = new Map(updatedStks.map((s) => [s.id, s]));
      return prev.map((stk) => updateMap.get(stk.id) || stk);
    });
  }, []);

  const handleCreateOpportunity = useCallback((newOppData: Partial<Opportunity>) => {
    const id = `opp-${Date.now()}`;
    const legacyId = `reg-2026-${String(opportunities.length + 1).padStart(3, '0')}`;
    const fullOpp: Opportunity = {
      id,
      legacyId,
      title: newOppData.title || 'Untitled Opportunity',
      outreachEntity: newOppData.outreachEntity || 'Institutional Partner',
      categorySet: newOppData.categorySet || 'EU',
      policyArea: newOppData.policyArea || 'Civic Space & Democratic Participation',
      priority: newOppData.priority || 'Medium',
      replyStatus: newOppData.replyStatus || 'Pending',
      status: 'new',
      dateOfActivity: newOppData.dateOfActivity || new Date().toISOString().split('T')[0],
      venue: newOppData.venue || 'Brussels, Belgium',
      assignedTo: currentUser.name,
      papers: newOppData.papers || [],
      quarter: newOppData.quarter || 'Q1',
      requestDate: new Date().toISOString().split('T')[0],
      nbaScore: 85,
    };

    setOpportunities((prev) => [fullOpp, ...prev]);

    // Generate actions for this new opportunity
    const newActions = generateOpportunityActions(fullOpp, stakeholders, papers);
    setActions((prev) => [...newActions, ...prev]);
  }, [opportunities.length, currentUser.name, stakeholders, papers]);

  // Outcome recording handler
  const handleSaveOutcome = useCallback((outcomeData: Partial<Outcome>) => {
    const newOutcome: Outcome = {
      id: `out-${Date.now()}`,
      opportunityId: outcomeData.opportunityId,
      stakeholder: outcomeData.stakeholder || 'Stakeholder',
      type: outcomeData.type || 'Position submitted',
      description: outcomeData.description || '',
      evidence: outcomeData.evidence || '',
      evidenceUrl: outcomeData.evidenceUrl,
      date: outcomeData.date || new Date().toISOString().split('T')[0],
    };

    setOutcomes((prev) => [newOutcome, ...prev]);

    // If attached to an opportunity, update the opportunity outcome reference
    if (outcomeData.opportunityId) {
      setOpportunities((prev) =>
        prev.map((opp) => {
          if (opp.id === outcomeData.opportunityId) {
            return {
              ...opp,
              replyStatus: 'Completed',
              status: 'outcome_captured',
              outcome: {
                type: newOutcome.type,
                description: newOutcome.description,
                evidence: newOutcome.evidence,
              },
            };
          }
          return opp;
        })
      );
    }
  }, []);

  const handleSaveCustomAction = useCallback((actionData: any) => {
    const newAction: ActionItem = {
      id: `act-custom-${Date.now()}`,
      title: actionData.title,
      description: actionData.description,
      actionType: actionData.actionType || 'prepare_briefing',
      assignedTo: actionData.assignedTo || currentUser.name,
      status: 'todo',
      priority: actionData.priority || 'High',
      dueAt: actionData.dueAt || new Date().toISOString().split('T')[0],
      estimatedMinutes: actionData.estimatedMinutes || 30,
      nbaScore: actionData.nbaScore || 90,
      reason: actionData.reason || 'AI-recommended policy task',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setActions((prev) => [newAction, ...prev]);
  }, [currentUser.name]);

  // Data reset / import handlers
  const handleRestoreDefaultData = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset to Official 2026 Seed Registry?',
      message: 'This will restore all 108+ opportunities and initial stakeholder relationships to their pristine state.',
      isDestructive: true,
      onConfirm: () => {
        setOpportunities(initialOpportunities);
        setStakeholders(initialStakeholders);
        setPapers(initialPapers);
        setOutcomes(initialOutcomes);
        setActions(generateAllActions(initialOpportunities, initialStakeholders, initialPapers));
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleImportData = (data: any) => {
    if (data.opportunities && Array.isArray(data.opportunities)) {
      setOpportunities(data.opportunities);
    }
    if (data.stakeholders && Array.isArray(data.stakeholders)) {
      setStakeholders(data.stakeholders);
    }
    if (data.papers && Array.isArray(data.papers)) {
      setPapers(data.papers);
    }
    if (data.outcomes && Array.isArray(data.outcomes)) {
      setOutcomes(data.outcomes);
    }
    if (data.actions && Array.isArray(data.actions)) {
      setActions(data.actions);
    } else if (data.opportunities) {
      setActions(generateAllActions(data.opportunities, data.stakeholders || stakeholders, data.papers || papers));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        allUsers={allUsers}
        onSelectUser={setCurrentUser}
        googleUser={googleUser}
        hasGoogleToken={!!googleAccessToken}
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        actionCount={actions.filter((a) => a.status !== 'done' && a.assignedTo === currentUser.name).length}
        outcomesCount={outcomes.length}
        healthIssueCount={0}
        onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'my_day' && (
          <MyDayView
            currentUser={currentUser}
            actions={actions}
            opportunities={opportunities}
            stakeholders={stakeholders}
            papers={papers}
            onCompleteAction={handleCompleteAction}
            onDeferAction={handleDeferAction}
            onReassignAction={handleReassignAction}
            onOpenOpportunity={(id) => {
              setSelectedOppId(id);
              setActiveTab('opportunities');
            }}
            onOpenBriefingDraft={(opp) => {
              setSelectedOppId(opp.id);
              setActiveTab('ai_copilot');
            }}
            onOpenRecordOutcome={(opp) => setOutcomeModalOpp(opp)}
            onOpenVoiceDebrief={() => setActiveTab('ai_copilot')}
            hasGoogleToken={!!googleAccessToken}
            onRequireAuth={() => setIsWorkspaceModalOpen(true)}
          />
        )}

        {activeTab === 'team' && (
          <TeamView
            actions={actions}
            opportunities={opportunities}
            users={allUsers}
            currentUser={currentUser}
            onUpdateActionStatus={handleUpdateActionStatus}
            onReassignAction={handleReassignAction}
            onOpenOpportunity={(id) => {
              setSelectedOppId(id);
              setActiveTab('opportunities');
            }}
          />
        )}

        {activeTab === 'opportunities' && (
          <OpportunitiesView
            opportunities={opportunities}
            stakeholders={stakeholders}
            papers={papers}
            selectedOppId={selectedOppId}
            onSelectOpportunity={setSelectedOppId}
            onUpdateOpportunity={handleUpdateOpportunity}
            onCreateOpportunity={handleCreateOpportunity}
            onOpenBriefingDraft={(opp) => {
              setSelectedOppId(opp.id);
              setActiveTab('ai_copilot');
            }}
            onOpenRecordOutcome={(opp) => setOutcomeModalOpp(opp)}
            hasGoogleToken={!!googleAccessToken}
            onRequireAuth={() => setIsWorkspaceModalOpen(true)}
          />
        )}

        {activeTab === 'stakeholders' && (
          <StakeholdersView
            stakeholders={stakeholders}
            opportunities={opportunities}
            outcomes={outcomes}
            papers={papers}
            actions={actions}
            onUpdateStakeholder={handleUpdateStakeholder}
            onBulkUpdateStakeholders={handleBulkUpdateStakeholders}
            onCreateAction={handleSaveCustomAction}
            onNavigateToTab={setActiveTab}
            onOpenBriefingDraft={(opp) => {
              setSelectedOppId(opp.id);
              setActiveTab('ai_copilot');
            }}
            onOpenOpportunity={(id) => {
              setSelectedOppId(id);
              setActiveTab('opportunities');
            }}
            hasGoogleToken={!!googleAccessToken}
            onRequireAuth={() => setIsWorkspaceModalOpen(true)}
          />
        )}

        {activeTab === 'impact' && (
          <ImpactDashboardView
            opportunities={opportunities}
            outcomes={outcomes}
            stakeholders={stakeholders}
            actions={actions}
            papers={papers}
            onOpenOpportunity={(id) => {
              setSelectedOppId(id);
              setActiveTab('opportunities');
            }}
            onOpenBriefingDraft={(opp) => {
              setSelectedOppId(opp.id);
              setActiveTab('ai_copilot');
            }}
          />
        )}

        {activeTab === 'ai_copilot' && (
          <AIAssistantView
            opportunities={opportunities}
            stakeholders={stakeholders}
            papers={papers}
            onSaveOutcome={handleSaveOutcome}
            onSaveAction={handleSaveCustomAction}
            hasGoogleToken={!!googleAccessToken}
            onRequireAuth={() => setIsWorkspaceModalOpen(true)}
          />
        )}

        {activeTab === 'data_health' && (
          <DataHealthView
            opportunities={opportunities}
            stakeholders={stakeholders}
            papers={papers}
            outcomes={outcomes}
            onRestoreDefaultData={handleRestoreDefaultData}
            onImportData={handleImportData}
          />
        )}
      </main>

      {/* Global Modals */}
      <WorkspaceAuthModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        user={googleUser}
        hasToken={!!googleAccessToken}
        isLoggingIn={isLoggingIn}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
        onDemoSignIn={handleDemoSignIn}
      />

      <RecordOutcomeModal
        isOpen={!!outcomeModalOpp}
        opportunity={outcomeModalOpp}
        onClose={() => setOutcomeModalOpp(null)}
        onSaveOutcome={handleSaveOutcome}
      />

      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        opportunities={opportunities}
        stakeholders={stakeholders}
        papers={papers}
        actions={actions}
        onSelectOpportunity={(id) => {
          setSelectedOppId(id);
          setActiveTab('opportunities');
        }}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default App;
