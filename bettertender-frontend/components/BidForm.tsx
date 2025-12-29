import { useState } from 'react';
import { Tender, MeResponse } from './types';

type BidFormProps = {
    tender: Tender;
    me: MeResponse | null;
    onCancel: () => void;
    onSubmit: (data: any) => void; // Using any for simplicity in prop, but can be typed stricter
    submitting: boolean;
};

export default function BidForm({
    tender,
    me,
    onCancel,
    onSubmit,
    submitting,
}: BidFormProps) {
    const [companyName, setCompanyName] = useState('');
    const [bbbeeLevel, setBbbeeLevel] = useState('');
    const [yearsInService, setYearsInService] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [csdNumber, setCsdNumber] = useState('');
    const [bidAmount, setBidAmount] = useState('');
    const [bidNotes, setBidNotes] = useState('');
    const [bidAnonymous, setBidAnonymous] = useState(false);

    const isBidderOrAdmin = me && (me.role === 'bidder' || me.role === 'admin');

    if (!isBidderOrAdmin) return null;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        onSubmit({
            companyName,
            bbbeeLevel,
            yearsInService,
            taxNumber,
            csdNumber,
            bidAmount,
            bidNotes,
            bidAnonymous,
        });
    }

    return (
        <div className="border rounded-md border-slate-200 p-3 space-y-2 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Submit bid for tender #{tender.id} – {tender.title}
            </h3>
            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"
            >
                <input
                    type="text"
                    placeholder="Company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                />
                <input
                    type="text"
                    placeholder="B-BBEE level (e.g. Level 1)"
                    value={bbbeeLevel}
                    onChange={(e) => setBbbeeLevel(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                    type="number"
                    placeholder="Years in service"
                    value={yearsInService}
                    onChange={(e) => setYearsInService(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                />
                <input
                    type="text"
                    placeholder="Tax number / SARS PIN"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                />
                <input
                    type="text"
                    placeholder="CSD / CSID number"
                    value={csdNumber}
                    onChange={(e) => setCsdNumber(e.target.value)}
                    className="rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                />
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
                        onClick={onCancel}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-md bg-indigo-600 text-white text-xs font-medium px-3 py-1 disabled:opacity-60"
                    >
                        {submitting ? 'Submitting…' : 'Submit bid'}
                    </button>
                </div>
            </form>
        </div>
    );
}
