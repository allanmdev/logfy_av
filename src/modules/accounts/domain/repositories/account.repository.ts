import {
  Account,
  AccountStatus,
} from '../entities/account.entity';

export interface CreateAccountData {
  name: string;
  slug: string;
}

export interface UpdateAccountData {
  name?: string;
  slug?: string;
  status?: AccountStatus;
}

export interface ListAccountsOptions {
  page: number;
  limit: number;
  deleted: 'all' | 'true' | 'false';
}

export interface AccountPage {
  data: Account[];
  total: number;
}

export interface AccountRepository {
  create(data: CreateAccountData): Promise<Account>;

  findById(id: string): Promise<Account | null>;

  findBySlug(slug: string): Promise<Account | null>;

  findMany(options: ListAccountsOptions): Promise<AccountPage>;

  update(
    id: string,
    data: UpdateAccountData,
  ): Promise<Account>;

  softDelete(id: string): Promise<void>;
}