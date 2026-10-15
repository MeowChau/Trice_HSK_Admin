import { ObjectLiteral, Repository } from 'typeorm';

export interface MonthWindow {
  start: Date;
  end: Date;
  label: string;
}
export interface ContentCount {
  bucket: string | number;
  count: string | number;
  skill?: string;
  level?: number;
}

const monthNames = [
  'Thg 1',
  'Thg 2',
  'Thg 3',
  'Thg 4',
  'Thg 5',
  'Thg 6',
  'Thg 7',
  'Thg 8',
  'Thg 9',
  'Thg 10',
  'Thg 11',
  'Thg 12',
];

export function recentMonths(now: Date, count = 6): MonthWindow[] {
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(
      now.getFullYear(),
      now.getMonth() - count + index + 1,
      1,
    );
    return {
      start,
      end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
      label: monthNames[start.getMonth()],
    };
  });
}

// Count each content table once. The outside bucket retains the all-time
// totals while six bounded buckets provide the monthly chart in the same scan.
export function aggregateContent<T extends ObjectLiteral>(
  repository: Repository<T>,
  months: MonthWindow[],
  withDistribution = false,
): Promise<ContentCount[]> {
  const parameters: Record<string, Date> = {};
  const cases = months.map((month, index) => {
    parameters[`start${index}`] = month.start;
    parameters[`end${index}`] = month.end;
    return `WHEN content.createdAt >= :start${index} AND content.createdAt < :end${index} THEN ${index}`;
  });
  const bucket = `CASE ${cases.join(' ')} ELSE -1 END`;
  const query = repository
    .createQueryBuilder('content')
    .select(bucket, 'bucket')
    .addSelect('COUNT(content.id)', 'count')
    .groupBy(bucket)
    .setParameters(parameters);
  if (withDistribution)
    query
      .addSelect('content.skill', 'skill')
      .addSelect('content.hskLevel', 'level')
      .addGroupBy('content.skill')
      .addGroupBy('content.hskLevel');
  return query.getRawMany<ContentCount>();
}
