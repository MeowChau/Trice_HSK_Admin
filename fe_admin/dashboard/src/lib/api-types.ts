export interface UserFilters {
  excludeDeleted?: boolean;
  onlyDeleted?: boolean;
  roles?: { id: number }[];
  statuses?: { id: number }[];
  currentHskLevel?: number;
  position?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
