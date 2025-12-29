import { AuditLog } from './types';

type AuditLogListProps = {
    logs: AuditLog[];
    loading: boolean;
    onRefresh: () => void;
};

export default function AuditLogList({
    logs,
    loading,
    onRefresh,
}: AuditLogListProps) {
    return (
        <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                    System Audit Logs (Admin/Auditor Only)
                </h2>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    {loading ? 'Refreshing…' : 'Refresh logs'}
                </button>
            </div>

            <div className="border rounded-md border-slate-200 overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-2">ID</th>
                                <th className="text-left px-3 py-2">Action</th>
                                <th className="text-left px-3 py-2">Actor ID</th>
                                <th className="text-left px-3 py-2">Resource</th>
                                <th className="text-left px-3 py-2">Timestamp</th>
                                <th className="text-left px-3 py-2 hidden md:table-cell">
                                    Signature
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-4 text-center text-xs text-slate-500"
                                    >
                                        No audit logs found.
                                    </td>
                                </tr>
                            )}
                            {logs.map((log) => (
                                <tr key={log.id} className="border-t border-slate-100 font-mono text-xs">
                                    <td className="px-3 py-2 text-slate-500">{log.id}</td>
                                    <td className="px-3 py-2 font-semibold text-slate-700">
                                        {log.action}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                        {log.actor_id ?? 'System'}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                        {log.resource_type}:{log.resource_id}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-slate-400 truncate max-w-[150px] hidden md:table-cell">
                                        {log.immutable_signature}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
