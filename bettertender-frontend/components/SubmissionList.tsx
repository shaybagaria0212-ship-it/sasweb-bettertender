import { Submission, Tender, MeResponse } from './types';

type SubmissionListProps = {
    tender: Tender;
    submissions: Submission[];
    loading: boolean;
    onClose: () => void;
    onAward: (submissionId: number) => void;
    awardingId: number | null;
    me: MeResponse | null;
};

export default function SubmissionList({
    tender,
    submissions,
    loading,
    onClose,
    onAward,
    awardingId,
    me,
}: SubmissionListProps) {
    const isIssuerOrAdmin =
        me && (me.role === 'issuer' || me.role === 'admin');

    if (!isIssuerOrAdmin) return null;

    return (
        <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                    Submissions for tender #{tender.id} – {tender.title}
                </h2>
                <button
                    onClick={onClose}
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
                        {loading && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-3 py-4 text-center text-xs text-slate-500"
                                >
                                    Loading submissions…
                                </td>
                            </tr>
                        )}
                        {!loading && submissions.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-3 py-4 text-center text-xs text-slate-500"
                                >
                                    No submissions yet.
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            submissions.map((s) => (
                                <tr key={s.id} className="border-t border-slate-100">
                                    <td className="px-3 py-2 text-xs text-slate-500">{s.id}</td>
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
                                        {tender.status !== 'awarded' ? (
                                            <button
                                                onClick={() => onAward(s.id)}
                                                disabled={awardingId === s.id}
                                                className="rounded border border-emerald-500 text-emerald-700 px-2 py-0.5 hover:bg-emerald-50 disabled:opacity-60"
                                            >
                                                {awardingId === s.id ? 'Awarding…' : 'Award'}
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
    );
}
