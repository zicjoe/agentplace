// Production-facing state facade.
//
// Milestone 1 deliberately keeps the approved Figma interaction model running
// through the isolated fixture adapter while durable API-backed state is built
// in later milestones. UI components import this facade so production adapters
// can replace fixture state without rewriting the approved surfaces.
export * from '../fixtures/FixtureAppContext';
