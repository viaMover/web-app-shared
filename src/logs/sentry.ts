import {
  addBreadcrumb as originalAddSentryBreadcrumb,
  captureException as originalCaptureException
} from '@sentry/core';

import { getFeatureFlag } from '../references/feature-flags';

const a = true;

let addSentryBreadcrumbFunc = originalAddSentryBreadcrumb;
if (a) {
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
if (a) {
  captureSentryExceptionFunc = (exception, captureContext) => {
    console.error(exception, { captureContext });
    return originalCaptureException(exception, captureContext);
  };
}

export const addSentryBreadcrumb = addSentryBreadcrumbFunc;
export const captureSentryException = captureSentryExceptionFunc;
