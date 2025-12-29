import { useState } from 'react';
import { Document, Tender, MeResponse } from './types';

type DocumentListProps = {
    tender: Tender;
    documents: Document[];
    loading: boolean;
    uploading: boolean;
    onClose: () => void;
    onUpload: (file: File, visibility: string) => void;
    onDownload: (doc: Document) => void;
    me: MeResponse | null;
};

export default function DocumentList({
    tender,
    documents,
    loading,
    uploading,
    onClose,
    onUpload,
    onDownload,
    me,
}: DocumentListProps) {
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docVisibility, setDocVisibility] = useState<
        'public' | 'internal' | 'restricted'
    >('internal');

    const isIssuerOrAdmin =
        me && (me.role === 'issuer' || me.role === 'admin');

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) {
            setDocFile(null);
            return;
        }
        setDocFile(files[0]);
    }

    function handleUpload(e: React.FormEvent) {
        e.preventDefault();
        if (!docFile) return;
        onUpload(docFile, docVisibility);
        setDocFile(null); // Clear after upload attempt
    }

    return (
        <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                    Documents for tender #{tender.id} – {tender.title}
                </h2>
                <button
                    onClick={onClose}
                    className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
                >
                    Close panel
                </button>
            </div>

            <div className="border rounded-md border-slate-200 p-3 space-y-3 bg-slate-50">
                {isIssuerOrAdmin ? (
                    <form
                        onSubmit={handleUpload}
                        className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm items-center"
                    >
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                File
                            </label>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="block w-full text-xs text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                Visibility
                            </label>
                            <select
                                value={docVisibility}
                                onChange={(e) =>
                                    setDocVisibility(
                                        e.target.value as 'public' | 'internal' | 'restricted',
                                    )
                                }
                                className="rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="public">Public</option>
                                <option value="internal">Internal</option>
                                <option value="restricted">Restricted</option>
                            </select>
                        </div>
                        <div className="flex justify-end mt-4 md:mt-6">
                            <button
                                type="submit"
                                disabled={uploading || !docFile}
                                className="rounded-md bg-sky-600 text-white text-xs font-medium px-3 py-1 disabled:opacity-60"
                            >
                                {uploading ? 'Uploading…' : 'Upload document'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <p className="text-xs text-slate-600">
                        You can view and download documents for this tender. Only issuers and
                        admins can upload new documents.
                    </p>
                )}

                <div className="border rounded-md border-slate-200 overflow-hidden bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-3 py-2">ID</th>
                                <th className="text-left px-3 py-2">Filename</th>
                                <th className="text-left px-3 py-2">Visibility</th>
                                <th className="text-left px-3 py-2">Uploaded</th>
                                <th className="text-left px-3 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-4 text-center text-xs text-slate-500"
                                    >
                                        Loading documents…
                                    </td>
                                </tr>
                            )}
                            {!loading && documents.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-4 text-center text-xs text-slate-500"
                                    >
                                        No documents yet.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                documents.map((d) => (
                                    <tr key={d.id} className="border-t border-slate-100">
                                        <td className="px-3 py-2 text-xs text-slate-500">{d.id}</td>
                                        <td className="px-3 py-2 text-xs text-slate-700">
                                            {d.filename}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-700 capitalize">
                                            {d.visibility}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-500">
                                            {new Date(d.uploaded_at).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            <button
                                                onClick={() => onDownload(d)}
                                                className="rounded border border-slate-400 text-slate-700 px-2 py-0.5 hover:bg-slate-50"
                                            >
                                                Download
                                            </button>
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
