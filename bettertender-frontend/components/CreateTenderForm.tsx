import { useState } from 'react';
import { MeResponse } from './types';

type CreateTenderFormProps = {
    me: MeResponse | null;
    onCreate: (title: string, desc: string, budget: string) => void;
};

export default function CreateTenderForm({
    me,
    onCreate,
}: CreateTenderFormProps) {
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newBudget, setNewBudget] = useState('');

    const isIssuerOrAdmin =
        me && (me.role === 'issuer' || me.role === 'admin');

    if (!isIssuerOrAdmin) return null;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onCreate(newTitle, newDescription, newBudget);
        setNewTitle('');
        setNewDescription('');
        setNewBudget('');
    }

    return (
        <div className="border rounded-md border-slate-200 p-3 space-y-2 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Create tender (issuer/admin only)
            </h3>
            <form
                onSubmit={handleSubmit}
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
    );
}
