import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function DisclaimerModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show disclaimer if user is logged in and has not accepted it in this session
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-400 relative my-auto space-y-4 text-slate-800">
        
        {/* Header Icon & Title */}
        <div className="text-center space-y-1.5 border-b border-slate-100 pb-4">
          <div className="w-14 h-14 bg-amber-100 border border-amber-300 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            ⚖️
          </div>
          <span className="inline-block text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-3 py-0.5 rounded-full">
            Important Notice · महत्वपूर्ण घोषणा
          </span>
          <h2 className="text-xl font-black text-slate-900">
            Investment & Risk Disclaimer
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            स्वैच्छिक सहमति पत्र एवं जोखिम अस्वीकरण
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs leading-relaxed max-h-[50vh] overflow-y-auto">
          
          <div className="flex gap-2.5 items-start">
            <span className="text-base flex-shrink-0">1️⃣</span>
            <div>
              <p className="font-extrabold text-slate-900">व्यक्तिगत मर्जी से निवेश (Voluntary Investment):</p>
              <p className="text-slate-600 mt-0.5">
                मैं यह प्रमाणित करता/करती हूँ कि मैं <strong>Solar Wealth</strong> प्लेटफॉर्म पर अपनी <strong>व्यक्तिगत मर्जी और स्वेच्छा</strong> से पैसे इन्वेस्ट कर रहा/रही हूँ।
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-start">
            <span className="text-base flex-shrink-0">2️⃣</span>
            <div>
              <p className="font-extrabold text-slate-900">कोई दबाव या फ़ोर्स नहीं (No Force / Compulsion):</p>
              <p className="text-slate-600 mt-0.5">
                मुझे किसी भी व्यक्ति, एजेंट या संस्था द्वारा निवेश करने के लिए <strong>कोई दबाव या फ़ोर्स नहीं</strong> किया गया है। यह मेरा पूर्णतः स्वतंत्र निर्णय है।
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-start">
            <span className="text-base flex-shrink-0">3️⃣</span>
            <div>
              <p className="font-extrabold text-slate-900">जोखिम एवं उत्तरदायित्व (Risk & Responsibility):</p>
              <p className="text-slate-600 mt-0.5">
                मैं सौर ऊर्जा व डिजिटल निवेश से जुड़े नियमों और वित्तीय पहलुओं को भली-भांति समझता/समझती हूँ। अपने सभी लेन-देन और वित्तीय निर्णयों का मैं स्वयं पूर्ण रूप से उत्तरदायी हूँ।
              </p>
            </div>
          </div>

          {/* English Summary */}
          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 italic bg-white p-2.5 rounded-xl">
            "I hereby confirm that I am investing on Solar Wealth purely of my own free will and personal choice. Nobody has coerced, forced, or pressured me. I accept full personal responsibility for my investments."
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          <button
            onClick={handleUnderstand}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-4 px-5 rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 text-sm tracking-wide"
          >
            <span>✓</span> I Understand & Agree (मैं समझ गया / सहमत हूँ)
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            इस बटन पर क्लिक करते ही आप नियमों से सहमत होते हैं।
          </p>
        </div>

      </div>
    </div>
  );
}
