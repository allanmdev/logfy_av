export interface Pagination {
  page: number;
  limit: number;
}

export interface Page<T> {
  data: T[];
  total: number;
}
