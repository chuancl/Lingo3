

let cachedVoices: SpeechSynthesisVoice[] = [];
let isLoaded = false;

/**
 * Preloads voices as early as possible.
 * Chrome often returns empty voices synchronously on first load, so we hook into onvoiceschanged.
 */
export const preloadVoices = () => {
  const synth = window.speechSynthesis;
  
  const updateVoices = () => {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      isLoaded = true;
    }
  };

  updateVoices();
  
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = updateVoices;
  }
};

/**
 * Stops all currently playing audio and clears the queue.
 */
export const stopAudio = () => {
  const synth = window.speechSynthesis;
  synth.cancel();
};

/**
 * Tries to unlock the audio context/speech synthesis on first user interaction.
 * This plays a silent, zero-length utterance to satisfy browser autoplay policies.
 */
export const unlockAudio = () => {
    const synth = window.speechSynthesis;
    if (synth.paused) {
        synth.resume();
    }
    // Create a dummy utterance
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0; // Silent
    u.rate = 10;  // Fast
    u.text = ' '; 
    synth.speak(u);
};

/**
 * Waits for voices to be loaded (with timeout fallback).
 */
const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
  if (isLoaded && cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    
    // Check again immediately
    const voices = synth.getVoices();
    if (voices.length > 0) {
        cachedVoices = voices;
        isLoaded = true;
        resolve(voices);
        return;
    }

    const handler = () => {
      const v = synth.getVoices();
      if (v.length > 0) {
        cachedVoices = v;
        isLoaded = true;
        synth.removeEventListener('voiceschanged', handler);
        resolve(v);
      }
    };

    synth.addEventListener('voiceschanged', handler);

    // Ultimate fallback if voiceschanged never fires (e.g. some Linux/VM envs)
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices());
    }, 2000);
  });
};

/**
 * Plays text using the browser's SpeechSynthesis API.
 * 
 * @param text The text to speak
 * @param accent 'US' or 'UK'
 * @param rate Playback speed (0.25 to 3.0), default 1.0
 * @param repeat Number of times to repeat (default 1)
 */
export const playTextToSpeech = async (text: string, accent: 'US' | 'UK' = 'US', rate: number = 1.0, repeat: number = 1) => {
  if (!text || repeat <= 0) return;

  const synth = window.speechSynthesis;

  // 1. Force Clean Slate: Stop any previous word immediately.
  // This ensures moving from Word A to Word B cuts off Word A instantly.
  synth.cancel();

  // Try to resume if paused (Chrome quirk)
  if (synth.paused) {
    synth.resume();
  }

  try {
      const voices = await waitForVoices();
      
      const langTag = accent === 'UK' ? 'en-GB' : 'en-US';
      
      // Find best matching voice
      const targetVoice = voices.find(v => v.lang === langTag) || 
                          voices.find(v => v.lang.startsWith(langTag)) || 
                          voices.find(v => v.lang.startsWith('en'));

      // 2. Queue the new utterances
      for (let i = 0; i < repeat; i++) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        const safeRate = Math.max(0.1, Math.min(10, rate)); 
        utterance.rate = safeRate;
        utterance.pitch = 1.0;

        if (targetVoice) {
            utterance.voice = targetVoice;
            utterance.lang = targetVoice.lang;
        } else {
            utterance.lang = langTag;
        }
        
        utterance.onerror = (e) => {
           console.error('TTS Error:', e);
        };

        synth.speak(utterance);
      }
  } catch (err) {
      console.error("Failed to load voices or play audio", err);
  }
};
