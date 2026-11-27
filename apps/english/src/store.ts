import { createDailyStore } from 'daily-kit';
import { PHRASES } from './data/phrases';

export const useApp = createDailyStore('english:v1', PHRASES, 20261127);
