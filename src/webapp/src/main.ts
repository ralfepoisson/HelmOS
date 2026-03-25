import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { App } from './app/app';
import { captureAuthTokenFromUrl } from './app/core/auth/bootstrap-auth';

captureAuthTokenFromUrl();
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
