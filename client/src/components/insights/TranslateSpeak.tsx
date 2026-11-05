import React, { useEffect, useState } from 'react';
import { Volume2, Square, Languages } from 'lucide-react';
import { InsightsApi } from '../../services/insightsApi.js';

type Lang = 'en' | 'hi' | 'mr';
const SPEECH_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
const LABEL: Record<Lang, string> = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };

function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() || [];
  const code = SPEECH_LANG[lang].toLowerCase();
  return voices.find(v => v.lang.toLowerCase() === code) || voices.find(v => v.lang.toLowerCase().startsWith(code.slice(0, 2))) || null;
}

/**
 * Read-aloud (browser speech synthesis, nothing leaves the device) plus optional Hindi/Marathi
 * translation of Legal Buddy's own explanation through the server's configured AI provider.
 */
export const TranslateSpeak: React.FC<{
  documentId: string;
  englishText: string;
  kind: 'summary' | 'clause';
  clauseId?: string;
}> = ({ documentId, englishText, kind, clauseId }) => {
  const [lang, setLang] = useState<Lang>('en');
  const [texts, setTexts] = useState<Partial<Record<Lang, string>>>({ en: englishText });
  const [loading, setLoading] = useState<Lang | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => { if (speechSupported) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { setTexts(t => ({ ...t, en: englishText })); }, [englishText]);

  const choose = async (next: Lang) => {
    setError(null);
    stop();
    setLang(next);
    if (texts[next] || next === 'en') return;
    setLoading(next);
    try {
      const r = await InsightsApi.translate(documentId, next, kind, clauseId);
      setTexts(t => ({ ...t, [next]: r.text }));
      setNotice(r.notice);
    } catch (e: any) {
      setError(e.message);
      setLang('en');
    } finally {
      setLoading(null);
    }
  };

  const speak = () => {
    const text = texts[lang];
    if (!speechSupported || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LANG[lang];
    const voice = voiceFor(lang);
    if (voice) utter.voice = voice;
    else if (lang !== 'en') setError(`No ${LABEL[lang]} voice is installed on this device. You can still read the translation below.`);
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };
  const stop = () => { if (speechSupported) window.speechSynthesis.cancel(); setSpeaking(false); };

  return (
    <div className="lb-translate">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Languages size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        {(['en', 'hi', 'mr'] as Lang[]).map(l => (
          <button key={l} type="button" className={`btn btn-sm ${lang === l ? 'btn-primary' : 'btn-secondary'}`} onClick={() => choose(l)} disabled={loading !== null} aria-pressed={lang === l}>
            {loading === l ? 'Translating…' : LABEL[l]}
          </button>
        ))}
        {speechSupported && (speaking
          ? <button type="button" className="btn btn-sm btn-secondary" onClick={stop}><Square size={13} /> Stop</button>
          : <button type="button" className="btn btn-sm btn-secondary" onClick={speak} disabled={!texts[lang]}><Volume2 size={13} /> Read aloud</button>)}
      </div>
      {error && <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', marginTop: 6 }}>{error}</p>}
      {lang !== 'en' && texts[lang] && (
        <div style={{ marginTop: 8 }}>
          <p lang={lang} style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)', lineHeight: 1.7 }}>{texts[lang]}</p>
          {notice && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{notice}</p>}
        </div>
      )}
    </div>
  );
};
