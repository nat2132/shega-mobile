import { createAudioPlayer } from 'expo-audio';

let soundEnabled = true;
let currentPlayer: { player: ReturnType<typeof createAudioPlayer>; timer: ReturnType<typeof setTimeout> } | null = null;
let startSoundPlayed = false;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function getSoundEnabled(): boolean {
  return soundEnabled;
}

export function hasStartSoundPlayed(): boolean {
  return startSoundPlayed;
}

function playSound(module: any) {
  if (!soundEnabled) return;

  if (currentPlayer) {
    try {
      clearTimeout(currentPlayer.timer);
      currentPlayer.player.remove();
    } catch {}
    currentPlayer = null;
  }

  try {
    const player = createAudioPlayer(module);
    let checkInterval: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      if (checkInterval !== undefined) clearInterval(checkInterval);
      try { player.remove(); } catch {}
      if (currentPlayer?.player === player) currentPlayer = null;
    };

    currentPlayer = { player, timer: setTimeout(cleanup, 5000) };

    if (player.isLoaded) {
      player.play();
    } else {
      checkInterval = setInterval(() => {
        if (player.isLoaded) {
          clearInterval(checkInterval);
          checkInterval = undefined;
          player.play();
        }
      }, 100);
    }
  } catch {}
}

export function playNice() {
  playSound(require('../assets/sound/nice.mp3'));
}

export function playBad() {
  playSound(require('../assets/sound/bad.mp3'));
}

export function playStart() {
  if (startSoundPlayed) return;
  startSoundPlayed = true;
  playSound(require('../assets/sound/start.mp3'));
}

export function playReminder() {
  playSound(require('../assets/sound/reminder.mp3'));
}
