(function() {
  const CONFIG = {
    SAMPLE_RATE_MS: 10,
    MAX_POINTS: 300,
    CAPTURE_DURATION_MS: 2000,
    VERIFY_ENDPOINT: '/api/verify',
    MODEL_PATH: '/cdn/model.json',
    THRESHOLD: 0.65
  };

  class EchoCheck {
    constructor(siteKey) {
      this.siteKey = siteKey;
      this.points = [];
      this.isCapturing = true;
      this.startTime = performance.now();
      this.model = null;
      this.isUsingFallback = true;
      this.isVerified = false;
      this.token = null;
      this.isSimulating = false;

      // Store bound reference for reliable removal
      this._boundHandleMove = this.handleMove.bind(this);
      this.init();
    }

    async init() {
      console.log('EchoCheck: Initializing biometric capture...');
      window.addEventListener('mousemove', this._boundHandleMove, { passive: true });
      window.addEventListener('pointermove', this._boundHandleMove, { passive: true });
      
      await this.loadTF();
      await this.loadModel();
    }

    async loadTF() {
      if (window.tf) return;
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    async loadModel() {
      try {
        this.model = await tf.loadLayersModel(CONFIG.MODEL_PATH);
        this.isUsingFallback = false;
        console.log('EchoCheck: Model loaded from JSON.');
      } catch (e) {
        console.warn('EchoCheck: Model JSON load failed, falling back to heuristic scoring.');
        this.isUsingFallback = true;
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [7] }));
        model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        this.model = model;
      }
    }

    reset(isSimulating = false) {
      this.points = [];
      this.isCapturing = true;
      this.startTime = performance.now();
      this.isVerified = false;
      this.token = null;
      this.isSimulating = isSimulating;
      
      console.log(`EchoCheck: Session reset (Simulation: ${isSimulating})`);
      
      // Clean up and re-attach to ensure fresh state
      window.removeEventListener('mousemove', this._boundHandleMove);
      window.removeEventListener('pointermove', this._boundHandleMove);
      window.addEventListener('mousemove', this._boundHandleMove, { passive: true });
      window.addEventListener('pointermove', this._boundHandleMove, { passive: true });
    }

    handleMove(e) {
      if (!this.isCapturing) return;
      
      // Strict Isolation: 
      // If we are simulating, only accept events we explicitly tagged
      const isSimulatedEvent = e.detail && e.detail.isEchoCheckSim;
      
      if (this.isSimulating && !isSimulatedEvent) return;
      if (!this.isSimulating && isSimulatedEvent) return;

      const clientX = isSimulatedEvent ? e.detail.clientX : e.clientX;
      const clientY = isSimulatedEvent ? e.detail.clientY : e.clientY;

      const now = performance.now();
      if (this.points.length > 0) {
        const lastPoint = this.points[this.points.length - 1];
        if (now - lastPoint.t < CONFIG.SAMPLE_RATE_MS) return;
      }

      this.points.push({ x: clientX, y: clientY, t: now });

      if (this.points.length > CONFIG.MAX_POINTS) {
        this.points.shift();
      }

      if (this.points.length > 10) {
        const features = this.extractFeatures(this.points);
        window.dispatchEvent(new CustomEvent('echocheck:features', { detail: { features } }));
      }

      if (now - this.startTime > CONFIG.CAPTURE_DURATION_MS && this.points.length > 50) {
        this.finalize();
      }
    }

    async finalize() {
      this.isCapturing = false;
      window.removeEventListener('mousemove', this._boundHandleMove);
      window.removeEventListener('pointermove', this._boundHandleMove);

      const features = this.extractFeatures(this.points);
      const score = await this.predict(features);
      
      console.log('EchoCheck: Final Score:', score.toFixed(4));
      
      if (score > CONFIG.THRESHOLD) {
        await this.verifyServerSide(score);
      } else {
        window.dispatchEvent(new CustomEvent('echocheck:failed', { detail: { score } }));
      }
    }

    extractFeatures(points) {
      if (points.length < 2) return new Array(7).fill(0);

      const velocities = [];
      const accelerations = [];
      let pathLength = 0;
      let directionChanges = 0;
      let lastAngle = null;

      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const dt = (p2.t - p1.t) / 1000; // seconds
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        pathLength += dist;
        const v = dist / dt;
        velocities.push(v);

        if (i > 1) {
          const dv = v - velocities[velocities.length - 2];
          accelerations.push(dv / dt);
          
          const angle = Math.atan2(dy, dx);
          if (lastAngle !== null && Math.abs(angle - lastAngle) > 0.5) {
            directionChanges++;
          }
          lastAngle = angle;
        }
      }

      const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      const velocityVar = velocities.reduce((a, b) => a + Math.pow(b - avgVelocity, 2), 0) / velocities.length;
      const avgAccel = accelerations.reduce((a, b) => a + b, 0) / (accelerations.length || 1);
      
      const straightDist = Math.sqrt(
        Math.pow(points[points.length - 1].x - points[0].x, 2) +
        Math.pow(points[points.length - 1].y - points[0].y, 2)
      );
      
      const jitterRatio = pathLength / (straightDist || 1);
      
      // Fitts Law: Deceleration in final 20%
      const finalIndex = Math.floor(points.length * 0.8);
      const finalVelocities = velocities.slice(finalIndex);
      const initialVelocities = velocities.slice(0, finalIndex);
      const avgFinalV = finalVelocities.reduce((a, b) => a + b, 0) / (finalVelocities.length || 1);
      const avgInitialV = initialVelocities.reduce((a, b) => a + b, 0) / (initialVelocities.length || 1);
      const fittsRatio = avgFinalV / (avgInitialV || 1);

      const dirChangeFreq = directionChanges / (points.length || 1);
      
      // Pause entropy (simplified: ratio of small movements)
      const pauses = velocities.filter(v => v < 20).length; // Increased threshold for "pause"
      const pauseEntropy = pauses / velocities.length;

      return [
        this.normalize(avgVelocity, 0, 1500),
        this.normalize(velocityVar, 0, 50000),
        this.normalize(avgAccel, -300, 300),
        this.normalize(jitterRatio, 1, 1.5), // Humans usually have 1.01 to 1.2 jitter
        this.normalize(fittsRatio, 0, 1.5),
        this.normalize(dirChangeFreq, 0, 0.5),
        this.normalize(pauseEntropy, 0, 0.5)
      ];
    }

    normalize(val, min, max) {
      return Math.max(0, Math.min(1, (val - min) / (max - min)));
    }

    async predict(features) {
      // features = [avgVelocity, velocityVar, avgAccel, jitterRatio, fittsRatio, dirChangeFreq, pauseEntropy]
      
      let score = 0.4; // Lower base score

      if (this.model && !this.isUsingFallback) {
        try {
          const input = tf.tensor2d([features]);
          const prediction = this.model.predict(input);
          score = (await prediction.data())[0];
          input.dispose();
          prediction.dispose();
          return score;
        } catch (e) {
          console.warn('EchoCheck: Inference failed, using heuristic fallback');
        }
      }

      // --- Advanced Heuristic Scoring ---
      
      // 1. Velocity Variance (The "Bot Killer")
      // Bots have near-zero variance. Humans are messy.
      const vVar = features[1];
      if (vVar > 0.015) score += 0.25; // Good human variance
      else if (vVar < 0.002) score -= 0.5; // Scripted perfection

      // 2. Jitter Ratio (Micro-tremors)
      const jitter = features[3];
      if (jitter > 0.005) score += 0.2; 
      else if (jitter < 0.0001) score -= 0.5; // Perfectly straight line

      // 3. Fitts' Law (Deceleration)
      const fitts = features[4];
      if (fitts < 0.75) score += 0.15; // Strong biological deceleration
      else if (fitts > 0.95) score -= 0.2; // Constant speed (bot)

      // 4. Direction Changes
      const dirChanges = features[5];
      if (dirChanges > 0.05 && dirChanges < 0.4) score += 0.1;

      // 5. Pause Entropy
      const pauses = features[6];
      if (pauses > 0.05) score += 0.1;

      // Final clamping
      return Math.max(0, Math.min(1, score));
    }

    async verifyServerSide(score) {
      const nonce = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      
      try {
        const response = await fetch(CONFIG.VERIFY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score,
            nonce,
            siteKey: this.siteKey,
            timestamp: Date.now()
          })
        });

        const data = await response.json();
        if (data.success) {
          this.isVerified = true;
          this.token = data.token;
          this.dispatchSuccess();
        }
      } catch (e) {
        console.error('EchoCheck: Verification failed', e);
      }
    }

    dispatchSuccess() {
      const event = new CustomEvent('echocheck:verified', {
        detail: { token: this.token }
      });
      window.dispatchEvent(event);
      
      // Auto-inject into forms if they have a data-echocheck attribute
      document.querySelectorAll('form[data-echocheck]').forEach(form => {
        let input = form.querySelector('input[name="echocheck-token"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'echocheck-token';
          form.appendChild(input);
        }
        input.value = this.token;
      });
    }
  }

  // Auto-init
  const scriptTag = document.currentScript;
  const siteKey = scriptTag ? scriptTag.getAttribute('data-sitekey') : 'DEFAULT_KEY';
  window.EchoCheck = new EchoCheck(siteKey);

})();
