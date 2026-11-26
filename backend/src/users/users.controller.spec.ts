import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController pagination', () => {
  const service = {
    findManyWithPagination: jest.fn(),
    count: jest.fn(),
  };
  const controller = new UsersController(service as unknown as UsersService);

  beforeEach(() => {
    jest.resetAllMocks();
    service.findManyWithPagination.mockResolvedValue([]);
  });

  it.each([
    { total: 0, page: 1, totalPages: 1, hasNextPage: false },
    { total: 10, page: 1, totalPages: 1, hasNextPage: false },
    { total: 25, page: 1, totalPages: 3, hasNextPage: true },
    { total: 25, page: 3, totalPages: 3, hasNextPage: false },
    { total: 20, page: 2, totalPages: 2, hasNextPage: false },
  ])(
    'should report accurate page boundaries for $total accounts on page $page',
    async (expected) => {
      service.count.mockResolvedValue(expected.total);
      const response = await controller.findAll({
        page: expected.page,
        limit: 10,
      });
      expect(response).toEqual({ data: [], limit: 10, ...expected });
    },
  );

  it('should use the same filters for the page and total count', async () => {
    const filters = {
      roles: [{ id: 2 }],
      statuses: [{ id: 1 }, { id: 2 }],
      currentHskLevel: 3,
    };
    service.count.mockResolvedValue(12);
    const response = await controller.findAll({ page: 2, limit: 10, filters });
    expect(service.count).toHaveBeenCalledWith(filters);
    expect(service.findManyWithPagination).toHaveBeenCalledWith({
      filterOptions: filters,
      sortOptions: undefined,
      paginationOptions: { page: 2, limit: 10 },
    });
    expect(response.totalPages).toBe(2);
  });

  it('should calculate totals using the capped page size', async () => {
    service.count.mockResolvedValue(51);
    const response = await controller.findAll({ page: 1, limit: 100 });
    expect(response).toMatchObject({
      limit: 50,
      totalPages: 2,
      hasNextPage: true,
    });
  });
});
