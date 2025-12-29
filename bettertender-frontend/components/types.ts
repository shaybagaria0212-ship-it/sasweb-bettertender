export type LoginResponse = {
    access_token: string;
    token_type: string;
};

export type MeResponse = {
    id: number;
    email: string;
    full_name?: string;
    role: 'admin' | 'issuer' | 'bidder' | 'auditor';
};

export type TenderStatus =
    | 'draft'
    | 'published'
    | 'closed'
    | 'awarded'
    | 'cancelled';

export type Tender = {
    id: number;
    title: string;
    description: string;
    estimated_budget?: number | null;
    status: TenderStatus;
    created_at: string;
    owner_id?: number;
};

export type Submission = {
    id: number;
    tender_id: number;
    bidder_id?: number | null;
    is_anonymous: boolean;
    amount?: number | null;
    notes?: string | null;
    created_at: string;
};

export type Document = {
    id: number;
    tender_id?: number | null;
    filename: string;
    visibility: string;
    uploaded_at: string;
};

export type AuditLog = {
    id: number;
    actor_id?: number;
    action: string;
    resource_type: string;
    resource_id?: string;
    payload: any;
    created_at: string;
    immutable_signature: string;
};

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8001';
