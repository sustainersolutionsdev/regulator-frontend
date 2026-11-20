/**
 * AddRegulationForm - Srinivas's 10-field Add Regulation form.
 *
 * M5 (approved design, Nov 17):
 *  - T035 (FR-5.2) classification help: FieldSuggestions at the top. A
 *    suggestion is applied only when the SME clicks Use; every field stays
 *    editable afterwards.
 *  - T034 (FR-5.1) duplicate check: on Save, POST /regulations/check-duplicates
 *    runs first. A likely duplicate opens DuplicateCheckDialog and nothing is
 *    saved until the SME chooses "Save as a new regulation". A related
 *    regulation (amendment, later version) is shown as a note after saving.
 *    The server also refuses an unconfirmed clear match (409), so the box
 *    appears even if the check itself failed. If the check can't run at all,
 *    the save goes ahead as before (OPEN-9: the AI never blocks a save).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { createRegulation, isPossibleDuplicate, uploadRegulationDocument, RegulationApiError } from '../api/regulationsApi';
import { checkDuplicates } from '../api/aiApi';
import ErrorBanner from './ErrorBanner';
import DomainSelect from './DomainSelect';
import RegionSelect from './RegionSelect';
import FilePicker from './FilePicker';
import FieldSuggestions from './FieldSuggestions';
import DuplicateCheckDialog from './DuplicateCheckDialog';
import { documentProblem } from '../constants/documents';
import { formatDueDate, parseDueDate } from '../utils/roadmapDates';

function dueText(iso) {
  const d = parseDueDate(iso);
  return d ? formatDueDate(d) : '';
}

export default function AddRegulationForm({ onRegulationAdded }) {
  const { idToken, claims } = useAuth();

  const [businessUnits, setBusinessUnits] = useState([]);
  const [buLoadError, setBuLoadError] = useState(null);

  // Fields in the iWant doc's literal order.
  const [title, setTitle] = useState('');
  const [abbreviatedTitle, setAbbreviatedTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [domain, setDomain] = useState('');
  const [country, setCountry] = useState('US');
  const [region, setRegion] = useState('');
  const [selectedBuIds, setSelectedBuIds] = useState([]);
  const [notes, setNotes] = useState('');
  // Default Yes (Srinivas, testing feedback Oct 26; OPEN-13 default part).
  const [addToRoadmapDashboard, setAddToRoadmapDashboard] = useState(true);

  const [uploadedDocs, setUploadedDocs] = useState([]); // [{file_name, gcs_uri, ...}]
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false); // T034: duplicate check running
  const [duplicateResult, setDuplicateResult] = useState(null); // T034: open box
  const [submitError, setSubmitError] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);
  const [lastRelated, setLastRelated] = useState([]); // T034: related regulations, shown after saving
  // Bumped on reset (and when a suggestion is used) so the Domain and Region
  // fields re-read their value, including an "Other" name.
  const [formKey, setFormKey] = useState(0);
  // The suggestion panel is cleared with the form after a save.
  const [suggestKey, setSuggestKey] = useState(0);

  const canConfigure = claims?.role === 'admin' || claims?.role === 'sme';

  useEffect(() => {
    if (!idToken) return;
    fetchBusinessUnits(idToken)
      .then(setBusinessUnits)
      .catch(() => setBuLoadError('Failed to load Business Units for tagging.'));
  }, [idToken]);

  const unitNames = Object.fromEntries(businessUnits.map((bu) => [bu.id, bu.label || bu.code || bu.id]));

  const toggleBu = (buId) => {
    setSelectedBuIds((prev) =>
      prev.includes(buId) ? prev.filter((id) => id !== buId) : [...prev, buId]
    );
  };

  // T035: apply one suggestion the SME chose to use.
  const applySuggestion = (field, s) => {
    if (field === 'domain') {
      setDomain(s.value === 'Other' ? s.otherName : s.value);
      setFormKey((k) => k + 1);
    } else if (field === 'region') {
      setRegion(s.value === 'Other' ? s.otherName : s.value);
      setFormKey((k) => k + 1);
    } else if (field === 'country') {
      setCountry(s.value);
    } else if (field === 'businessUnits') {
      const ids = s.value
        .map((b) => businessUnits.find((bu) => bu.code === b.code || bu.id === b.code)?.id)
        .filter(Boolean);
      setSelectedBuIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const handleFiles = async (files) => {
    setUploadError(null);

    for (const file of files) {
      const problem = documentProblem(file);
      if (problem) {
        setUploadError(problem);
        continue;
      }

      setUploading(true);
      try {
        const meta = await uploadRegulationDocument(idToken, file);
        setUploadedDocs((prev) => [...prev, meta]);
      } catch (err) {
        setUploadError(err instanceof RegulationApiError ? err.message : `Failed to upload "${file.name}".`);
      } finally {
        setUploading(false);
      }
    }
  };

  const removeUploadedDoc = (gcsUri) => {
    setUploadedDocs((prev) => prev.filter((d) => d.gcs_uri !== gcsUri));
  };

  const resetForm = () => {
    setTitle('');
    setAbbreviatedTitle('');
    setDueDate('');
    setDomain('');
    setCountry('US');
    setRegion('');
    setSelectedBuIds([]);
    setNotes('');
    setAddToRoadmapDashboard(true);
    setUploadedDocs([]);
    setFormKey((k) => k + 1);
    setSuggestKey((k) => k + 1);
  };

  const entry = () => ({
    title: title.trim(),
    abbreviatedTitle: abbreviatedTitle.trim(),
    dueDate,
    domain: domain.trim(),
    country: country.trim(),
    region: region.trim(),
    businessUnitIds: selectedBuIds,
    notes: notes.trim(),
  });

  // Creates the regulation. confirmedIds: the regulations the SME confirmed are different.
  const save = async (confirmedIds, related) => {
    setSubmitting(true);
    try {
      const result = await createRegulation(idToken, {
        ...entry(),
        documents: uploadedDocs,
        addToRoadmapDashboard,
        confirmedNotDuplicateOf: confirmedIds,
      });
      setDuplicateResult(null);
      setLastCreated(result);
      setLastRelated(related || []);
      resetForm();
      onRegulationAdded?.(result);
    } catch (err) {
      if (isPossibleDuplicate(err)) {
        // The server found a clear match the check didn't report (e.g. the check couldn't run).
        setDuplicateResult({
          likelyDuplicates: err.detail.likelyDuplicates || [],
          related: [],
          needsConfirmation: true,
          otherBusinessUnit: false,
          note: '',
        });
      } else {
        setDuplicateResult(null);
        setSubmitError(err instanceof RegulationApiError && typeof err.detail === 'string' && err.detail
          ? err.message
          : 'Failed to create regulation.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setLastCreated(null);
    setLastRelated([]);

    if (!domain.trim()) {
      setSubmitError('Select a domain, or choose Other and name it.');
      return;
    }
    if (selectedBuIds.length === 0) {
      setSubmitError('Tag at least one Business Unit.');
      return;
    }

    // T034: check for duplicates first. If the check itself fails, save as
    // before; the server still stops a clear match (409 above).
    setChecking(true);
    let check;
    try {
      check = await checkDuplicates(idToken, entry());
    } catch {
      check = null;
    } finally {
      setChecking(false);
    }
    if (check?.needsConfirmation) {
      setDuplicateResult(check);
      return;
    }
    await save([], check?.related);
  };

  if (!canConfigure) {
    return (
      <p className="text-body text-text-tertiary dark:text-slate-300">
        Only Admin or SME accounts can add regulations.
      </p>
    );
  }

  const busy = submitting || uploading || checking;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <FieldSuggestions key={suggestKey} onUse={applySuggestion} />

      <div>
        <label htmlFor="reg_title" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Title
        </label>
        <input
          id="reg_title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Add the name of the regulation"
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="reg_abbreviated_title" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Abbreviated Title <span className="normal-case text-text-tertiary dark:text-slate-300">(optional)</span>
        </label>
        <input
          id="reg_abbreviated_title"
          value={abbreviatedTitle}
          onChange={(e) => setAbbreviatedTitle(e.target.value)}
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="reg_due_date" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Due Date for Implementation
        </label>
        <input
          id="reg_due_date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="reg_domain" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Domain
        </label>
        <DomainSelect key={formKey} id="reg_domain" value={domain} onChange={setDomain} required />
      </div>

      <div>
        <label htmlFor="reg_country" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Country <span className="normal-case text-text-tertiary dark:text-slate-300">(optional)</span>
        </label>
        <input
          id="reg_country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="reg_region" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Region <span className="normal-case text-text-tertiary dark:text-slate-300">(optional)</span>
        </label>
        <RegionSelect key={formKey} id="reg_region" country={country} value={region} onChange={setRegion} />
      </div>

      <div>
        <span id="bu-tag-label" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">Business Units Impacted</span>
        <ErrorBanner message={buLoadError} />
        {businessUnits.length === 0 && !buLoadError && (
          <p className="text-body text-text-tertiary dark:text-slate-300">Loading Business Units...</p>
        )}
        <div className="space-y-1.5" role="group" aria-labelledby="bu-tag-label">
          {businessUnits.map((bu) => (
            <label key={bu.id} className="flex items-center gap-2 text-body text-text-primary dark:text-white">
              <input
                type="checkbox"
                checked={selectedBuIds.includes(bu.id)}
                onChange={() => toggleBu(bu.id)}
                className="rounded border-border-default dark:border-border-dark focus:ring-2 focus:ring-brand-teal"
              />
              <span className="cfr text-brand-teal dark:text-teal-300">{bu.code}</span>
              <span className="text-text-secondary dark:text-slate-400">{bu.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="reg_notes" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Notes <span className="normal-case text-text-tertiary dark:text-slate-300">(optional)</span>
        </label>
        <textarea
          id="reg_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Enter any notes"
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="reg_documents" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Upload Documents <span className="normal-case text-text-tertiary dark:text-slate-300">(optional)</span>
        </label>
        <FilePicker id="reg_documents" onFiles={handleFiles} busy={uploading} />
        <p role="status" className="sr-only">{uploading ? 'Uploadingâ€¦' : ''}</p>
        <ErrorBanner message={uploadError} />
        {uploadedDocs.length > 0 && (
          <ul className="mt-2 space-y-1">
            {uploadedDocs.map((doc) => (
              <li key={doc.gcs_uri} className="flex items-center justify-between text-body text-text-secondary dark:text-slate-400">
                <span>{doc.file_name} ({Math.round(doc.size_bytes / 1024)} KB)</span>
                <button
                  type="button"
                  onClick={() => removeUploadedDoc(doc.gcs_uri)}
                  aria-label={`Remove ${doc.file_name}`}
                  className="text-status-action-text dark:text-red-400 text-label px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset>
        <legend className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Add to Roadmap and Dashboard
        </legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-body text-text-primary dark:text-white">
            <input
              type="radio"
              name="add_to_roadmap_dashboard"
              checked={addToRoadmapDashboard === true}
              onChange={() => setAddToRoadmapDashboard(true)}
              className="focus:ring-2 focus:ring-brand-teal"
            />
            Yes
          </label>
          <label className="flex items-center gap-2 text-body text-text-primary dark:text-white">
            <input
              type="radio"
              name="add_to_roadmap_dashboard"
              checked={addToRoadmapDashboard === false}
              onChange={() => setAddToRoadmapDashboard(false)}
              className="focus:ring-2 focus:ring-brand-teal"
            />
            No
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        className="bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2"
      >
        {checking ? 'Checking for duplicatesâ€¦' : submitting ? 'Saving...' : 'Add Regulation'}
      </button>
      <p role="status" className="sr-only">{checking ? 'Checking whether this regulation is already in Regulator.' : ''}</p>

      <ErrorBanner message={submitError} />

      {lastCreated && (
        <div role="status" className="bg-status-compliant-bg border-status-compliant-border text-green-700 border rounded-md px-3 py-2 text-body space-y-1">
          <p>&ldquo;{lastCreated.title}&rdquo; created.</p>
          <p className="text-label">
            Date of entry: <span className="cfr">{new Date(lastCreated.createdAt).toLocaleString()}</span>
          </p>
          {lastRelated.length > 0 && (
            <div className="pt-1 text-text-primary dark:text-slate-100">
              <p className="text-label font-semibold">Related, you may want to check:</p>
              <ul className="list-disc pl-5">
                {lastRelated.map((r) => (
                  <li key={r.id}>
                    <a
                      href={`/dashboard?reg=${encodeURIComponent(r.id)}`}
                      className="text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                    >
                      {r.abbreviatedTitle || r.title}
                    </a>
                    {r.dueDate && <> (due {dueText(r.dueDate)})</>}
                    {r.reason && <span className="text-text-secondary dark:text-slate-300"> &middot; {r.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {duplicateResult && (
        <DuplicateCheckDialog
          result={duplicateResult}
          unitNames={unitNames}
          saving={submitting}
          onSaveAnyway={(ids) => save(ids, duplicateResult.related)}
          onClose={() => setDuplicateResult(null)}
        />
      )}
    </form>
  );
}
