// 各种累计次数，成就用。s.stats 里一个键一个数。
export function tally(s, k, n = 1) { const st = (s.stats ||= {}); st[k] = (st[k] || 0) + n; }
