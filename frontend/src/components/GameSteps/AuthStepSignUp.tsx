import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface AuthStepSignUpProps {
  onClose: () => void;
  onSignUpSuccess: () => void;
  onSwitchToLogin: () => void;
}

const AuthStepSignUp: React.FC<AuthStepSignUpProps> = ({ onClose, onSignUpSuccess, onSwitchToLogin }) => {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            alert("Username and password are required");
            return;
        }
        if (password !== confirmPassword) {
            alert("Passwords do not match");
            return;
        }
        if (password.length < 8) {
            alert("Password must be at least 8 characters long");
            return;
        }
      
        console.log("Signing up with:", { username, password });
        onSignUpSuccess();

        setUsername('');
        setPassword('');
        setConfirmPassword('');
        alert("Sign up successful!");
    }

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
                Create an account to start playing!
                </p>

                <div className="space-y-3 text-black">
                    <input 
                        className="w-full p-2 border border-gray-300 rounded-md" 
                        placeholder="Username" 
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <input
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <motion.button
                        className="w-full bg-darkestblue text-white py-2 rounded hover:bg-darkestblue transition"
                        whileHover={{ scale: 1.05 }}
                        onClick={handleSignup}
                    >
                        Sign Up
                    </motion.button>
                    <p className="text-center text-sm text-gray-400 mt-2">Already have an account?</p>
                    <button className="w-full border border-darkestblue text-darkestblue py-2 rounded hover:bg-darkestblue hover:text-white transition"
                        onClick={onSwitchToLogin}
                    >
                        Log In
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthStepSignUp;