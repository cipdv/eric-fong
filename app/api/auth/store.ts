type User = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

// Simple in-memory store for demo purposes only.
export const userStore: User[] = [];
