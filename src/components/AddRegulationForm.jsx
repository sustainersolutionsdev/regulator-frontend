import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { createRegulation, uploadRegulationDocument, RegulationApiError } from '../api/regulationsApi';
import ErrorBanner from './ErrorBanner';

// Confirmed by Srinivas (9/17), from his "Domain list" doc — a sustainability/
// EHS topic taxonomy, NOT the five target-vertical categories used elsewhere
// in earlier company context. This is the authoritative list for this field.
const DOMAIN_OPTIONS = [
  'Accessibility',
  'Basel & Waste Classification',
  'Batteries',
  'Chemicals',
  'Circular Economy',
  'Climate',
  'Eco Design',
  'Ecolabels',
  'Energy',
  'Extended Producer Responsibility',
  'Materials',
  'Packaging',
  'Product Longevity / Repair',
  'Product Takeback',
  'Recycling',
  'Sustainability Transparency',
  'Supply Chain Responsibility',
];

// Confirmed by Srinivas (9/17): PDF/Word/Excel/text plus PowerPoint, 25MB.
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.pptx', '.ppt'];
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

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
  const [addToRoadmapDashboard, setAddToRoadmapDashboard] = useState(false);

  const [uploadedDocs, setUploadedDocs] = useState([]); // [{file_name, gcs_uri, ...}]
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);

  const canConfigure = claims?.role === 'admin' || claims?.role === 'sme';

  useEffect(() => {
    if (!idToken) return;
    fetchBusinessUnits(idToken)
      .then(setBusinessUnits)
      .catch(() => setBuLoadError('Failed to load Business Units for tagging.'));
  }, [idToken]);

  const toggleBu = (buId) => {
    setSelectedBuIds((prev) =>
      prev.includes(buId) ? prev.filter((id) => id !== buId) : [...prev, buId]
    );
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file after removal
    setUploadError(null);

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
        setUploadError(`"${file.name}": file type ${ext} is not allowed.`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setUploadError(`"${file.name}" exceeds the 25MB limit.`);
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
    setAddToRoadmapDashboard(false);
    setUploadedDocs([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setLastCreated(null);

    if (!domain) {
      setSubmitError('Select a domain.');
      return;
    }
    if (selectedBuIds.length === 0) {
      setSubmitError('Tag at least one Business Unit.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRegulation(idToken, {
        title: title.trim(),
        abbreviatedTitle: abbreviatedTitle.trim(),
        dueDate,
        domain,
        country: country.trim(),
        region: region.trim(),
        businessUnitIds: selectedBuIds,
        notes: notes.trim(),
        documents: uploadedDocs,
        addToRoadmapDashboard,
      });
      setLastCreated(result);
      resetForm();
      onRegulationAdded?.(result);
    } catch (err) {
      setSubmitError(err instanceof RegulationApiError ? err.message : 'Failed to create regulation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canConfigure) {
    return (
      <p className="text-body text-text-tertiary dark:text-slate-300">
        Only Admin or SME accounts can add regulations.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
        <input
          id="reg_domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          required
          placeholder="e.g. Batteries & EVs"
          list="domain-suggestions"
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
        {/* datalist keeps the five confirmed domains as suggestions without
            forcing an exact match — a middle ground worth showing Srinivas
            alongside the pure-dropdown and pure-free-text options. */}
        <datalist id="domain-suggestions">
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
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
        <input
          id="reg_region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
        />
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
              <span className="cfr text-brand-teal">{bu.code}</span>
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
        <input
          id="reg_documents"
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          accept={ALLOWED_DOCUMENT_EXTENSIONS.join(',')}
          className="block text-body text-text-primary dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
        />
        {uploading && <p role="status" className="text-label text-text-tertiary dark:text-slate-300 mt-1">Uploading...</p>}
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
                  className="text-status-action-text text-label px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
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
        disabled={submitting || uploading}
        className="bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2"
      >
        {submitting ? 'Saving...' : 'Add Regulation'}
      </button>

      <ErrorBanner message={submitError} />

      {lastCreated && (
        <div role="status" className="bg-status-compliant-bg border-status-compliant-border text-green-700 border rounded-md px-3 py-2 text-body space-y-1">
          <p>&ldquo;{lastCreated.title}&rdquo; created.</p>
          <p className="text-label">
            Record ID: <span className="cfr">{lastCreated.id}</span>
          </p>
          <p className="text-label">
            Date of entry: <span className="cfr">{new Date(lastCreated.createdAt).toLocaleString()}</span>
          </p>
        </div>
      )}
    </form>
  );
}
