export function defineService(descriptor) {
    if (descriptor.name.trim().length === 0) {
        throw new Error("Service name must not be empty.");
    }
    if (!Number.isInteger(descriptor.milestone) || descriptor.milestone < 0) {
        throw new Error("Service milestone must be a non-negative integer.");
    }
    return Object.freeze({ ...descriptor });
}
