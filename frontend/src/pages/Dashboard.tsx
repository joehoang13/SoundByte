import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  animate,
  motion,
  MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from 'framer-motion';
import disc from '../assets/disc.svg';
import needle from '../assets/needle.svg';
import Background from '../components/Background';
import useGameStore from '../stores/GameSessionStore';
import GamePrefModal from '../components/GameSteps/GamePrefModal';
import NavBar from '../components/NavBar';

interface GameMode {
  id: string;
  title: string;
  description: string;
}

interface GamePreferencesData {
  difficulty: string;
  snippetLength?: number | null;
  roomOption?: string | null;
}

interface GamePreferencesProps {
  mode: GameMode;
  onPlay: (mode: GameMode, preferences: GamePreferencesData) => void;
  onClose: () => void;
}

function useScrollOverflowMask(scrollXProgress: MotionValue<number>) {
  const left = `0%`;
  const right = `100%`;
  const leftInset = `5%`;
  const rightInset = `95%`;
  const transparent = `#0000`;
  const opaque = `#000`;
  const maskImage = useMotionValue(
    `linear-gradient(90deg, ${opaque}, ${opaque} ${left}, ${opaque} ${rightInset}, ${transparent})`
  );

  useMotionValueEvent(scrollXProgress, 'change', value => {
    if (value === 0) {
      animate(
        maskImage,
        `linear-gradient(90deg, ${opaque}, ${opaque} ${left}, ${opaque} ${rightInset}, ${transparent})`
      );
    } else if (value === 1) {
      animate(
        maskImage,
        `linear-gradient(90deg, ${transparent}, ${opaque} ${leftInset}, ${opaque} ${right}, ${opaque})`
      );
    } else if (scrollXProgress.getPrevious() === 0 || scrollXProgress.getPrevious() === 1) {
      animate(
        maskImage,
        `linear-gradient(90deg, ${transparent}, ${opaque} ${leftInset}, ${opaque} ${rightInset}, ${transparent})`
      );
    }
  });

  return maskImage;
}

const GamePreferences: React.FC<GamePreferencesProps> = ({ mode, onPlay, onClose }) => {
  const [difficulty, setDifficulty] = useState<string>('normal');
  const [snippetLength, setSnippetLength] = useState<number | null>(5);
  const [roomOption, setRoomOption] = useState<string | null>(null);

  const difficulties = [
    { id: 'easy', label: 'Easy', description: '10 seconds', length: 10 },
    { id: 'normal', label: 'Normal', description: '5 seconds', length: 5 },
    { id: 'hard', label: 'Hard', description: '3 seconds', length: 3 },
  ];

  const roomOptions = [
    { id: 'create', label: 'Host', description: 'Create your own room' },
    { id: 'join', label: 'Join', description: 'Join an existing room' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="w-full h-[600px] bg-darkblue/90 rounded-2xl p-6 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">{mode.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <p className="text-gray-300 mb-8">{mode.description}</p>

        <div className="space-y-6">
          {mode.id === 'classic' && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Difficulty</h4>
              <div className="grid gap-3">
                {difficulties.map(diff => (
                  <motion.button
                    key={diff.id}
                    onClick={() => {
                      setDifficulty(diff.id);
                      setSnippetLength(diff.length);
                    }}
                    className={`p-4 rounded-xl border transition-all ${
                      difficulty === diff.id
                        ? 'bg-teal/20 text-white border-teal'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border-white/20'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{diff.label}</span>
                      <span className="text-sm">{diff.description}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {mode.id === 'inference' && (
            <div>
              <p className="text-gray-300">No difficulty settings needed.</p>
            </div>
          )}

          {mode.id === 'multiplayer' && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Room Options</h4>
              <div className="grid gap-3">
                {roomOptions.map(options => (
                  <motion.button
                    key={options.id}
                    onClick={() => {
                      setRoomOption(options.id);
                    }}
                    className={`p-4 rounded-xl border transition-all ${
                      roomOption === options.id
                        ? 'bg-teal/20 text-white border-teal'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border-white/20'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{options.label}</span>
                      <span className="text-sm">{options.description}</span>
                    </div>
                  </motion.button>
                ))}
              </div>

              {roomOption === 'create' && (
                <>
                  <h4 className="text-lg font-semibold text-white mb-4">Difficulty</h4>
                  <div className="grid gap-3">
                    {difficulties.map(diff => (
                      <motion.button
                        key={diff.id}
                        onClick={() => {
                          setDifficulty(diff.id);
                          setSnippetLength(diff.length);
                        }}
                        className={`p-4 rounded-xl border transition-all ${
                          difficulty === diff.id
                            ? 'bg-teal/20 text-white border-teal'
                            : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border-white/20'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{diff.label}</span>
                          <span className="text-sm">{diff.description}</span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <motion.button
        onClick={() => onPlay(mode, { difficulty, snippetLength, roomOption })}
        className="w-full py-4 rounded-xl font-bold text-lg transition-all bg-teal text-white shadow-teal/30"
        whileHover={{ scale: 1.02, boxShadow: `0 6px 16px rgba(15, 193, 233, 0.4)` }}
        whileTap={{ scale: 0.98 }}
      >
        START {mode.title}
      </motion.button>
    </motion.div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const setConfig = useGameStore(state => state.setConfig);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showGamePrefs, setShowGamePrefs] = useState(false);

  const containerRef = useRef(null);
  const { scrollXProgress } = useScroll({ container: containerRef });
  const maskImage = useScrollOverflowMask(scrollXProgress);

  const gameModes = [
    {
      id: 'classic',
      title: 'CLASSIC MODE',
      description:
        'Identify tracks from audio snippets. Test your music knowledge with timed challenges.',
    },
    {
      id: 'inference',
      title: 'INFERENCE MODE',
      description: 'Guess songs from lyrics.',
    },
    {
      id: 'multiplayer',
      title: 'MULTIPLAYER',
      description: 'Compete against friends in real-time music battles.',
    },
    {
      id: 'other',
      title: 'OTHER',
      description: 'Other game modes',
    },
  ];

  {
    /* Data for Testing */
  }
  const recentActivity = [
    { id: 1, action: 'Completed Classic Mode', score: 850, time: '2 hours ago' },
    { id: 2, action: 'Won Multiplayer Match', score: 920, time: '4 hours ago' },
    { id: 3, action: 'Lost Multiplayer Match', score: 650, time: '1 day ago' },
    { id: 4, action: 'Completed Inference Mode', score: 780, time: '2 days ago' },
  ];

  const friends = [
    { id: 1, name: 'Ryan23', status: 'online', lastScore: 890 },
    { id: 2, name: 'MusicLover5', status: 'in-game', lastScore: 1200 },
    { id: 3, name: 'Sophia3', status: 'offline', lastScore: 750 },
    { id: 4, name: 'Melody777', status: 'online', lastScore: 980 },
  ];

  const handleCardClick = (mode: { id: string; title: string; description: string }) => {
    setExpandedCard(mode.id);
    setSelectedMode(mode.id);
  };

  const handlePlay = (mode: GameMode, preferences: GamePreferencesData) => {
    const snippetSize = preferences.snippetLength || 5;

    setConfig({
      mode: mode.id as any,
      difficulty: preferences.difficulty as any,
      snippetSize: snippetSize as any,
    });

    setExpandedCard(null);
    setSelectedMode(null);

    if (mode.id === 'classic') {
      navigate('/ready');
    } else if (mode.id === 'inference') {
      navigate('/inference');
    } else if (mode.id === 'multiplayer') {
      if (preferences.roomOption === 'create') {
        navigate('/grouplobby', {
          state: {
            role: 'create',
            snippetLength: preferences.snippetLength,
          },
        });
      } else if (preferences.roomOption === 'join') {
        navigate('/grouplobby', {
          state: {
            role: 'join',
          },
        });
      }
    } else {
      navigate('/ready');
    }
  };

  return (
    <>
      <Background />

      <div className="min-h-screen max-h-screen overflow-hidden items-center justify-center font-montserrat p-4 relative">
        <NavBar />

        <div className="flex h-screen">
          <div className="w-2/3">
            <motion.div
              ref={containerRef}
              className="flex gap-6 overflow-x-auto pb-4 pt-2 px-4 mt-8 mb-8"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#0FC1E9 transparent',
                maskImage,
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              {gameModes.map(mode => {
                const isExpanded = expandedCard === mode.id;
                const isSelected = selectedMode === mode.id;

                return (
                  <motion.div
                    key={mode.id}
                    className="relative cursor-pointer group flex-shrink-0"
                    onClick={!isExpanded ? () => handleCardClick(mode) : undefined}
                    animate={{
                      width: isExpanded ? '600px' : '300px',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ width: '300px' }}
                  >
                    {/* Mode Card */}
                    {!isExpanded ? (
                      <div
                        className={`rounded-2xl overflow-hidden h-[600px] transition-all hover:shadow-lg backdrop-blur-sm bg-darkblue/50 ${
                          selectedMode === mode.id
                            ? 'border-2 border-teal shadow-teal/20'
                            : 'border border-white/10'
                        }`}
                      >
                        <div>
                          <h2 className="absolute top-2 left-2 text-xl font-bold text-white px-2 py-1 rounded-full z-10">
                            {mode.title}
                          </h2>
                        </div>
                        {/* Image Area */}
                        <div
                          className="relative h-[450px] flex items-center justify-center"
                          style={{ backgroundColor: 'rgba(20, 61, 77, 0.65)' }}
                        >
                          <motion.img
                            src={needle}
                            alt={`${mode.title} Needle`}
                            className="absolute w-24 h-24 z-10 select-none pointer-events-none"
                            style={{
                              scale: '0.5',
                              top: '37%',
                              right: '32%',
                              filter:
                                selectedMode === mode.id
                                  ? 'brightness(0) saturate(100%) invert(76%) sepia(63%) saturate(4000%) hue-rotate(180deg) brightness(120%) contrast(100%)'
                                  : 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
                            }}
                            animate={{ rotate: selectedMode === mode.id ? -15 : -5 }}
                            transition={{
                              duration: 0.5,
                              type: 'spring',
                              stiffness: 100,
                              damping: 20,
                            }}
                          />
                          <motion.img
                            src={disc}
                            alt={`${mode.title} Icon`}
                            className="w-16 h-16 select-none"
                            draggable={false}
                            onDragStart={e => e.preventDefault()}
                            style={{
                              filter:
                                selectedMode === mode.id
                                  ? 'brightness(0) saturate(100%) invert(76%) sepia(63%) saturate(4000%) hue-rotate(180deg) brightness(120%) contrast(100%)'
                                  : 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
                            }}
                            animate={{ rotate: selectedMode === mode.id ? 360 : 0 }}
                            transition={{
                              repeat: Infinity,
                              ease: 'linear',
                              duration: selectedMode === mode.id ? 5 : 0,
                            }}
                          />
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <p className="text-xs leading-relaxed text-white">{mode.description}</p>
                        </div>
                      </div>
                    ) : (
                      <GamePreferences
                        key="preferences"
                        mode={mode}
                        onPlay={handlePlay}
                        onClose={() => {
                          setExpandedCard(null);
                          setSelectedMode(null);
                        }}
                      />
                    )}

                    {/* Selection Glow Effect */}
                    {isSelected && !isExpanded && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-teal shadow-teal/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <div className="w-1/3 p-10 space-y-6">
            {/* Recent Activity */}
            <motion.div
              className="bg-darkblue/80 backdrop-blur-sm rounded-2xl p-4"
              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-teal">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="text-sm text-white">
                    <p>{activity.action}</p>
                    <p className="text-xs text-white/70">
                      Score: {activity.score} • {activity.time}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Friends List */}
            <motion.div
              className="bg-darkblue/80 backdrop-blur-sm rounded-2xl p-4"
              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <h3 className="text-lg font-bold text-white mb-4">Friends</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-teal">
                {friends.map(friend => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between text-sm text-white"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${friend.status === 'online' ? 'bg-green-400' : friend.status === 'in-game' ? 'bg-yellow-400' : 'bg-gray-500'}`}
                      ></div>
                      <span>{friend.name}</span>
                    </div>
                    <span className="text-xs text-white/70">Last Score: {friend.lastScore}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Game Settings Modal */}
      {showGamePrefs && <GamePrefModal onClose={() => setShowGamePrefs(false)} />}
    </>
  );
};

export default Dashboard;
