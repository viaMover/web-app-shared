import { Breadcrumb, CaptureContext } from '@sentry/types';

export interface Executor {
  addSentryBreadcrumb: (breadcrumb: Breadcrumb) => void;
  captureException: (exception: unknown, captureContext?: CaptureContext) => string;
}

let executor: Executor | undefined;
export const setExecutor = (sentry: Executor) => {
  executor = sentry;
};

export const addSentryBreadcrumb = (breadcrumb: Breadcrumb) => {
  return executor?.addSentryBreadcrumb(breadcrumb);
};

export const captureSentryException = (
  exception: unknown,
  captureContext?: CaptureContext
): string => {
  return executor?.captureException(exception, captureContext) ?? '';
};
