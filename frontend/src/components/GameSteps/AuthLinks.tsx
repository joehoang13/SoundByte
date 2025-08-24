import React from 'react';
import { Link } from 'react-router-dom';

export default function AuthLinks() {
  return (
    <div className="flex gap-3 text-sm">
      <Link className="underline" to="/login">
        Login
      </Link>
      <Link className="underline" to="/signup">
        Sign up
      </Link>
    </div>
  );
}
