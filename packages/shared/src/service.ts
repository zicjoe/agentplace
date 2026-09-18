export type RuntimeClass = "web" | "api" | "worker" | "scheduler";

export interface ServiceDescriptor {
  readonly name: string;
  readonly runtimeClass: RuntimeClass;
  readonly version: string;
  readonly milestone: number;
}

export function defineService(descriptor: ServiceDescriptor): ServiceDescriptor {
  if (descriptor.name.trim().length === 0) {
    throw new Error("Service name must not be empty.");
  }
  if (!Number.isInteger(descriptor.milestone) || descriptor.milestone < 0) {
    throw new Error("Service milestone must be a non-negative integer.");
  }
  return Object.freeze({ ...descriptor });
}
