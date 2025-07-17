const API_BASE_URL = `${import.meta.env.API_URL}:${import.meta.env.API_PORT}`;

interface RegisterParams {
  username: string;
  email: string;
  password: string;
}

interface LoginParams {
    username: string;
    password: string;
}

export async function registerUser({ username, email, password } : RegisterParams) {
  const response = await fetch(`${API_BASE_URL}/api/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed.');
  }
  return data;
}

export async function loginUser({ username, password } : LoginParams) {
  const response = await fetch(`${API_BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Login failed.');
  }
  return data;
}
