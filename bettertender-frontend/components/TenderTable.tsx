import { Tender, MeResponse } from './types';

type TenderTableProps = {
    tenders: Tender[];
    loading: boolean;
    onRefresh: () => void;
    me: MeResponse | null;
    onPublish: (id: number) => void;
    onClose: (id: number) => void;
    onBid: (tender: Tender) => void;
    onViewSubmissions: (tender: Tender) => void;
    onViewDocuments: (tender: Tender) => void;
};

export default function TenderTable({
    tenders,
    loading,
    onRefresh,
    me,
    onPublish,
    onClose,
    onBid,
    onViewSubmissions,
    onViewDocuments,
}: TenderTableProps) {
    const isIssuerOrAdmin =
        me && (me.role === 'issuer' || me.role === 'admin');
    const isBidderOrAdmin = me && (me.role === 'bidder' || me.role === 'admin');

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Tenders</h2>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    {loading ? 'Refreshing…' : 'Refresh list'}
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
                                <td className="px-3 py-2 text-xs text-slate-500">{t.id}</td>
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
                                            onClick={() => onPublish(t.id)}
                                            className="rounded border border-emerald-500 text-emerald-700 px-2 py-0.5 hover:bg-emerald-50"
                                        >
                                            Publish
                                        </button>
                                    )}
                                    {isIssuerOrAdmin && t.status === 'published' && (
                                        <button
                                            onClick={() => onClose(t.id)}
                                            className="rounded border border-amber-500 text-amber-700 px-2 py-0.5 hover:bg-amber-50"
                                        >
                                            Close
                                        </button>
                                    )}
                                    {isBidderOrAdmin && t.status === 'published' && (
                                        <button
                                            onClick={() => onBid(t)}
                                            className="rounded border border-indigo-500 text-indigo-700 px-2 py-0.5 hover:bg-indigo-50"
                                        >
                                            Submit bid
                                        </button>
                                    )}
                                    {isIssuerOrAdmin && (
                                        <button
                                            onClick={() => onViewSubmissions(t)}
                                            className="rounded border border-slate-400 text-slate-700 px-2 py-0.5 hover:bg-slate-50"
                                        >
                                            Submissions
                                        </button>
                                    )}
                                    {me && (
                                        <button
                                            onClick={() => onViewDocuments(t)}
                                            className="rounded border border-sky-500 text-sky-700 px-2 py-0.5 hover:bg-sky-50"
                                        >
                                            Documents
                                        </button>
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
