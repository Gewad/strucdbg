export function normalizeSeverity(raw: any): string {
    if (raw == null) return 'info';
    const s = String(raw).toLowerCase();
    if (['debug', 'dbg', 'd'].includes(s)) return 'debug';
    if (['info', 'information', 'i'].includes(s)) return 'info';
    if (['warn', 'warning', 'w'].includes(s)) return 'warning';
    if (['error', 'err', 'e'].includes(s)) return 'error';
    if (['critical', 'fatal', 'crit', 'f'].includes(s)) return 'critical';
    const n = Number(raw);
    if (!isNaN(n)) {
        if (n >= 50) return 'critical';
        if (n >= 40) return 'error';
        if (n >= 30) return 'warning';
        if (n >= 20) return 'info';
        return 'debug';
    }
    return 'info';
}

export default { normalizeSeverity };
