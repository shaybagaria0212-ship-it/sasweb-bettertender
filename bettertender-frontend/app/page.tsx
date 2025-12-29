'use client';

import { useState, useEffect } from 'react';
import {
  API_BASE_URL,
  LoginResponse,
  MeResponse,
  Tender,
  Submission,
  Document,
  AuditLog,
} from '../components/types';
import LoginPanel from '../components/LoginPanel';
import TenderTable from '../components/TenderTable';
import CreateTenderForm from '../components/CreateTenderForm';
import BidForm from '../components/BidForm';
import SubmissionList from '../components/SubmissionList';
import DocumentList from '../components/DocumentList';
import AuditLogList from '../components/AuditLogList';

export default function HomePage() {
  // auth/login state
  const [email, setEmail] = useState('admin@sasweb.gov');
  const [password, setPassword] = useState('ChangeMe123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  // tenders
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loadingTenders, setLoadingTenders] = useState(false);

  // bidding
  const [selectedTenderForBid, setSelectedTenderForBid] = useState<Tender | null>(
    null,
  );
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loadingMySubmissions, setLoadingMySubmissions] = useState(false);

  // submissions management
  const [managedTender, setManagedTender] = useState<Tender | null>(null);
  const [managedSubmissions, setManagedSubmissions] = useState<Submission[]>(
    [],
  );
  const [loadingManagedSubs, setLoadingManagedSubs] = useState(false);
  const [awarding, setAwarding] = useState<number | null>(null);

  // documents
  const [docsTender, setDocsTender] = useState<Tender | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Bootstrap
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('bettertender_token');
    if (!stored) return;

    setToken(stored);
    (async () => {
      try {
        const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (meRes.ok) {
          const meData = (await meRes.json()) as MeResponse;
          setMe(meData);
          await Promise.all([
            fetchTendersWithToken(stored),
            fetchMySubmissionsWithToken(stored),
          ]);
          if (meData.role === 'admin' || meData.role === 'auditor') {
            fetchAuditLogsWithToken(stored);
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setMe(null);
    setTenders([]);
    setMySubmissions([]);
    setManagedTender(null);
    setManagedSubmissions([]);
    setDocsTender(null);
    setDocuments([]);
    setAuditLogs([]);

    try {
      const body = new URLSearchParams();
      body.append('username', email);
      body.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed with status ${res.status}`);
      }

      const data = (await res.json()) as LoginResponse;
      setToken(data.access_token);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('bettertender_token', data.access_token);
      }

      const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      if (!meRes.ok) throw new Error(`Failed to fetch user info`);
      const meData = (await meRes.json()) as MeResponse;
      setMe(meData);

      await Promise.all([
        fetchTendersWithToken(data.access_token),
        fetchMySubmissionsWithToken(data.access_token),
      ]);

      if (meData.role === 'admin' || meData.role === 'auditor') {
        fetchAuditLogsWithToken(data.access_token);
      }
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTendersWithToken(accessToken: string) {
    setLoadingTenders(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tenders`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Tender[];
      setTenders(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch tenders');
    } finally {
      setLoadingTenders(false);
    }
  }

  async function fetchMySubmissionsWithToken(accessToken: string) {
    setLoadingMySubmissions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/submissions/mine`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as Submission[];
      setMySubmissions(data);
    } catch { /* ignore */ } finally {
      setLoadingMySubmissions(false);
    }
  }

  async function fetchAuditLogsWithToken(accessToken: string) {
    setLoadingAudit(true);
    try {
      const res = await fetch(`${API_BASE_URL}/audit`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as AuditLog[];
      setAuditLogs(data);
    } catch { /* ignore */ } finally {
      setLoadingAudit(false);
    }
  }

  async function handleCreateTender(title: string, desc: string, budget: string) {
    if (!token) return;
    try {
      const estimated_budget = budget.trim() ? Number(budget.trim()) : undefined;
      const res = await fetch(`${API_BASE_URL}/tenders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description: desc, estimated_budget }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setTenders((prev) => [created, ...prev]);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create tender');
    }
  }

  async function handlePublishTender(id: number) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tenders/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ close_at: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setTenders((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCloseTender(id: number) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tenders/${id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setTenders((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      setError(err.message);
    }
  }

  // --- Submissions ---

  async function handleViewSubmissions(tender: Tender) {
    if (!token) return;
    setLoadingManagedSubs(true);
    setManagedTender(tender);
    try {
      const res = await fetch(`${API_BASE_URL}/tenders/${tender.id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setManagedSubmissions(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingManagedSubs(false);
    }
  }

  async function handleSubmitBid(data: any) {
    if (!token || !selectedTenderForBid) return;
    setBidSubmitting(true);
    setError(null);
    try {
      const amountNum = data.bidAmount.trim() ? Number(data.bidAmount.trim()) : undefined;
      let payload: string | undefined = undefined;
      let nonce: string | undefined = undefined;

      if (data.bidAnonymous) {
        const payloadObj = {
          amount: amountNum ?? null,
          notes: data.bidNotes || null,
          tender_id: selectedTenderForBid.id,
        };
        payload = JSON.stringify(payloadObj);
        nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }

      const res = await fetch(`${API_BASE_URL}/tenders/${selectedTenderForBid.id}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          notes: data.bidNotes || undefined,
          is_anonymous: data.bidAnonymous,
          payload,
          nonce,
          company_name: data.companyName,
          bbbee_level: data.bbbeeLevel || null,
          years_in_service: data.yearsInService ? Number(data.yearsInService) : null,
          tax_number: data.taxNumber,
          csd_number: data.csdNumber,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setMySubmissions((prev) => [created, ...prev]);
      setSelectedTenderForBid(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBidSubmitting(false);
    }
  }

  async function handleAward(submissionId: number) {
    if (!token || !managedTender) return;
    setAwarding(submissionId);
    try {
      const res = await fetch(`${API_BASE_URL}/tenders/${managedTender.id}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setTenders((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAwarding(null);
    }
  }

  // --- Documents ---

  async function handleViewDocuments(tender: Tender) {
    if (!token) return;
    setLoadingDocs(true);
    setDocsTender(tender);
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Document[];
      const filtered = data.filter((d) => d.tender_id === tender.id);
      setDocuments(filtered);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleUploadDocument(file: File, visibility: string) {
    if (!token || !docsTender) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tender_id', String(docsTender.id));
      formData.append('visibility', visibility);

      const res = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` } as any,
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setDocuments((prev) => [created, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDownloadDocument(doc: Document) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename || `document-${doc.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // --- Rendering ---

  const isBidderOrAdmin = me && (me.role === 'bidder' || me.role === 'admin');

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-6xl bg-white shadow-md rounded-xl p-6 space-y-6 border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              BetterTender – SASWEB
            </h1>
            <p className="text-sm text-slate-600">
              Backend: <span className="font-mono text-xs">{API_BASE_URL}</span>
            </p>
          </div>
          {me && (
            <div className="text-right text-xs text-slate-600">
              <div className="font-semibold">{me.full_name || me.email}</div>
              <div className="mt-1 text-[0.65rem] uppercase tracking-wide text-indigo-600">
                ROLE: {me.role}
              </div>
              <button
                onClick={() => {
                  setToken(null);
                  setMe(null);
                  window.localStorage.removeItem('bettertender_token');
                }}
                className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-[0.75rem] text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Login */}
        {!me && (
          <LoginPanel
            email={email}
            setEmail={setEmail}
            setPassword={setPassword}
            loading={loading}
            onLogin={handleLogin}
          />
        )}

        {error && (
          <div className="text-sm text-red-600 whitespace-pre-wrap border border-red-100 bg-red-50 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Dashboard */}
        {me && (
          <section className="space-y-4 border-t pt-4">
            <CreateTenderForm me={me} onCreate={handleCreateTender} />

            <TenderTable
              tenders={tenders}
              loading={loadingTenders}
              onRefresh={() => fetchTendersWithToken(token!)}
              me={me}
              onPublish={handlePublishTender}
              onClose={handleCloseTender}
              onBid={setSelectedTenderForBid}
              onViewSubmissions={handleViewSubmissions}
              onViewDocuments={handleViewDocuments}
            />

            {/* Bid Form */}
            {selectedTenderForBid && (
              <BidForm
                tender={selectedTenderForBid}
                me={me}
                onCancel={() => setSelectedTenderForBid(null)}
                onSubmit={handleSubmitBid}
                submitting={bidSubmitting}
              />
            )}

            {/* Managed Submissions */}
            {managedTender && (
              <SubmissionList
                tender={managedTender}
                submissions={managedSubmissions}
                loading={loadingManagedSubs}
                onClose={() => setManagedTender(null)}
                onAward={handleAward}
                awardingId={awarding}
                me={me}
              />
            )}

            {/* Document List */}
            {docsTender && (
              <DocumentList
                tender={docsTender}
                documents={documents}
                loading={loadingDocs}
                uploading={uploadingDoc}
                onClose={() => setDocsTender(null)}
                onUpload={handleUploadDocument}
                onDownload={handleDownloadDocument}
                me={me}
              />
            )}

            {/* My Submissions */}
            {isBidderOrAdmin && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">My submissions</h2>
                  <button
                    onClick={() => token && fetchMySubmissionsWithToken(token)}
                    disabled={loadingMySubmissions}
                    className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Refresh
                  </button>
                </div>
                {/* Reuse the table logic or create another component if needed. For now simple rendering. */}
                <div className="border rounded-md border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2">ID</th>
                        <th className="text-left px-3 py-2">Tender</th>
                        <th className="text-left px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubmissions.map((s) => (
                        <tr key={s.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-xs text-slate-500">{s.id}</td>
                          <td className="px-3 py-2 text-xs text-slate-700">#{s.tender_id}</td>
                          <td className="px-3 py-2 text-xs text-slate-700">{s.amount ?? '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Logs */}
            {(me.role === 'admin' || me.role === 'auditor') && (
              <AuditLogList
                logs={auditLogs}
                loading={loadingAudit}
                onRefresh={() => token && fetchAuditLogsWithToken(token)}
              />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
