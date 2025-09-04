import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthStepLogin from '../components/GameSteps/AuthStepLogin';
import AuthStepSignUp from '../components/GameSteps/AuthStepSignUp';

type Side = 'login' | 'signup' | null;

interface ModalProps {
  onClose: () => void;
  onAuthed?: () => void;
  initialTab?: 'login' | 'signup';
}


const LEFT_LABEL_NUDGE = { marginLeft: 40, marginTop: -200 };
const RIGHT_LABEL_NUDGE = { marginRight: 90, marginTop: -200 };

const LEFT_VINYL_NUDGE = { marginLeft: 110, marginTop: 12 };
const RIGHT_VINYL_NUDGE = { marginRight: 50, marginTop: 12 };

const Modal: React.FC<ModalProps> = ({ onClose, onAuthed, initialTab }) => {
  const [hover, setHover] = useState<Side>(initialTab ?? null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const leftActive = hover === 'login';
  const rightActive = hover === 'signup';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-darkblue/30 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-3 z-50 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white text-xl"
        >
          ×
        </button>

        {/* Main Modal */}
        <motion.div
          className="relative w-full max-w-6xl h-[80vh] max-h-[600px] min-h-[500px] bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Two halves */}
          <div className="relative bg-darkblue/85 mx-auto grid h-full w-full grid-cols-2">
          
            {/* Divider */}
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-white/15 md:block" />

            {/* LEFT (Login) */}
            <motion.section
              className="relative h-full"
              onMouseEnter={() => setHover('login')}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover('login')}
              animate={{ opacity: leftActive ? 1 : hover === 'signup' ? 0.35 : 0.9 }}
              transition={{ duration: 0.25 }}
            >
              {/* LABEL (separate, nudged; fades out on hover) */}
              <motion.div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                initial={false}
                animate={{ opacity: leftActive ? 0 : 1, y: leftActive ? -8 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex flex-col items-start">
                  <h2 className="font-exo text-6xl text-white select-none">Returning?</h2>

                  {/* Vinyl under the label — fades with the label (mirrored on LEFT) */}
                  <div
                    className="select-none"
                    style={{
                      marginLeft: LEFT_VINYL_NUDGE.marginLeft,
                      marginTop: LEFT_VINYL_NUDGE.marginTop,
                    }}
                  >
                    <img
                      src="/vinyl.png"
                      alt="Vinyl"
                      className="mt-3 w-14 h-14 object-contain opacity-90 -scale-x-100"
                    />
                  </div>
                </div>
              </motion.div>

              {/* FORM (fixed alignment; appears on hover) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  className="relative w-full max-w-md"
                  initial={false}
                  animate={{ opacity: leftActive ? 1 : 0, y: leftActive ? 0 : 8 }}
                  transition={{ duration: 0.25 }}
                >
                  <AuthStepLogin 
                    hideClose
                    onClose={onClose}
                    onLoginSuccess={() => {
                      onAuthed?.();
                      onClose();
                    }}
                    onSwitchToSignUp={() => setHover('signup')}
                  />
                </motion.div>
              </div>
            </motion.section>

            {/* RIGHT (Signup) */}
            <motion.section
              className="relative h-full"
              onMouseEnter={() => setHover('signup')}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover('signup')}
              animate={{ opacity: rightActive ? 1 : hover === 'login' ? 0.35 : 0.9 }}
              transition={{ duration: 0.25 }}
            >
              {/* LABEL (separate, nudged; fades out on hover) */}
              <motion.div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                initial={false}
                animate={{ opacity: rightActive ? 0 : 1, y: rightActive ? -8 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex flex-col text-center items-end">
                  <h2 className="font-exo text-6xl text-white select-none">New?</h2>

                  {/* Vinyl under the label — fades with the label (normal on RIGHT) */}
                  <div
                    className="select-none"
                    style={{
                      marginRight: RIGHT_VINYL_NUDGE.marginRight,
                      marginTop: RIGHT_VINYL_NUDGE.marginTop,
                    }}
                  >
                    <img
                      src="/vinyl.png"
                      alt="Vinyl"
                      className="mt-3 w-14 h-14 object-contain opacity-90"
                    />
                  </div>
                </div>
              </motion.div>

              {/* FORM (fixed alignment; appears on hover) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  className="relative w-full max-w-md"
                  initial={false}
                  animate={{ opacity: rightActive ? 1 : 0, y: rightActive ? 0 : 8 }}
                  transition={{ duration: 0.25 }}
                >
                  <AuthStepSignUp
                    hideClose
                    onClose={onClose}
                    onSignUpSuccess={() => {
                      onAuthed?.();
                      onClose();
                    }}
                    onSwitchToLogin={() => setHover('login')}
                  />
                </motion.div>
              </div>
            </motion.section>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/60">
          By continuing you agree to our Terms & Privacy.
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Modal;
