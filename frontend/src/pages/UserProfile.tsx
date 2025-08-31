import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../stores/auth';
import Background from '../components/Background';

const UserProfile = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen font-montserrat">
        <p className="text-gray-600">You are not logged in.</p>
      </div>
    );
  }

  return (
    <>
      <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen font-montserrat">
        <Background />
        <motion.div
          className="bg-darkblue/80 rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <h2
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-center text-cyan-400"
            style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' }}
          >
            User Profile
          </h2>
          <p className="text-l font-semibold mb-4 text-center">Welcome, {user.username}!</p>
          <p className="text-l font-semibold mb-4 text-center">Email: {user.email}</p>
          <button
            onClick={() => {
              // Implement logout functionality here
              window.location.href = '/';
            }}
            className="px-6 py-2 text-white rounded-full border border-cyan-500 hover:bg-teal transition"
          >
            Return
          </button>
        </motion.div>
      </div>
    </>
  );
};
export default UserProfile;
