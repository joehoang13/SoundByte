import React, { useEffect, useState, useCallback, use } from 'react';
import { useGameStore } from '../../stores/GameSessionStore';
import { useSocketStore } from '../../stores/SocketStore';

interface Props {
  userId: string;
  onFinish: () => void;
}

const MultiplayerGameHandler: React.FC<Props> = ({ userId, onFinish }) => {
  const {
    roomCode,
    multiplayerQuestions,
    currentRound,
    setScore,
    setStreak,
    setCorrectAnswers,
    setTimeBonus,
    setTimeBonusTotal,
  } = useGameStore();

  const [guess, setGuess] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [roundComplete, setRoundComplete] = useState(false);

  const current = multiplayerQuestions[currentRound];
  const { socket, connect, disconnect } = useSocketStore();

  const handleGuessSubmit = useCallback(() => {
    if (!roomCode || !current?.snippetId || !guess || !socket) return;

    socket.emit(
      'game:answer',
      {
        code: roomCode,
        userId,
        roundIndex: currentRound,
        guess,
      },
      (res: any) => {
        if (!res) return;
        setLastResult(res);
        setRoundComplete(res.concluded || false);
        if (res.correct) {
          setScore(res.score);
          setStreak(res.streak);
          setCorrectAnswers(prev => prev + 1);
          setTimeBonus(useGameStore.getState().timeBonus + (res.breakdown?.timeBonus || 0));
          setTimeBonusTotal(
            useGameStore.getState().timeBonusTotal + (res.breakdown?.timeBonus || 0)
          );
        } else {
          setStreak(0);
        }
      }
    );
  }, [guess, roomCode, current?.snippetId, currentRound, userId]);

  const handleNext = () => {
    const totalRounds = multiplayerQuestions.length;
    if (currentRound + 1 >= totalRounds) {
      onFinish();
    } else {
      useGameStore.setState({
        currentRound: currentRound + 1,
        lastResult: undefined,
        attemptsLeft: undefined,
      });
      setGuess('');
      setRoundComplete(false);
      setLastResult(null);
    }
  };

  useEffect(() => {
    if (current?.snippetId) {
      socket.emit('game:roundStarted', {
        code: roomCode,
        userId,
        roundIndex: currentRound,
      });
    }
  }, [currentRound, current?.snippetId, roomCode, userId]);

  if (!current) return <div>Loading round...</div>;

  return (
    <div className="multiplayer-game">
      <audio controls autoPlay src={current.audioUrl} />
      <input
        type="text"
        value={guess}
        onChange={e => setGuess(e.target.value)}
        placeholder="Type your guess..."
        disabled={roundComplete}
      />
      <button onClick={handleGuessSubmit} disabled={roundComplete || !guess}>
        Submit Guess
      </button>

      {lastResult && (
        <div className="result">
          {lastResult.correct ? '✅ Correct!' : '❌ Try again'}
          {lastResult.concluded && <button onClick={handleNext}>Next Round</button>}
        </div>
      )}
    </div>
  );
};

export default MultiplayerGameHandler;
