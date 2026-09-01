import React, { useState } from 'react';
import { Award, X, Link as LinkIcon, Calendar, Building2, CheckCircle2 } from 'lucide-react';
import { Opportunity, Outcome, OutcomeType, Stakeholder } from '../types/advocacy';

interface RecordOutcomeModalProps {
  isOpen: boolean;
  opportunity: Opportunity | null;
  onClose: () => void;
  onSaveOutcome: (outcome: Partial<Outcome>) => void;
}

export const RecordOutcomeModal: React.FC<RecordOutcomeModalProps> = ({
  isOpen,
  opportunity,
  onClose,
  onSaveOutcome,
}) => {
  if (!isOpen || !opportunity) return null;

  const [type, setType] = useState<OutcomeType>('Position submitted');
  const [description, setDescription] = useState(
    `Submitted OBESSU recommendations on ${opportunity.policyArea} during engagement with ${opportunity.outreachEntity}.`
  );
  const [evidence, setEvidence] = useState(
    `Official submission reference / consultation receipt with ${opportunity.outreachEntity}.`
  );
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [date, setDate] = useState(
    opportunity.dateOfActivity || new Date().toISOString().split('T')[0]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOutcome({
      opportunityId: opportunity.id,
      stakeholder: opportunity.outreachEntity,
      type,
      description,
      evidence,
      evidenceUrl: evidenceUrl.trim() || undefined,
      date,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 space-y-4"
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Substantive Outcome</h3>
              <p className="text-xs text-slate-500">{opportunity.outreachEntity}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Outcome Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as OutcomeType)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden font-semibold"
          >
            <option value="Position submitted">Position submitted (Consultation / Hearing)</option>
            <option value="Legislative uptake">Legislative uptake (EP Report / Directive amendment)</option>
            <option value="Structural invitation">Structural invitation / Standing Advisory Seat</option>
            <option value="Joint statement">Joint statement / Coalition declaration</option>
            <option value="Formal citation">Formal citation in UN / EU Report</option>
            <option value="Meeting held">Bilateral meeting held with substantive follow-up</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Substantive Description</label>
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Evidence & Verification Details</label>
          <input
            type="text"
            required
            placeholder="e.g. EP Committee Doc A9-0210/2026 paragraph 14"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Date Achieved</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Evidence Link (Optional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Substantive Outcome</span>
          </button>
        </div>
      </form>
    </div>
  );
};
