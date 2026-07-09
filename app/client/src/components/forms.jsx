// Shared form primitives + all create/edit modals.
import { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from './Modal';
import { STAGES, CONTACT_TYPES, CONVERSATION_STATUSES, ACTIVITY_TYPES, DOC_TYPES, REJECTED_WITHDRAWN_STAGE } from '../constants';
import { todayStr } from '../utils';
import { celebrateStageChange } from '../stageEffects';
import { askRejectionReason } from '../rejectionReasonPrompt';
import { useFetch } from '../hooks';
import TagPicker from './TagPicker';

export function Field({ label, full, children }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return [form, set, setForm];
}

function SubmitRow({ saving, error, onCancel, label = 'Save' }) {
  return (
    <>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : label}</button>
      </div>
    </>
  );
}

function useSubmit(fn, onDone) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // fn can return `false` to silently abort (e.g. a required prompt inside it was
      // cancelled) — stay on the form with no error message, instead of treating it as saved.
      const result = await fn();
      if (result === false) { setSaving(false); return; }
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };
  return { submit, saving, error };
}

export function CompanyDatalist({ companies }) {
  return (
    <datalist id="company-options">
      {(companies || []).map((c) => <option key={c.id} value={c.name} />)}
    </datalist>
  );
}

// ---------- Job ----------

export function JobFormModal({ job, companies, initialCompanyName, onClose, onSaved }) {
  const { data: allTags } = useFetch('/api/tags');
  const [form, set, setForm] = useForm({
    title: job?.title || '',
    company_name: job?.company_name || initialCompanyName || '',
    stage: job?.stage || 'Interested',
    summary: job?.summary || '',
    url: job?.url || '',
    application_url: job?.application_url || '',
    location: job?.location || '',
    salary_range: job?.salary_range || '',
    source: job?.source || '',
    applied_date: job?.applied_date || '',
    next_step: job?.next_step || '',
    next_step_due: job?.next_step_due || '',
    description: job?.description || '',
    notes: job?.notes || '',
    tags: (job?.tags || []).map((t) => t.id),
  });
  const { submit, saving, error } = useSubmit(async () => {
    let payload = form;
    if (job && form.stage === REJECTED_WITHDRAWN_STAGE && job.stage !== REJECTED_WITHDRAWN_STAGE) {
      const reason = await askRejectionReason();
      if (!reason) return false; // cancelled — abort silently, stay on the edit form
      payload = { ...form, rejection_reason: reason };
    }
    await (job ? api.patch(`/api/jobs/${job.id}`, payload) : api.post('/api/jobs', payload));
    if (job) celebrateStageChange(job.stage, form.stage);
  }, onSaved);

  return (
    <Modal title={job ? 'Edit job' : 'Add job'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <Field label="Job title *" full>
          <input value={form.title} onChange={set('title')} required autoFocus />
        </Field>
        <Field label="Company *">
          <input value={form.company_name} onChange={set('company_name')} list="company-options" required placeholder="Type to search or add new" />
        </Field>
        <Field label="Stage">
          <select value={form.stage} onChange={set('stage')}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <input value={form.location} onChange={set('location')} />
        </Field>
        <Field label="Salary range">
          <input value={form.salary_range} onChange={set('salary_range')} placeholder="e.g. £80–90k" />
        </Field>
        <Field label="Source">
          <input value={form.source} onChange={set('source')} placeholder="LinkedIn, referral, company site…" />
        </Field>
        <Field label="Applied date">
          <input type="date" value={form.applied_date} onChange={set('applied_date')} />
        </Field>
        <Field label="Short summary (shown at a glance)" full>
          <input value={form.summary} onChange={set('summary')} placeholder="One line on what the role is" maxLength={200} />
        </Field>
        <Field label="Job posting URL">
          <input type="url" value={form.url} onChange={set('url')} placeholder="Where you found it" />
        </Field>
        <Field label="Application form URL">
          <input type="url" value={form.application_url} onChange={set('application_url')} placeholder="Where you apply / track status" />
        </Field>
        <Field label="Next step">
          <input value={form.next_step} onChange={set('next_step')} placeholder="e.g. Follow up with recruiter" />
        </Field>
        <Field label="Next step due">
          <input type="date" value={form.next_step_due} onChange={set('next_step_due')} />
        </Field>
        <Field label="Job description / spec" full>
          <textarea rows={3} value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
        <Field label="Tags" full>
          <TagPicker allTags={allTags} selectedIds={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
        </Field>
        <CompanyDatalist companies={companies} />
        <SubmitRow saving={saving} error={error} onCancel={onClose} label={job ? 'Save changes' : 'Add job'} />
      </form>
    </Modal>
  );
}

// ---------- Contact ----------

export function ContactFormModal({ contact, companies, initialCompanyName, onClose, onSaved }) {
  const { data: allTags } = useFetch('/api/tags');
  const [form, set, setForm] = useForm({
    name: contact?.name || '',
    company_name: contact?.company_name || initialCompanyName || '',
    role_title: contact?.role_title || '',
    contact_type: contact?.contact_type || 'recruiter',
    email: contact?.email || '',
    phone: contact?.phone || '',
    linkedin_url: contact?.linkedin_url || '',
    conversation_status: contact?.conversation_status || 'not_contacted',
    last_contacted: contact?.last_contacted || '',
    next_followup_due: contact?.next_followup_due || '',
    notes: contact?.notes || '',
    tags: (contact?.tags || []).map((t) => t.id),
  });
  // Default on for brand-new contacts: attach them to jobs at their company.
  const [linkJobs, setLinkJobs] = useState(!contact);
  const { submit, saving, error } = useSubmit(
    () => (contact
      ? api.patch(`/api/contacts/${contact.id}`, form)
      : api.post('/api/contacts', { ...form, link_company_jobs: linkJobs, relationship: 'Connection' })),
    onSaved
  );

  return (
    <Modal title={contact ? 'Edit contact' : 'Add contact'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <Field label="Name *">
          <input value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Company">
          <input value={form.company_name} onChange={set('company_name')} list="company-options" placeholder="Optional" />
        </Field>
        <Field label="Role / title">
          <input value={form.role_title} onChange={set('role_title')} />
        </Field>
        <Field label="Type">
          <select value={form.contact_type} onChange={set('contact_type')}>
            {Object.entries(CONTACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="LinkedIn URL" full>
          <input type="url" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label="Conversation status">
          <select value={form.conversation_status} onChange={set('conversation_status')}>
            {Object.entries(CONVERSATION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Last contacted">
          <input type="date" value={form.last_contacted} onChange={set('last_contacted')} />
        </Field>
        <Field label="Next follow-up due">
          <input type="date" value={form.next_followup_due} onChange={set('next_followup_due')} />
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
        <Field label="Tags" full>
          <TagPicker allTags={allTags} selectedIds={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
        </Field>
        {!contact && (
          <label className="check full">
            <input type="checkbox" checked={linkJobs} onChange={(e) => setLinkJobs(e.target.checked)} />
            Add as a connection to all jobs at this company
          </label>
        )}
        <CompanyDatalist companies={companies} />
        <SubmitRow saving={saving} error={error} onCancel={onClose} label={contact ? 'Save changes' : 'Add contact'} />
      </form>
    </Modal>
  );
}

// ---------- Company ----------

export function CompanyFormModal({ company, onClose, onSaved }) {
  const { data: allTags } = useFetch('/api/tags');
  const [form, set, setForm] = useForm({
    name: company?.name || '',
    website: company?.website || '',
    location: company?.location || '',
    industry: company?.industry || '',
    summary: company?.summary || '',
    description: company?.description || '',
    notes: company?.notes || '',
    tags: (company?.tags || []).map((t) => t.id),
  });
  const { submit, saving, error } = useSubmit(
    () => (company ? api.patch(`/api/companies/${company.id}`, form) : api.post('/api/companies', form)),
    onSaved
  );

  return (
    <Modal title={company ? 'Edit company' : 'Add company'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Name *" full>
          <input value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Website">
          <input type="url" value={form.website} onChange={set('website')} placeholder="https://…" />
        </Field>
        <Field label="Industry">
          <input value={form.industry} onChange={set('industry')} />
        </Field>
        <Field label="Location" full>
          <input value={form.location} onChange={set('location')} />
        </Field>
        <Field label="What they do (shown at a glance)" full>
          <input value={form.summary} onChange={set('summary')} placeholder="One line on what the company does" maxLength={200} />
        </Field>
        <Field label="Description" full>
          <textarea rows={3} value={form.description} onChange={set('description')} placeholder="Fuller notes on the company, its product and market" />
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
        <Field label="Tags" full>
          <TagPicker allTags={allTags} selectedIds={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
        </Field>
        <SubmitRow saving={saving} error={error} onCancel={onClose} label={company ? 'Save changes' : 'Add company'} />
      </form>
    </Modal>
  );
}

// ---------- Activity (timeline entry) ----------

export function ActivityFormModal({ jobId, contactId, linkableContacts, onClose, onSaved }) {
  const [form, set] = useForm({
    activity_type: 'note',
    title: '',
    detail: '',
    occurred_at: todayStr(),
    contact_id: contactId ? String(contactId) : '',
  });
  const { submit, saving, error } = useSubmit(
    () => api.post('/api/activities', {
      job_id: jobId || null,
      contact_id: form.contact_id ? Number(form.contact_id) : null,
      activity_type: form.activity_type,
      title: form.title,
      detail: form.detail,
      occurred_at: form.occurred_at || null,
    }),
    onSaved
  );

  return (
    <Modal title="Add timeline entry" onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Type">
          <select value={form.activity_type} onChange={set('activity_type')}>
            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={form.occurred_at} onChange={set('occurred_at')} />
        </Field>
        <Field label="Title *" full>
          <input value={form.title} onChange={set('title')} required autoFocus placeholder="e.g. Call with recruiter" />
        </Field>
        {linkableContacts && linkableContacts.length > 0 && (
          <Field label="Related person" full>
            <select value={form.contact_id} onChange={set('contact_id')}>
              <option value="">— none —</option>
              {linkableContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Detail" full>
          <textarea rows={4} value={form.detail} onChange={set('detail')} />
        </Field>
        <SubmitRow saving={saving} error={error} onCancel={onClose} label="Add entry" />
      </form>
    </Modal>
  );
}

// ---------- Link a contact to a job ----------

export function LinkContactModal({ job, onClose, onSaved }) {
  const [contacts, setContacts] = useState([]);
  const [mode, setMode] = useState('existing');
  const [form, set] = useForm({
    contact_id: '',
    relationship: '',
    name: '',
    role_title: '',
    contact_type: 'recruiter',
    email: '',
  });
  useEffect(() => { api.get('/api/contacts').then(setContacts).catch(() => {}); }, []);

  const linked = new Set(job.contacts.map((c) => c.id));
  const available = contacts.filter((c) => !linked.has(c.id));

  const { submit, saving, error } = useSubmit(async () => {
    let contactId = Number(form.contact_id);
    if (mode === 'new') {
      const created = await api.post('/api/contacts', {
        name: form.name,
        company_name: job.company_name,
        role_title: form.role_title,
        contact_type: form.contact_type,
        email: form.email,
      });
      contactId = created.id;
    }
    if (!contactId) throw new Error('Choose a contact or create a new one');
    await api.post(`/api/jobs/${job.id}/contacts`, { contact_id: contactId, relationship: form.relationship });
  }, onSaved);

  return (
    <Modal title="Add person to this job" onClose={onClose}>
      <div className="toggle-row">
        <button className={`btn btn-sm${mode === 'existing' ? ' btn-primary' : ''}`} onClick={() => setMode('existing')}>Existing contact</button>
        <button className={`btn btn-sm${mode === 'new' ? ' btn-primary' : ''}`} onClick={() => setMode('new')}>New contact</button>
      </div>
      <form onSubmit={submit} className="form-grid">
        {mode === 'existing' ? (
          <Field label="Contact *" full>
            <select value={form.contact_id} onChange={set('contact_id')} required>
              <option value="">— choose —</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company_name ? ` (${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Name *">
              <input value={form.name} onChange={set('name')} required autoFocus />
            </Field>
            <Field label="Type">
              <select value={form.contact_type} onChange={set('contact_type')}>
                {Object.entries(CONTACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Role / title">
              <input value={form.role_title} onChange={set('role_title')} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={set('email')} />
            </Field>
            <div className="hint full">Will be added under {job.company_name}.</div>
          </>
        )}
        <Field label="Relationship to this job" full>
          <input value={form.relationship} onChange={set('relationship')} placeholder="e.g. Recruiter for this role, interviewer, referrer" />
        </Field>
        <SubmitRow saving={saving} error={error} onCancel={onClose} label="Add person" />
      </form>
    </Modal>
  );
}

// ---------- Attach a document to a job ----------

export function AttachDocModal({ job, onClose, onSaved }) {
  const [docs, setDocs] = useState([]);
  const [mode, setMode] = useState('existing');
  const [file, setFile] = useState(null);
  const [form, set] = useForm({ document_id: '', label: '', doc_type: 'cv' });
  useEffect(() => { api.get('/api/documents').then(setDocs).catch(() => {}); }, []);

  const attached = new Set(job.documents.map((d) => d.id));
  const available = docs.filter((d) => !attached.has(d.id));

  const { submit, saving, error } = useSubmit(async () => {
    let documentId = Number(form.document_id);
    if (mode === 'new') {
      if (!file) throw new Error('Choose a file to upload');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', form.label);
      fd.append('doc_type', form.doc_type);
      const created = await api.upload('/api/documents', fd);
      documentId = created.id;
    }
    if (!documentId) throw new Error('Choose a document or upload a new one');
    await api.post(`/api/jobs/${job.id}/documents`, { document_id: documentId });
  }, onSaved);

  return (
    <Modal title="Attach CV / document" onClose={onClose}>
      <div className="toggle-row">
        <button className={`btn btn-sm${mode === 'existing' ? ' btn-primary' : ''}`} onClick={() => setMode('existing')}>From library</button>
        <button className={`btn btn-sm${mode === 'new' ? ' btn-primary' : ''}`} onClick={() => setMode('new')}>Upload new</button>
      </div>
      <form onSubmit={submit} className="form-grid">
        {mode === 'existing' ? (
          <Field label="Document *" full>
            <select value={form.document_id} onChange={set('document_id')} required>
              <option value="">— choose —</option>
              {available.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
        ) : (
          <>
            <Field label="File *" full>
              <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} required />
            </Field>
            <Field label="Label">
              <input value={form.label} onChange={set('label')} placeholder="e.g. CV — Product v3" />
            </Field>
            <Field label="Type">
              <select value={form.doc_type} onChange={set('doc_type')}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </>
        )}
        <SubmitRow saving={saving} error={error} onCancel={onClose} label="Attach" />
      </form>
    </Modal>
  );
}

// ---------- Log an interaction with a contact ----------

export function LogInteractionModal({ contact, onClose, onSaved }) {
  const [form, set] = useForm({
    activity_type: 'call',
    title: '',
    detail: '',
    occurred_at: todayStr(),
    conversation_status: contact.conversation_status,
    next_followup_due: contact.next_followup_due || '',
  });
  const { submit, saving, error } = useSubmit(async () => {
    await api.post('/api/activities', {
      contact_id: contact.id,
      activity_type: form.activity_type,
      title: form.title,
      detail: form.detail,
      occurred_at: form.occurred_at || null,
    });
    await api.patch(`/api/contacts/${contact.id}`, {
      last_contacted: form.occurred_at,
      conversation_status: form.conversation_status,
      next_followup_due: form.next_followup_due || null,
    });
  }, onSaved);

  return (
    <Modal title={`Log interaction with ${contact.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Type">
          <select value={form.activity_type} onChange={set('activity_type')}>
            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={form.occurred_at} onChange={set('occurred_at')} />
        </Field>
        <Field label="Summary *" full>
          <input value={form.title} onChange={set('title')} required autoFocus placeholder="e.g. Intro call — discussed the PM role" />
        </Field>
        <Field label="Detail" full>
          <textarea rows={3} value={form.detail} onChange={set('detail')} />
        </Field>
        <Field label="Status after this">
          <select value={form.conversation_status} onChange={set('conversation_status')}>
            {Object.entries(CONVERSATION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Next follow-up due">
          <input type="date" value={form.next_followup_due} onChange={set('next_followup_due')} />
        </Field>
        <SubmitRow saving={saving} error={error} onCancel={onClose} label="Log it" />
      </form>
    </Modal>
  );
}
