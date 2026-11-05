const activeControllers = new Map<string, AbortController>();

export function registerActiveJob(jobId: string, controller: AbortController) {
  activeControllers.set(jobId, controller);
}

export function unregisterActiveJob(jobId: string) {
  activeControllers.delete(jobId);
}

export function cancelActiveJob(jobId: string) {
  const controller = activeControllers.get(jobId);
  if (controller) controller.abort();
}
