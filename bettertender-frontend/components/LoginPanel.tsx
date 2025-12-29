import { useState } from 'react';

type LoginPanelProps = {
  onLogin: (e: React.FormEvent, email: string) => void;
  loading: boolean;
  email: string;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
};

export default function LoginPanel({
  onLogin,
  loading,
  email,
  setEmail,
  setPassword,
}: LoginPanelProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">
        Log in to BetterTender
      </h2>
      <form onSubmit={(e) => onLogin(e, email)} className="space-y-3">
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
          <li>auditor@sasweb.gov</li>
        </ul>
        Password (all): <span className="font-mono">ChangeMe123!</span>
      </div>
    </section>
  );
}
