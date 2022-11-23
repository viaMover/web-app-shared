import {
  addBreadcrumb as originalAddSentryBreadcrumb,
  captureException as originalCaptureException
} from '@sentry/core';
import { getFeatureFlag } from 'web-app-shared/references/feature-flags';

let addSentryBreadcrumbFunc = originalAddSentryBreadcrumb;
if (getFeatureFlag('IS_CONSOLE_ENABLED')) {
  addSentryBreadcrumbFunc = (breadcrumb) => {
    switch (breadcrumb.type) {
      case 'error':
        console.error(breadcrumb.message, breadcrumb);
        break;
      case 'info':
        console.info(breadcrumb.message, breadcrumb);
        break;
      case 'warning':
        console.warn(breadcrumb.message, breadcrumb);
        break;
      case 'debug':
        console.debug(breadcrumb.message, breadcrumb);
        break;
      default:
    }

    originalAddSentryBreadcrumb(breadcrumb);
  };
}

let captureSentryExceptionFunc = originalCaptureException;
if (getFeatureFlag('IS_CONSOLE_ENABLED')) {
  captureSentryExceptionFunc = (exception, captureContext) => {
    console.error(exception, { captureContext });
    return originalCaptureException(exception, captureContext);
  };
}

export const addSentryBreadcrumb = addSentryBreadcrumbFunc;
export const captureSentryException = captureSentryExceptionFunc;
