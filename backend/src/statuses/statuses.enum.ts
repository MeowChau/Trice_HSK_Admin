export enum StatusEnum {
  'active' = 1,
  'inactive' = 2,
  'pending' = 3,
}

export function getStatusLabel(statusId: unknown): string {
  const id =
    typeof statusId === 'number' || typeof statusId === 'string'
      ? Number(statusId)
      : NaN;
  switch (id) {
    case StatusEnum.active:
      return 'Đã duyệt';
    case StatusEnum.inactive:
      return 'Đã hủy';
    case StatusEnum.pending:
      return 'Chờ duyệt';
    default:
      return 'Không xác định';
  }
}
