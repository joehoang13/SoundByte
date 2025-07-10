import React from "react";
import { motion } from "framer-motion";

interface AuthStepProps {
    onClose: () => void;
    onLoginSuccess: () => void;
}

const AuthStep: React.FC<AuthStepProps> = ({ onClose, onLoginSuccess }) => {
  return (
    <div className="fixed left-0 top-0 flex items-center justify-center w-screen h-screen bg-black bg-opacity-50">
      <div className="bg-darkblue rounded-xl p-10 w-[90%] max-w-lg shadow-lg relative text-white">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white text-xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold mb-4 text-center">Welcome to SoundByte</h2>
        <p className="text-center text-gray-500 mb-6">
          Log in or create an account to start playing!
        </p>

        <div className="space-y-3 text-black">
            <input
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Username"
            />
            <input
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Password"
                type="password"
            />
            <motion.button className="w-full bg-darkestblue text-white py-2 rounded hover:bg-darkestblue transition"
                whileHover={{ scale: 1.05 }}
                onClick={onLoginSuccess}
            >
                Log In
            </motion.button>
            <p className="text-center text-sm text-gray-400 mt-2">Don't have an account?</p>
            <button className="w-full border border-darkestblue text-darkestblue py-2 rounded hover:bg-darkestblue hover:text-white transition">
                Sign Up
            </button>
        </div>
      </div>
    </div>
  );
};

export default AuthStep;
