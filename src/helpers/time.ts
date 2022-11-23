import dayjs from 'dayjs';

export const dateFromExplicitPair = (year: number, month: number, day?: number): dayjs.Dayjs =>
  dayjs(new Date(year, month - 1, day ?? 1));
