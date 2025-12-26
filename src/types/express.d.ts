declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string | null;
      role: "admin" | "user";
    }
    
    interface Request {
      user?: User;
    }
  }
}

export {};
