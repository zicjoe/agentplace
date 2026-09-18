function randomId(prefix) {
    const id = globalThis.crypto.randomUUID().replaceAll("-", "");
    return `${prefix}_${id}`;
}
export function createTraceId() {
    return randomId("trace");
}
export function createRequestId() {
    return randomId("req");
}
export function isTraceId(value) {
    return /^trace_[a-f0-9]{32}$/.test(value);
}
