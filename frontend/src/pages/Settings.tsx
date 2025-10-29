import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import Background from '../components/Background';
import NavBar from '../components/NavBar';
import { useSettingsStore } from '../stores/SettingsStore';

const Settings = () => {

    const navigate = useNavigate();
    const { user, token } = useAuth();
    const isLoggedIn = !!(user && token);

    const {
        masterVolume,
        musicVolume,
        soundEffectsVolume,
        movingBackground,
        setMasterVolume,
        setMusicVolume,
        setSoundEffectsVolume,
        setMovingBackground,
        resetToDefaults,
    } = useSettingsStore();

    const handleReset = () => {
        resetToDefaults();
        // add a confirmation message
    };

    const handleReturnToLanding = () => {
        navigate('/');
    };

    return (
        <div className="h-screen overflow-hidden font-montserrat p-4">
            <Background />
            {isLoggedIn && <NavBar />}

            {!isLoggedIn && (
                <button
                    onClick={handleReturnToLanding}
                    className="group px-5 py-3 bg-darkblue/90 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-teal transition-all duration-300 shadow-2xl border-2 border-teal/50 hover:border-teal flex items-center gap-3 hover:scale-105 hover:shadow-teal/50"
                    style={{
                        boxShadow: '0 0 20px rgba(15, 193, 233, 0.3)'
                    }}
                >
                    ← Return
                </button>
            )}

            {/* Main container */}
            <div className={
                isLoggedIn
                    ? "flex items-center justify-center min-h-[calc(100vh-120px)] pt-6"  // ← if logged in
                    : "flex items-start justify-center mt-18 mb-8"                        // ← if NOT logged in
            }>
                {/* Settings Sections */}
                <div className="max-w-3xl w-full space-y-4">
                    {/* AUDIO SETTINGS SECTION */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="bg-darkblue/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/10"
                    >
                        <h2 className="text-2xl font-bold text-white mb-6">Audio Settings</h2>

                        <div className="space-y-6">
                            {/* Master Volume */}
                            <div>
                                <label className="block text-white font-semibold mb-2">Master Volume</label>
                                <div className="flex items-center gap-4">
                                    {/* Volume icon */}
                                    <svg
                                        className="w-5 h-5 text-teal flex-shrink-0"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" />
                                    </svg>

                                    {/* Slider input */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={masterVolume}
                                        onChange={e => setMasterVolume(Number(e.target.value))}
                                        className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal"
                                    />

                                    {/* Display the current value */}
                                    <span className="text-white font-semibold w-12 text-right">{masterVolume}%</span>
                                </div>
                                <p className="text-sm text-white/70 mt-2">
                                    Controls the overall volume of all sounds
                                </p>
                            </div>

                            {/* Music Volume */}
                            <div>
                                <label className="block text-white font-semibold mb-2">Music Volume</label>
                                <div className="flex items-center gap-4">
                                    <svg
                                        className="w-5 h-5 text-teal flex-shrink-0"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                    </svg>

                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={musicVolume}
                                        onChange={e => setMusicVolume(Number(e.target.value))}
                                        className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal"
                                    />

                                    <span className="text-white font-semibold w-12 text-right">{musicVolume}%</span>
                                </div>
                                <p className="text-sm text-white/70 mt-2">Controls the audio volume</p>
                            </div>

                            {/* Sound Effects Volume */}
                            <div>
                                <label className="block text-white font-semibold mb-2">Sound Effects Volume</label>
                                <div className="flex items-center gap-4">
                                    <svg
                                        className="w-5 h-5 text-teal flex-shrink-0"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                        />
                                    </svg>

                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={soundEffectsVolume}
                                        onChange={e => setSoundEffectsVolume(Number(e.target.value))}
                                        className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal"
                                    />

                                    <span className="text-white font-semibold w-12 text-right">
                                        {soundEffectsVolume}%
                                    </span>
                                </div>
                                <p className="text-sm text-white/70 mt-2">Controls UI sounds and game effects</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* VISUAL SETTINGS SECTION */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="bg-darkblue/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/10"
                    >
                        <h2 className="text-2xl font-bold text-white mb-6">Visual Settings</h2>

                        {/* Moving Background Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-white font-semibold mb-1">Animated Background</label>
                                <p className="text-sm text-white/70">
                                    Enable or disable the moving gradient background
                                </p>
                            </div>

                            {/* Toggle Switch */}
                            <button
                                onClick={() => setMovingBackground(!movingBackground)}
                                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${movingBackground ? 'bg-teal' : 'bg-white/20'
                                    }`}
                                aria-label="Toggle animated background"
                            >
                                <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${movingBackground ? 'translate-x-7' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </motion.div>

                    {/* RESET BUTTON */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        <button
                            onClick={handleReset}
                            className="w-full bg-darkblue/80 backdrop-blur-sm hover:bg-red-600/80 text-white font-semibold py-4 px-6 rounded-2xl border border-white/10 hover:border-red-500/50 transition-all shadow-lg"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                                <span>Reset to Defaults</span>
                            </div>
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
