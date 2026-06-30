// The current app still keeps workflow state inside AppRoot.
// Move durable cross-screen workflows here as the next structure pass.
export type AppStoreStatus = 'ready';

export const appStoreStatus: AppStoreStatus = 'ready';
