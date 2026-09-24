export enum AccountStatus {
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    INACTIVE = 'inactive',
}

export interface Account {
    id: string;

    name: string;
    slug: string;

    status: AccountStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}