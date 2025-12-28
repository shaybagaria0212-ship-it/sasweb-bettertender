'use client';

import { useState, useEffect } from 'react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8001';

type LoginResponse = {
  access_token: string;
  token_type: string;
};

type MeResponse = {
  id: number;
  email: string;
  full_name?: string;
  role: 'admin' | 'issuer' | 'bidder' | 'auditor';
};

type TenderStatus =
  | 'draft'
  | 'published'
  | 'closed'
  | 'awarded'
  | 'cancelled';

type Tender = {
  id: number;
  title: string;
  description: string;
  estimated_budget?: number | null;
  status: TenderStatus;
  created_at: string;
};

type Submission = {
  id: number;
  tender_id: number;
  bidder_id?: number | null;
  is_anonymous: boolean;
  amount?: number | null;
  notes?: string | null;
  created_at: string;
};

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

  // create tender form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBudget, setNewBudget] = useState('');

  // bidding state
  const [selectedTenderForBid, setSelectedTenderForBid] = useState<Tender | null>(
    null,
  );
  const [bidAmount, setBidAmount] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [bidAnonymous, setBidAnonymous] = useState(false);
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loadingMySubmissions, setLoadingMySubmissions] = useState(false);

  // issuer/admin: manage submissions for a tender
  const [managedTender, setManagedTender] = useState<Tender | null>(null);
  const [managedSubmissions, setManagedSubmissions] = useState<Submission[]>([]);
  const [loadingManagedSubs, setLoadingManagedSubs] = useState(false);
  const [awarding, setAwarding] = useState<number | null>(null);

  // Bootstrap from localStorage on first load
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
        }
      } catch {
        // ignore bootstrap errors
      }
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

    try {
      const body = new URLSearchParams();
      body.append('username', email);
      body.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      });

      if (!meRes.ok) {
        const text = await meRes.text();
        throw new Error(text || `Failed to fetch user info`);
      }

      const meData = (await meRes.json()) as MeResponse;
      setMe(meData);

      await Promise.all([
        fetchTendersWithToken(data.access_token),
        fetchMySubmissionsWithToken(data.access_token),
      ]);
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to fetch tenders`);
      }
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        // ignore for roles that don't have submissions yet
        const _ = await res.text();
        return;
      }
      const data = (await res.json()) as Submission[];
      setMySubmissions(data);
    } catch {
      // don't spam global error for this
    } finally {
      setLoadingMySubmissions(false);
    }
  }

  async function fetchSubmissionsForTender(
    accessToken: string,
    tender: Tender,
  ) {
    setLoadingManagedSubs(true);
    setManagedTender(tender);
    try {
      const res = await fetch(
        `${API_BASE_URL}/tenders/${tender.id}/submissions`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to fetch submissions for tender`);
      }
      const data = (await res.json()) as Submission[];
      setManagedSubmissions(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch submissions for tender');
    } finally {
      setLoadingManagedSubs(false);
    }
  }

  async function handleCreateTender(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !me) {
      setError('You must be logged in to create tenders.');
      return;
    }
    if (me.role !== 'issuer' && me.role !== 'admin') {
      setError('Only issuers or admins can create tenders.');
      return;
    }

    setError(null);
    try {
      const estimated_budget = newBudget.trim()
        ? Number(newBudget.trim())
        : undefined;

      const res = await fetch(`${API_BASE_URL}/tenders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          estimated_budget,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to create tender`);
      }

      const created = (await res.json()) as Tender;
      setTenders((prev) => [created, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setNewBudget('');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create tender');
    }
  }

  async function handlePublishTender(tenderId: number) {
    if (!token || !me) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tenders/${tenderId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ close_at: null }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to publish tender`);
      }
      const updated = (await res.json()) as Tender;
      setTenders((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
    } catch (err: any) {
      setError(err.message ?? 'Failed to publish tender');
    }
  }

  async function handleCloseTender(tenderId: number) {
    if (!token || !me) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tenders/${tenderId}/close`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to close tender`);
      }
      const updated = (await res.json()) as Tender;
      setTenders((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
    } catch (err: any) {
      setError(err.message ?? 'Failed to close tender');
    }
  }

  function openBidForm(tender: Tender) {
    setSelectedTenderForBid(tender);
    setBidAmount('');
    setBidNotes('');
    setBidAnonymous(false);
  }

  async function handleSubmitBid(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !me || !selectedTenderForBid) {
      setError('You must be logged in and have a selected tender.');
      return;
    }

    setError(null);
    setBidSubmitting(true);

    try {
      const amountNum = bidAmount.trim()
        ? Number(bidAmount.trim())
        : undefined;

      let payload: string | undefined = undefined;
      let nonce: string | undefined = undefined;

      if (bidAnonymous) {
        const payloadObj = {
          amount: amountNum ?? null,
          notes: bidNotes || null,
          tender_id: selectedTenderForBid.id,
        };
        payload = JSON.stringify(payloadObj);
        nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }

      const res = await fetch(
        `${API_BASE_URL}/tenders/${selectedTenderForBid.id}/submissions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: amountNum,
            notes: bidNotes || undefined,
            is_anonymous: bidAnonymous,
            payload,
            nonce,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to submit bid');
      }

      const created = (await res.json()) as Submission;
      setMySubmissions((prev) => [created, ...prev]);
      setSelectedTenderForBid(null);
      setBidAmount('');
      setBidNotes('');
      setBidAnonymous(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit bid');
    } finally {
      setBidSubmitting(false);
    }
  }

  async function handleViewSubmissions(tender: Tender) {
    if (!token || !me) return;
    await fetchSubmissionsForTender(token, tender);
  }

  async function handleAwardTender(submissionId: number) {
    if (!token || !me || !managedTender) return;
    setAwarding(submissionId);
    try {
      const res = await fetch(
        `${API_BASE_URL}/tenders/${managedTender.id}/award`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ submission_id: submissionId }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to award tender');
      }
      const updated = (await res.json()) as Tender;
      // update tender list status
      setTenders((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      // once awarded, you might want to keep viewing submissions,
      // but disable award buttons in UI
    } catch (err: any) {
      setError(err.message ?? 'Failed to award tender');
    } finally {
      setAwarding(null);
    }
  }

  function handleLogout() {
    setToken(null);
    setMe(null);
    setTenders([]);
    setMySubmissions([]);
    setSelectedTenderForBid(null);
    setManagedTender(null);
    setManagedSubmissions([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('bettertender_token');
    }
  }

  const isIssuerOrAdmin =
    me && (me.role === 'issuer' || me.role === 'admin');
  const isBidderOrAdmin = me && (me.role === 'bidder' || me.role === 'admin');

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-6xl bg-white shadow-md rounded-xl p-6 space-y-6 border border-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              BetterTender – SASWEB
            </h1>
            <p className="text-sm text-slate-600">
              Backend:{' '}
              <span className="font-mono text-xs">{API_BASE_URL}</span>
            </p>
          </div>
          {me && (
            <div className="text-right text-xs text-slate-600">
              <div className="font-semibold">
                {me.full_name || me.email.split('@')[0]}
              </div>
              <div>{me.email}</div>
              <div className="mt-1 text-[0.65rem] uppercase tracking-wide text-indigo-600">
                ROLE: {me.role}
              </div>
              <button
                onClick={handleLogout}
                className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-[0.75rem] text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Login form */}
        {!me && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Log in to BetterTender
            </h2>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <div className="text-xs text-slate-500">
              Dev users:
              <ul className="list-disc ml-4 mt-1">
                <li>admin@sasweb.gov</li>
                <li>issuer@sasweb.gov</li>
                <li>bidder@sasweb.gov</li>
              </ul>
              Password (all):{' '}
              <span className="font-mono">ChangeMe123!</span>
            </div>
          </section>
        )}

        {/* Error display */}
        {error && (
          <div className="text-sm text-red-600 whitespace-pre-wrap border border-red-100 bg-red-50 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Main app once logged in */}
        {me && (
          <section className="space-y-4 border-t pt-4">
            {/* Issuer/admin: create tender */}
            {isIssuerOrAdmin && (
              <div className="border rounded-md border-slate-200 p-3 space-y-2 bg-slate-50">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Create tender (issuer/admin only)
                </h3>
                <form
                  onSubmit={handleCreateTender}
                  className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"
                >
                  <input
                    type="text"
                    placeholder="Title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Estimated budget (optional)"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="md:col-span-3 flex justify-end mt-1">
                    <button
                      type="submit"
                      className="rounded-md bg-indigo-600 text-white text-xs font-medium px-3 py-1"
                    >
                      Create tender
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tenders table */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                Tenders
              </h2>
              <button
                onClick={() => token && fetchTendersWithToken(token)}
                disabled={loadingTenders}
                className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loadingTenders ? 'Refreshing…' : 'Refresh list'}
              </button>
            </div>

            <div className="border rounded-md border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2">ID</th>
                    <th className="text-left px-3 py-2">Title</th>
                    <th className="text-left px-3 py-2 hidden md:table-cell">
                      Description
                    </th>
                    <th className="text-left px-3 py-2">Budget</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-center text-xs text-slate-500"
                      >
                        No tenders yet.
                      </td>
                    </tr>
                  )}
                  {tenders.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {t.id}
                      </td>
                      <td className="px-3 py-2">{t.title}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 hidden md:table-cell">
                        {t.description}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {t.estimated_budget ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 uppercase">
                        {t.status}
                      </td>
                      <td className="px-3 py-2 text-xs space-x-1">
                        {isIssuerOrAdmin && t.status === 'draft' && (
                          <button
                            onClick={() => handlePublishTender(t.id)}
                            className="rounded border border-emerald-500 text-emerald-700 px-2 py-0.5 hover:bg-emerald-50"
                          >
                            Publish
                          </button>
                        )}
                        {isIssuerOrAdmin && t.status === 'published' && (
                          <button
                            onClick={() => handleCloseTender(t.id)}
                            className="rounded border border-amber-500 text-amber-700 px-2 py-0.5 hover:bg-amber-50"
                          >
                            Close
                          </button>
                        )}
                        {isBidderOrAdmin && t.status === 'published' && (
                          <button
                            onClick={() => openBidForm(t)}
                            className="rounded border border-indigo-500 text-indigo-700 px-2 py-0.5 hover:bg-indigo-50"
                          >
                            Submit bid
                          </button>
                        )}
                        {isIssuerOrAdmin && (
                          <button
                            onClick={() => handleViewSubmissions(t)}
                            className="rounded border border-slate-400 text-slate-700 px-2 py-0.5 hover:bg-slate-50"
                          >
                            Submissions
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bid form */}
            {isBidderOrAdmin && selectedTenderForBid && (
              <div className="border rounded-md border-slate-200 p-3 space-y-2 bg-slate-50">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Submit bid for tender #{selectedTenderForBid.id} –{' '}
                  {selectedTenderForBid.title}
                </h3>
                <form
                  onSubmit={handleSubmitBid}
                  className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"
                >
                  <input
                    type="number"
                    placeholder="Bid amount"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={bidNotes}
                    onChange={(e) => setBidNotes(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="inline-flex items-center text-xs text-slate-700 mt-1">
                    <input
                      type="checkbox"
                      checked={bidAnonymous}
                      onChange={(e) => setBidAnonymous(e.target.checked)}
                      className="mr-2"
                    />
                    Submit anonymously (dev: commitment only)
                  </label>
                  <div className="md:col-span-3 flex justify-end mt-1 space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTenderForBid(null)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bidSubmitting}
                      className="rounded-md bg-indigo-600 text-white text-xs font-medium px-3 py-1 disabled:opacity-60"
                    >
                      {bidSubmitting ? 'Submitting…' : 'Submit bid'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Managed submissions (issuer/admin) */}
            {isIssuerOrAdmin && managedTender && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Submissions for tender #{managedTender.id} –{' '}
                    {managedTender.title}
                  </h2>
                  <button
                    onClick={() => setManagedTender(null)}
                    className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
                  >
                    Close panel
                  </button>
                </div>
                <div className="border rounded-md border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2">ID</th>
                        <th className="text-left px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Anonymous</th>
                        <th className="text-left px-3 py-2 hidden md:table-cell">
                          Notes
                        </th>
                        <th className="text-left px-3 py-2">Created</th>
                        <th className="text-left px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingManagedSubs && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-4 text-center text-xs text-slate-500"
                          >
                            Loading submissions…
                          </td>
                        </tr>
                      )}
                      {!loadingManagedSubs &&
                        managedSubmissions.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-4 text-center text-xs text-slate-500"
                            >
                              No submissions yet.
                            </td>
                          </tr>
                        )}
                      {!loadingManagedSubs &&
                        managedSubmissions.map((s) => (
                          <tr
                            key={s.id}
                            className="border-t border-slate-100"
                          >
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {s.id}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {s.amount ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {s.is_anonymous ? 'Yes' : 'No'}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600 hidden md:table-cell">
                              {s.notes || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {new Date(s.created_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {managedTender.status !== 'awarded' ? (
                                <button
                                  onClick={() =>
                                    handleAwardTender(s.id)
                                  }
                                  disabled={awarding === s.id}
                                  className="rounded border border-emerald-500 text-emerald-700 px-2 py-0.5 hover:bg-emerald-50 disabled:opacity-60"
                                >
                                  {awarding === s.id
                                    ? 'Awarding…'
                                    : 'Award'}
                                </button>
                              ) : (
                                <span className="text-[0.65rem] uppercase text-emerald-700">
                                  Tender awarded
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* My submissions (for bidders/admin) */}
            {isBidderOrAdmin && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">
                    My submissions
                  </h2>
                  <button
                    onClick={() => token && fetchMySubmissionsWithToken(token)}
                    disabled={loadingMySubmissions}
                    className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loadingMySubmissions ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                <div className="border rounded-md border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2">ID</th>
                        <th className="text-left px-3 py-2">Tender</th>
                        <th className="text-left px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Anonymous</th>
                        <th className="text-left px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubmissions.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-4 text-center text-xs text-slate-500"
                          >
                            No submissions yet.
                          </td>
                        </tr>
                      )}
                      {mySubmissions.map((s) => (
                        <tr
                          key={s.id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {s.id}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700">
                            #{s.tender_id}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700">
                            {s.amount ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700">
                            {s.is_anonymous ? 'Yes' : 'No'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {new Date(s.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
