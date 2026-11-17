declare namespace CookieSessionInterfaces {
  interface CookieSessionObject {
    userId?: number;
    csrfToken?: string;
    flash?: {
      type: 'success' | 'error' | 'info';
      message: string;
    };
  }
}

export {};
