import {
  AccountRepository,
  ListAccountsOptions,
} from '../../domain/repositories/account.repository';

export class ListAccountsUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(options: ListAccountsOptions) {
    const { data, total } = await this.accountRepository.findMany(options);

    return {
      data,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }
}
