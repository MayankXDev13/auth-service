declare global {
  namespace Express {
    interface User {
      userId?: string;
      id?: string;
    }
  }
}

export {};
