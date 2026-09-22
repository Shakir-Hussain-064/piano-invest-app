import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function DisclaimerModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      const accepted = sessionStorage.getItem('disclaimer_accepted');
      if (!accepted) {
        setIsOpen(true);
      }
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleUnderstand = () => {
    sessionStorage.setItem('disclaimer_accepted', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-[360px] w-full p-4.5 shadow-2xl border border-amber-300 relative space-y-3 text-slate-800">
        
        {/* Compact Header */}
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-9 h-9 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center text-lg shadow-sm flex-shrink-0">
            ⚖️
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Declaration & Consent
            </span>
            <h2 className="text-sm font-black text-slate-900 leading-tight mt-0.5">
              Investment & Risk Disclaimer
            </h2>
          </div>
        </div>

        {/* Compact Content */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-[11px] leading-relaxed">
          <div className="flex gap-2 items-start">
            <span className="text-amber-600 font-bold flex-shrink-0">•</span>
            <p className="text-slate-700">
              मैं प्रमाणित करता हूँ कि मैं <strong>Solar Wealth</strong> पर अपनी <strong>व्यक्तिगत मर्जी और स्वेच्छा</strong> से निवेश कर रहा हूँ।
            </p>
          </div>

          <div className="flex gap-2 items-start">
            <span className="text-amber-600 font-bold flex-shrink-0">•</span>
            <p className="text-slate-700">
              मुझ पर निवेश करने के लिए किसी का <strong>कोई दबाव या फ़ोर्स (No Force/Compulsion) नहीं</strong> है।
            </p>
          </div>

          <div className="flex gap-2 items-start">
            <span className="text-amber-600 font-bold flex-shrink-0">•</span>
            <p className="text-slate-700">
              मैं सौर व वित्तीय जोखिमों को समझता हूँ तथा अपने निर्णयों का <strong>स्वयं उत्तरदायी</strong> हूँ।
            </p>
          </div>

          <p className="pt-1.5 border-t border-slate-200 text-[10px] text-slate-400 italic">
            "I invest purely of my own free will without any force. I accept full personal responsibility."
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleUnderstand}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 text-xs tracking-wide"
          >
            <span>✓</span> I Understand & Agree (मैं सहमत हूँ)
          </button>
        </div>

      </div>
    </div>
  );
}
