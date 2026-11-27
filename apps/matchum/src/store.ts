import { createDailyStore } from 'daily-kit';
import { ITEMS } from './data/items';

export const useApp = createDailyStore('matchum:v1', ITEMS, 20261126);
