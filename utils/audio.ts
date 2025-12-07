
let cachedVoices: SpeechSynthesisVoice[] = [];
let isLoaded = false;

/**
 * Preloads voices as early as possible.
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
 * Stops all currently playing audio.
 */
export const stopAudio = () => {
  const synth = window.speechSynthesis;
  synth.cancel();
  // Also stop any HTML audio elements if we were tracking them globally, 
  // but for now, individual components handle their own Audio object refs.
};

export const unlockAudio = () => {
    const synth = window.speechSynthesis;
    if (synth.paused) synth.resume();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0; u.rate = 10; u.text = ' '; 
    synth.speak(u);
};

const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
  if (isLoaded && cachedVoices.length > 0) return Promise.resolve(cachedVoices);
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const v = synth.getVoices();
    if (v.length > 0) { cachedVoices = v; isLoaded = true; resolve(v); return; }
    const handler = () => {
      const v = synth.getVoices();
      if (v.length > 0) { cachedVoices = v; isLoaded = true; synth.removeEventListener('voiceschanged', handler); resolve(v); }
    };
    synth.addEventListener('voiceschanged', handler);
    setTimeout(() => { synth.removeEventListener('voiceschanged', handler); resolve(synth.getVoices()); }, 2000);
  });
};

/**
 * Plays word audio.
 * 1. Tries to construct Youdao Online URL: https://dict.youdao.com/dictvoice?audio={word}&type={1|2}
 * 2. Falls back to Browser TTS.
 */
export const playWordAudio = async (text: string, accent: 'US' | 'UK' = 'US', speed: number = 1.0) => {
    if (!text) return;
    
    // Type 1 = UK, Type 2 = US
    const type = accent === 'UK' ? 1 : 2;
    // Youdao URL requires encoded text
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;

    try {
        await playUrl(url, speed);
    } catch (e) {
        // Fallback to TTS
        console.warn("Online audio failed, falling back to TTS", e);
        playTextToSpeech(text, accent, speed);
    }
};

/**
 * Plays arbitrary URL audio with a promise wrapper.
 */
export const playUrl = (url: string, playbackRate: number = 1.0): Promise<void> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
        audio.onended = () => resolve();
        audio.onerror = (e) => reject(e);
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => reject(error));
        }
    });
};

/**
 * Smart Sentence Player.
 * 1. If explicit audioUrl provided (e.g. from dictionary), play it.
 * 2. If not, try Youdao dictvoice (often works for short sentences too).
 * 3. Fallback to TTS.
 */
export const playSentenceAudio = async (text: string, explicitUrl?: string, accent: 'US' | 'UK' = 'US', speed: number = 1.0) => {
    if (explicitUrl) {
        try {
            await playUrl(explicitUrl, speed);
            return;
        } catch(e) { console.warn("Explicit URL failed"); }
    }

    // Try Youdao for sentences (it handles phrases well)
    // Note: Youdao dictvoice works for sentences too, usually type=2 (US) is safer default
    const type = accent === 'UK' ? 1 : 2;
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;
    
    try {
        await playUrl(url, speed);
    } catch (e) {
        playTextToSpeech(text, accent, speed);
    }
};

/**
 * Standard Browser TTS (Fallback)
 */
export const playTextToSpeech = async (text: string, accent: 'US' | 'UK' = 'US', rate: number = 1.0, repeat: number = 1) => {
  if (!text || repeat <= 0) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  if (synth.paused) synth.resume();

  try {
      const voices = await waitForVoices();
      const langTag = accent === 'UK' ? 'en-GB' : 'en-US';
      const targetVoice = voices.find(v => v.lang === langTag) || voices.find(v => v.lang.startsWith('en'));

      for (let i = 0; i < repeat; i++) {
        const utterance = new SpeechSynthesisUtterance(text);
        const safeRate = Math.max(0.1, Math.min(10, rate)); 
        utterance.rate = safeRate;
        utterance.pitch = 1.0;
        if (targetVoice) { utterance.voice = targetVoice; utterance.lang = targetVoice.lang; } 
        else { utterance.lang = langTag; }
        synth.speak(utterance);
      }
  } catch (err) {
      console.error("TTS Error", err);
  }
};
