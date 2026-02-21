import React, { useState, useEffect, useRef } from 'react';
import { Shield, CheckCircle, AlertTriangle, MousePointer2, Activity, Lock, Cpu, FlaskConical, Zap, RefreshCw, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FEATURE_LABELS = [
  'VELOCITY_AVG', 'VELOCITY_VAR', 'ACCEL_MEAN', 'JITTER_RATIO', 'FITTS_DECEL', 'DIR_CHANGE_F', 'PAUSE_ENTROPY'
];

export default function App() {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'verifying' | 'verified' | 'failed'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [liveFeatures, setLiveFeatures] = useState<number[]>(new Array(7).fill(0));
  const [log, setLog] = useState<string[]>(['[SYSTEM] EchoCheck Core v1.0.4 initialized', '[SYSTEM] Awaiting biological input...']);
  const [isSimulating, setIsSimulating] = useState(false);

  const addLog = (msg: string) => {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  useEffect(() => {
    // Inject the EchoCheck widget script
    const script = document.createElement('script');
    script.src = '/cdn/echocheck.js';
    script.setAttribute('data-sitekey', 'DEMO_PUBLIC_KEY');
    script.async = true;
    document.body.appendChild(script);

    const handleVerified = (e: any) => {
      setStatus('verified');
      setToken(e.detail.token);
      addLog('VERIFICATION_SUCCESS: HMAC_SIGNED_TOKEN_ISSUED');
    };

    const handleFailed = (e: any) => {
      setStatus('failed');
      addLog(`VERIFICATION_FAILED: SCORE_${e.detail.score.toFixed(2)}`);
    };

    const handleFeatures = (e: any) => {
      setLiveFeatures(e.detail.features);
    };

    window.addEventListener('echocheck:verified', handleVerified);
    window.addEventListener('echocheck:failed', handleFailed);
    window.addEventListener('echocheck:features', handleFeatures);
    
    const timer = setTimeout(() => {
      setStatus('capturing');
      addLog('CAPTURE_MODE: ACTIVE');
    }, 1500);

    return () => {
      window.removeEventListener('echocheck:verified', handleVerified);
      window.removeEventListener('echocheck:failed', handleFailed);
      window.removeEventListener('echocheck:features', handleFeatures);
      clearTimeout(timer);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  const resetSession = (isSimulating = false) => {
    if ((window as any).EchoCheck) {
      (window as any).EchoCheck.reset(isSimulating);
      setStatus('capturing');
      setToken(null);
      setLiveFeatures(new Array(7).fill(0));
      addLog(isSimulating ? 'SIMULATION_INIT: ISOLATED_BUFFER' : 'SESSION_RESET: BUFFER_CLEARED');
    }
  };

  const simulateBot = (type: 'linear' | 'noise') => {
    if (isSimulating) return;
    setIsSimulating(true);
    resetSession(true);
    addLog(`SIMULATION_START: ${type.toUpperCase()}_BOT`);

    let x = 100, y = 100;
    const targetX = 800, targetY = 600;
    const steps = 150;
    let i = 0;

    const interval = setInterval(() => {
      let curX, curY;
      
      if (type === 'linear') {
        curX = x + (targetX - x) * (i / steps);
        curY = y + (targetY - y) * (i / steps);
      } else {
        // Noise bot: jittery but no natural variance
        curX = x + (targetX - x) * (i / steps) + (Math.random() - 0.5) * 50;
        curY = y + (targetY - y) * (i / steps) + (Math.random() - 0.5) * 50;
      }

      window.dispatchEvent(new CustomEvent('mousemove', {
        detail: { 
          clientX: curX, 
          clientY: curY, 
          isEchoCheckSim: true 
        },
        bubbles: true
      }));

      i++;
      if (i > steps) {
        clearInterval(interval);
        setIsSimulating(false);
        addLog(`SIMULATION_END: ${type.toUpperCase()}_BOT`);
      }
    }, 15);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E1E1E3] font-mono selection:bg-[#3B82F6] selection:text-white overflow-x-hidden">
      {/* Immersive Background */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 grid-background" />
        <div className="absolute inset-0 bg-radial-at-t from-blue-500/10 via-transparent to-transparent" />
      </div>

      <main className="relative max-w-6xl mx-auto p-6 md:p-12">
        {/* Top Navigation / Status Bar */}
        <nav className="flex justify-between items-center mb-12 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter">ECHOCHECK_OS</h1>
              <p className="text-[10px] opacity-40 uppercase tracking-widest">Biometric Security Interface</p>
            </div>
          </div>
          <div className="flex gap-8 text-[10px] uppercase tracking-widest opacity-60">
            <div className="flex flex-col items-end">
              <span>System_Uptime</span>
              <span className="text-blue-400">00:14:22:09</span>
            </div>
            <div className="flex flex-col items-end">
              <span>Encryption</span>
              <span className="text-emerald-400">AES_256_GCM</span>
            </div>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Monitor Area */}
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-[#151619] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-[#1C1D21] px-6 py-3 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-blue-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Biometric_Live_Feed</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500/20" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Feature Visualization */}
                  <div className="space-y-6">
                    {FEATURE_LABELS.map((label, idx) => (
                      <div key={label} className="space-y-2">
                        <div className="flex justify-between text-[9px] uppercase tracking-tighter opacity-50">
                          <span>{label}</span>
                          <span>{(liveFeatures[idx] * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${liveFeatures[idx] * 100}%` }}
                            transition={{ type: 'spring', stiffness: 100 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Central Status Display */}
                  <div className="flex flex-col items-center justify-center border-l border-white/5 pl-12">
                    <AnimatePresence mode="wait">
                      {status === 'verified' ? (
                        <motion.div 
                          key="verified"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center"
                        >
                          <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 flex items-center justify-center mb-6 relative">
                            <motion.div 
                              className="absolute inset-0 rounded-full border-4 border-emerald-500"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                            />
                            <CheckCircle size={48} className="text-emerald-500" />
                          </div>
                          <h3 className="text-2xl font-bold text-emerald-400 mb-2">HUMAN_CONFIRMED</h3>
                          <p className="text-[10px] opacity-40 uppercase tracking-widest">Signature Authenticated</p>
                        </motion.div>
                      ) : status === 'failed' ? (
                        <motion.div 
                          key="failed"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center"
                        >
                          <div className="w-24 h-24 rounded-full border-4 border-red-500/30 flex items-center justify-center mb-6 relative">
                            <AlertTriangle size={48} className="text-red-500" />
                          </div>
                          <h3 className="text-2xl font-bold text-red-500 mb-2">BOT_DETECTED</h3>
                          <p className="text-[10px] opacity-40 uppercase tracking-widest">Biometric Mismatch</p>
                          <button 
                            onClick={() => resetSession()}
                            className="mt-4 text-[9px] uppercase font-bold text-blue-400 hover:underline"
                          >
                            Retry_Capture
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="capturing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center"
                        >
                          <div className="w-24 h-24 rounded-full border-4 border-blue-500/10 flex items-center justify-center mb-6 relative">
                            <motion.div 
                              className="absolute inset-0 rounded-full border-t-4 border-blue-500"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                            <MousePointer2 size={32} className="text-blue-400 animate-pulse" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">SCANNING_INPUT...</h3>
                          <p className="text-[10px] opacity-40 uppercase tracking-widest">Awaiting Natural Movement</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {token && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 w-full bg-white/5 p-4 rounded-lg border border-white/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Lock size={12} className="text-emerald-400" />
                          <span className="text-[9px] uppercase font-bold text-emerald-400">Secure_Token_Generated</span>
                        </div>
                        <p className="text-[9px] opacity-40 break-all font-mono leading-relaxed">{token}</p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Bot Laboratory */}
            <section className="bg-[#151619] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-[#1C1D21] px-6 py-3 border-b border-white/10 flex items-center gap-2">
                <FlaskConical size={14} className="text-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Bot_Laboratory_v2</span>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-xs opacity-60 leading-relaxed">
                    Test the system's resilience by injecting simulated bot patterns. Observe how EchoCheck's heuristic engine identifies mathematical perfection.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => simulateBot('linear')}
                      disabled={isSimulating}
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-lg transition-all group disabled:opacity-30"
                    >
                      <Zap size={20} className="mb-2 text-amber-400 group-hover:scale-110 transition-transform" />
                      <p className="text-[10px] font-bold uppercase">Linear_Bot</p>
                      <p className="text-[8px] opacity-40 mt-1">Constant Velocity Scan</p>
                    </button>
                    <button 
                      onClick={() => simulateBot('noise')}
                      disabled={isSimulating}
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-lg transition-all group disabled:opacity-30"
                    >
                      <Terminal size={20} className="mb-2 text-purple-400 group-hover:scale-110 transition-transform" />
                      <p className="text-[10px] font-bold uppercase">Noise_Bot</p>
                      <p className="text-[8px] opacity-40 mt-1">Random Jitter Injection</p>
                    </button>
                  </div>
                </div>
                <div className="bg-black/40 rounded-lg p-4 border border-white/5 font-mono text-[9px] h-40 overflow-y-auto flex flex-col-reverse">
                  {log.map((entry, i) => (
                    <div key={i} className={`mb-1 ${entry.includes('SUCCESS') ? 'text-emerald-400' : entry.includes('SIMULATION') ? 'text-purple-400' : 'opacity-60'}`}>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Controls */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-[#151619] border border-white/10 rounded-xl p-6 shadow-2xl">
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <RefreshCw size={14} className="text-blue-400" />
                Session_Controls
              </h3>
              <button 
                onClick={() => resetSession()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
              >
                Reset_Capture_Buffer
              </button>
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <p className="text-[9px] uppercase opacity-40 mb-2">Threshold_Sensitivity</p>
                  <div className="flex justify-between items-end">
                    <span className="text-xl font-bold">0.65</span>
                    <span className="text-[9px] text-blue-400 uppercase">Dynamic_Adjust</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#151619] border border-white/10 rounded-xl p-6 shadow-2xl">
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6">Security_Heuristics</h3>
              <div className="space-y-4">
                {[
                  { label: 'Replay_Guard', status: 'ACTIVE', color: 'text-emerald-400' },
                  { label: 'Entropy_Check', status: 'ACTIVE', color: 'text-emerald-400' },
                  { label: 'Fitts_Law_V3', status: 'ACTIVE', color: 'text-emerald-400' },
                  { label: 'Sub_Perceptual', status: 'ACTIVE', color: 'text-emerald-400' }
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-[9px] uppercase opacity-60">{item.label}</span>
                    <span className={`text-[9px] font-bold ${item.color}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-20 border-t border-white/10 pt-8 flex justify-between items-center opacity-30 text-[9px] uppercase tracking-widest">
          <p>© 2026 EchoCheck AI // Neural Biometrics</p>
          <p>Terminal_ID: 0x882A_F92</p>
        </footer>
      </main>
    </div>
  );
}
