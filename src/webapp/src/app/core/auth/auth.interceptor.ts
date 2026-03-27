import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { readAuthConfig } from './bootstrap-auth';

function isApiRequest(url: string): boolean {
  const { apiBaseUrl } = readAuthConfig();
  const normalizedApiBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;

  return (
    url.startsWith('/api') ||
    url.includes('/api/') ||
    url.startsWith(`${normalizedApiBaseUrl}/api`) ||
    url.includes(`${normalizedApiBaseUrl}/api/`)
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();
  const authorizedRequest =
    token && isApiRequest(req.url)
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      : req;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.handleUnauthorized();
      }

      return throwError(() => error);
    })
  );
};
