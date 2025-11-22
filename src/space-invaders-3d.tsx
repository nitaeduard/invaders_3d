import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type PowerupType = 'shield' | 'rapid' | 'spread' | 'laser';

const SpaceInvaders3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);
  const [wave, setWave] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [combo, setCombo] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [shield, setShield] = useState<number>(0);
  const [powerup, setPowerup] = useState<string | null>(null);
  const [dashCooldown, setDashCooldown] = useState<number>(0);
  const [slowCooldown, setSlowCooldown] = useState<number>(0);
  const [bombCooldown, setBombCooldown] = useState<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;

    const loadHighScore = async () => {
      try {
        const saved = localStorage.getItem('space-invaders-highscore');
        if (saved) {
          setHighScore(parseInt(saved, 10));
        }
      } catch (err) {
        // Keep silent if storage is not available
        console.log('No high score found');
      }
    };
    loadHighScore();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);
    scene.fog = new THREE.Fog(0x000510, 50, 150);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 10, 10);
    scene.add(directionalLight);

    const nebulaGeometry = new THREE.SphereGeometry(100, 32, 32);
    const nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          float dist = length(uv);
          vec3 color1 = vec3(0.1, 0.0, 0.3);
          vec3 color2 = vec3(0.3, 0.0, 0.5);
          vec3 color = mix(color1, color2, sin(dist * 3.0 + time * 0.5) * 0.5 + 0.5);
          gl_FragColor = vec4(color * 0.3, 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    scene.add(nebula);

    const createShip = (color: number, emissive: number) => {
      const shipGroup = new THREE.Group();

      const bodyGeometry = new THREE.ConeGeometry(0.5, 2, 4);
      const bodyMaterial = new THREE.MeshPhongMaterial({ color: color, emissive: emissive });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.x = Math.PI / 2;
      shipGroup.add(body);

      const wingGeometry = new THREE.BoxGeometry(2, 0.2, 1);
      const wingMaterial = new THREE.MeshPhongMaterial({ color: color, emissive: emissive });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-1.5, 0, 0);
      shipGroup.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(1.5, 0, 0);
      shipGroup.add(rightWing);

      const tipGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const tipMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0x444400 });
      const leftTip = new THREE.Mesh(tipGeometry, tipMaterial);
      leftTip.position.set(-2.5, 0, 0);
      shipGroup.add(leftTip);

      const rightTip = new THREE.Mesh(tipGeometry, tipMaterial);
      rightTip.position.set(2.5, 0, 0);
      shipGroup.add(rightTip);

      return shipGroup;
    };

    const ship1 = createShip(0x00ff00, 0x004400);
    ship1.position.set(-2, 0, 0);
    scene.add(ship1);

    const ship2 = createShip(0x0000ff, 0x000044);
    ship2.position.set(2, 0, 0);
    scene.add(ship2);

    const shieldGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const shieldMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    const shield1 = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shield1.visible = false;
    ship1.add(shield1);

    const shield2 = new THREE.Mesh(shieldGeometry, shieldMaterial.clone());
    shield2.visible = false;
    ship2.add(shield2);

    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, -10);

    // Make AudioContext creation TS-safe
    const AudioConstructor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioContext: AudioContext = new AudioConstructor();
    let audioInitialized = false;
    let alarmOscillator: OscillatorNode | null = null;
    let alarmGain: GainNode | null = null;

    const initAudio = () => {
      if (!audioInitialized) {
        audioContext.resume();
        audioInitialized = true;
      }
    };

    const startAlarm = () => {
      if (alarmOscillator) return;

      initAudio();
      alarmOscillator = audioContext.createOscillator();
      alarmGain = audioContext.createGain();

      alarmOscillator.connect(alarmGain);
      alarmGain.connect(audioContext.destination);

      alarmOscillator.type = 'sine';
      alarmOscillator.frequency.value = 880;

      if (alarmGain) alarmGain.gain.value = 0.2;

      alarmOscillator.start();

      // store id so we can clear if needed
      const alarmToggleId = window.setInterval(() => {
        if (alarmOscillator) {
          alarmOscillator.frequency.value = alarmOscillator.frequency.value === 880 ? 1100 : 880;
        }
      }, 200);
      // keep interval id in alarmGain.userData for cleanup if desired (not necessary here)
      (alarmGain as any).__toggleId = alarmToggleId;
    };

    const stopAlarm = () => {
      if (alarmOscillator) {
        try {
          alarmOscillator.stop();
        } catch (e) {
          // ignore stop errors
        }
        alarmOscillator = null;
        alarmGain = null;
      }
    };

    const playShootSound = () => {
      initAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    };

    const playExplosionSound = (enemyType: string) => {
      initAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sawtooth';

      if (enemyType === 'tank') {
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (enemyType === 'scout') {
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.stop(audioContext.currentTime + 0.15);
      } else {
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.stop(audioContext.currentTime + 0.2);
      }

      oscillator.start(audioContext.currentTime);
    };

    const playLevelCompleteSound = () => {
      initAudio();

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

          gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        }, i * 150);
      });
    };

    const stars: THREE.Mesh[] = [];
    const starGeometry = new THREE.SphereGeometry(0.05, 4, 4);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < 200; i++) {
      const star = new THREE.Mesh(starGeometry, starMaterial);
      const angle = Math.random() * Math.PI * 2;
      const distance = 15 + Math.random() * 30;
      star.position.set(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        Math.random() * -100 - 20
      );
      scene.add(star);
      stars.push(star);
    }

    // Create crosshairs for both players
    const createCrosshair = (color: number) => {
      const group = new THREE.Group();
      const crosshairMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4
      });

      const verticalGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.4, 0),
        new THREE.Vector3(0, 0.4, 0)
      ]);
      const verticalLine = new THREE.Line(verticalGeometry, crosshairMaterial);
      group.add(verticalLine);

      const horizontalGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.4, 0, 0),
        new THREE.Vector3(0.4, 0, 0)
      ]);
      const horizontalLine = new THREE.Line(horizontalGeometry, crosshairMaterial);
      group.add(horizontalLine);

      const dotGeometry = new THREE.SphereGeometry(0.06, 8, 8);
      const dotMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6
      });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      group.add(dot);

      return group;
    };

    // Player 1 crosshairs (green)
    const leftCrosshair1 = createCrosshair(0x00ff00);
    const rightCrosshair1 = createCrosshair(0x00ff00);
    leftCrosshair1.position.set(-2.5, 0, -40);
    rightCrosshair1.position.set(2.5, 0, -40);
    scene.add(leftCrosshair1);
    scene.add(rightCrosshair1);

    // Player 2 crosshairs (blue)
    const leftCrosshair2 = createCrosshair(0x0000ff);
    const rightCrosshair2 = createCrosshair(0x0000ff);
    leftCrosshair2.position.set(-2.5, 0, -40);
    rightCrosshair2.position.set(2.5, 0, -40);
    scene.add(leftCrosshair2);
    scene.add(rightCrosshair2);

    let enemies: THREE.Group[] = [];
    const bullets: THREE.Mesh[] = [];
    const enemyBullets: THREE.Mesh[] = [];
    const particles: THREE.Mesh[] = [];
    const muzzleFlashes: THREE.Mesh[] = [];
    const powerups: THREE.Mesh[] = [];
    const keys1 = { left: false, right: false, up: false, down: false, space: false, dash: false, slow: false, bomb: false };
    const keys2 = { left: false, right: false, up: false, down: false, space: false, dash: false, slow: false, bomb: false };
    let enemySpeed = 0.015;
    let lastShot1 = 0;
    let lastShot2 = 0;
    let alternateGun1 = false;
    let alternateGun2 = false;
    let currentScore = 0;
    let currentLevel = 1;
    let currentWave = 1;
    let currentLives = 3;
    let currentHighScore = 0;
    let currentShield = 0;
    let currentPowerup: string | null = null;
    let powerupEndTime = 0;
    let isGameOver = false;
    let isPaused = false;
    let currentTimeLeft = 60;
    let lastTimeUpdate = Date.now();
    let isInvincible = false;
    let flickerInterval: number | null = null;
    let cameraShake = { x: 0, y: 0, intensity: 0 };
    let currentCombo = 0;
    let currentMultiplier = 1;
    let lastKillTime = 0;
    let comboTimeout: number | null = null;
    let timeScale = 1;
    let dashCooldownTime = 0;
    let slowCooldownTime = 0;
    let bombCooldownTime = 0;
    let wavesPerLevel = 3;

    const shakeScreen = (intensity: number) => {
      cameraShake.intensity = intensity;
    };

    const addKill = () => {
      const now = Date.now();
      if (now - lastKillTime < 2000) {
        currentCombo++;
        currentMultiplier = Math.min(1 + Math.floor(currentCombo / 3), 5);
      } else {
        currentCombo = 1;
        currentMultiplier = 1;
      }
      lastKillTime = now;
      setCombo(currentCombo);
      setMultiplier(currentMultiplier);

      if (comboTimeout) window.clearTimeout(comboTimeout);
      comboTimeout = window.setTimeout(() => {
        currentCombo = 0;
        currentMultiplier = 1;
        setCombo(0);
        setMultiplier(1);
      }, 2000) as unknown as number;
    };

    const createExplosion = (position: THREE.Vector3, color: THREE.Color) => {
      const particleCount = 8;
      const particleGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const particleMaterial = new THREE.MeshBasicMaterial({ color: color });

      for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);

        particle.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3
        );
        particle.userData.rotationSpeed = new THREE.Vector3(
          Math.random() * 0.2,
          Math.random() * 0.2,
          Math.random() * 0.2
        );
        particle.userData.lifetime = 60;
        particle.userData.age = 0;

        scene.add(particle);
        particles.push(particle);
      }
    };

    const createMuzzleFlash = (position: THREE.Vector3) => {
      const flashGeometry = new THREE.SphereGeometry(0.3, 8, 8);
      const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 1
      });
      const flash = new THREE.Mesh(flashGeometry, flashMaterial);
      flash.position.copy(position);
      flash.userData.lifetime = 5;
      flash.userData.age = 0;
      scene.add(flash);
      muzzleFlashes.push(flash);
    };

    const createPowerup = (position: THREE.Vector3) => {
      if (Math.random() > 0.3) return;

      const types: PowerupType[] = ['shield', 'rapid', 'spread', 'laser'];
      const type = types[Math.floor(Math.random() * types.length)] as PowerupType;

      const colors: Record<PowerupType, number> = {
        shield: 0x00ffff,
        rapid: 0xff00ff,
        spread: 0xffff00,
        laser: 0xff0000
      };

      const powerupGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const powerupMaterial = new THREE.MeshBasicMaterial({ color: colors[type] });
      const powerup = new THREE.Mesh(powerupGeometry, powerupMaterial);
      powerup.position.copy(position);
      powerup.userData.type = type;
      powerup.userData.velocity = 0.1;
      scene.add(powerup);
      powerups.push(powerup);
    };

    const createEnemies = (lvl: number, wv: number, formation: 'wall' | 'circle' | 'v' = 'wall') => {
      const rows = 3 + Math.floor(lvl / 2);
      const cols = 5 + Math.floor(lvl / 2);
      const startZ = -40 - (lvl * 5);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const enemyGroup = new THREE.Group();

          let enemyType: string = 'normal';
          const rand = Math.random();
          if (lvl >= 3 && rand < 0.2) enemyType = 'scout';
          else if (lvl >= 5 && rand < 0.15) enemyType = 'tank';
          else if (lvl >= 7 && rand < 0.1) enemyType = 'zigzag';

          const hue = (lvl * 0.1 + row * 0.1) % 1;
          let enemyColor: THREE.Color, enemyEmissive: THREE.Color, scale: number, health: number, speed: number;

          if (enemyType === 'scout') {
            enemyColor = new THREE.Color(0xff00ff);
            enemyEmissive = new THREE.Color(0x440044);
            scale = 0.7;
            health = 1;
            speed = 2.5;
          } else if (enemyType === 'tank') {
            enemyColor = new THREE.Color(0xff8800);
            enemyEmissive = new THREE.Color(0x442200);
            scale = 1.4;
            health = 3;
            speed = 0.6;
          } else if (enemyType === 'zigzag') {
            enemyColor = new THREE.Color(0x00ffff);
            enemyEmissive = new THREE.Color(0x004444);
            scale = 1;
            health = 2;
            speed = 1.3;
          } else {
            enemyColor = new THREE.Color().setHSL(hue, 1, 0.5);
            enemyEmissive = new THREE.Color().setHSL(hue, 1, 0.2);
            scale = 1;
            health = 1;
            speed = 1;
          }

          const enemyMaterial = new THREE.MeshPhongMaterial({
            color: enemyColor,
            emissive: enemyEmissive
          });

          const bodyGeometry = new THREE.BoxGeometry(1.2, 0.8, 0.6);
          const body = new THREE.Mesh(bodyGeometry, enemyMaterial);
          enemyGroup.add(body);

          const legGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.3);
          const leftLeg = new THREE.Mesh(legGeometry, enemyMaterial);
          leftLeg.position.set(-0.4, -0.5, 0);
          enemyGroup.add(leftLeg);

          const rightLeg = new THREE.Mesh(legGeometry, enemyMaterial);
          rightLeg.position.set(0.4, -0.5, 0);
          enemyGroup.add(rightLeg);

          const antennaGeometry = new THREE.BoxGeometry(0.2, 0.4, 0.2);
          const leftAntenna = new THREE.Mesh(antennaGeometry, enemyMaterial);
          leftAntenna.position.set(-0.5, 0.5, 0);
          enemyGroup.add(leftAntenna);

          const rightAntenna = new THREE.Mesh(antennaGeometry, enemyMaterial);
          rightAntenna.position.set(0.5, 0.5, 0);
          enemyGroup.add(rightAntenna);

          const eyeGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.3);
          const eyeMaterial = new THREE.MeshPhongMaterial({
            color: 0x000000,
            emissive: enemyEmissive
          });
          const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
          leftEye.position.set(-0.3, 0.1, 0.4);
          enemyGroup.add(leftEye);

          const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
          rightEye.position.set(0.3, 0.1, 0.4);
          enemyGroup.add(rightEye);

          enemyGroup.scale.set(scale, scale, scale);

          let xPos: number, yPos: number;
          if (formation === 'circle') {
            const angle = (col / cols) * Math.PI * 2;
            const radius = 10;
            xPos = Math.cos(angle) * radius;
            yPos = Math.sin(angle) * radius;
          } else if (formation === 'v') {
            xPos = col * 2.5 - (cols * 2.5) / 2 + 1.25;
            yPos = Math.abs(col - cols / 2) * 1.5 + row * 2.5 - (rows * 2.5) / 2;
          } else {
            xPos = col * 2.5 - (cols * 2.5) / 2 + 1.25;
            yPos = row * 2.5 - (rows * 2.5) / 2 + 1.25;
          }

          enemyGroup.position.set(xPos, yPos, startZ);

          enemyGroup.userData.alive = true;
          enemyGroup.userData.color = enemyColor;
          enemyGroup.userData.type = enemyType;
          enemyGroup.userData.health = health;
          enemyGroup.userData.maxHealth = health;
          enemyGroup.userData.speed = speed;
          enemyGroup.userData.zigzagTime = 0;
          enemyGroup.userData.circleTime = 0;
          enemyGroup.userData.originalX = xPos;
          enemyGroup.userData.originalY = yPos;
          enemyGroup.userData.formation = formation;

          scene.add(enemyGroup);
          enemies.push(enemyGroup);
        }
      }

      enemySpeed = 0.015 + (lvl * 0.005);
    };

    const formations: Array<'wall' | 'circle' | 'v'> = ['wall', 'circle', 'v'];
    createEnemies(currentLevel, currentWave, formations[currentWave % formations.length]);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys1.left = true;
      if (e.key === 'ArrowRight') keys1.right = true;
      if (e.key === 'ArrowUp') keys1.up = true;
      if (e.key === 'ArrowDown') keys1.down = true;
      if (e.key === ' ') keys1.space = true;
      if (e.key === 'Shift') keys1.dash = true;
      if (e.key === 'Control') keys1.slow = true;
      if (e.key === 'Alt') keys1.bomb = true;

      if (e.key === 'a') keys2.left = true;
      if (e.key === 'd') keys2.right = true;
      if (e.key === 'w') keys2.up = true;
      if (e.key === 's') keys2.down = true;
      if (e.key === 'f') keys2.space = true;
      if (e.key === 'q') keys2.dash = true;
      if (e.key === 'e') keys2.slow = true;
      if (e.key === 'r') keys2.bomb = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys1.left = false;
      if (e.key === 'ArrowRight') keys1.right = false;
      if (e.key === 'ArrowUp') keys1.up = false;
      if (e.key === 'ArrowDown') keys1.down = false;
      if (e.key === ' ') keys1.space = false;
      if (e.key === 'Shift') keys1.dash = false;
      if (e.key === 'Control') keys1.slow = false;
      if (e.key === 'Alt') keys1.bomb = false;

      if (e.key === 'a') keys2.left = false;
      if (e.key === 'd') keys2.right = false;
      if (e.key === 'w') keys2.up = false;
      if (e.key === 's') keys2.down = false;
      if (e.key === 'f') keys2.space = false;
      if (e.key === 'q') keys2.dash = false;
      if (e.key === 'e') keys2.slow = false;
      if (e.key === 'r') keys2.bomb = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const shoot = (ship: THREE.Object3D, isPlayer1: boolean) => {
      const bulletGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

      const alternateGun = isPlayer1 ? alternateGun1 : alternateGun2;

      if (currentPowerup === 'spread') {
        for (let i = -1; i <= 1; i++) {
          const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
          bullet.position.set(ship.position.x + i * 1.5, ship.position.y, ship.position.z - 1);
          bullet.userData.active = true;
          bullet.userData.player = isPlayer1 ? 1 : 2;
          scene.add(bullet);
          bullets.push(bullet);
          createMuzzleFlash(bullet.position.clone());
        }
      } else if (currentPowerup === 'laser') {
        const laserGeometry = new THREE.CylinderGeometry(0.1, 0.1, 50, 8);
        const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        laser.rotation.x = Math.PI / 2;
        laser.position.set(ship.position.x, ship.position.y, ship.position.z - 25);
        laser.userData.active = true;
        laser.userData.player = isPlayer1 ? 1 : 2;
        laser.userData.lifetime = 10;
        laser.userData.age = 0;
        scene.add(laser);
        bullets.push(laser);
      } else {
        const xOffset = alternateGun ? -2.5 : 2.5;
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.set(ship.position.x + xOffset, ship.position.y, ship.position.z - 1);
        bullet.userData.active = true;
        bullet.userData.player = isPlayer1 ? 1 : 2;
        scene.add(bullet);
        bullets.push(bullet);
        createMuzzleFlash(bullet.position.clone());
      }

      if (isPlayer1) alternateGun1 = !alternateGun1;
      else alternateGun2 = !alternateGun2;

      playShootSound();
    };

    const startNextWave = () => {
      isPaused = true;

      setTimeout(() => {
        bullets.forEach(bullet => scene.remove(bullet));
        bullets.length = 0;

        enemyBullets.forEach(bullet => scene.remove(bullet));
        enemyBullets.length = 0;

        enemies.forEach(enemy => scene.remove(enemy));
        enemies = [];

        currentWave++;

        if (currentWave > wavesPerLevel) {
          currentLevel++;
          currentWave = 1;
          setLevel(currentLevel);
          currentTimeLeft = 60;
          setTimeLeft(60);
        }

        setWave(currentWave);
        lastTimeUpdate = Date.now();

        createEnemies(currentLevel, currentWave, formations[currentWave % formations.length]);

        isPaused = false;
      }, 2000);
    };

    const saveHighScore = async (sc: number) => {
      try {
        localStorage.setItem('space-invaders-highscore', sc.toString());
      } catch (err) {
        console.error('Failed to save high score:', err);
      }
    };

    const animate = () => {
      if (isGameOver) return;
      requestAnimationFrame(animate);

      if (isPaused) {
        renderer.render(scene, camera);
        return;
      }

      const now = Date.now();

      nebulaMaterial.uniforms.time.value = now * 0.001;

      // Update cooldowns
      if (dashCooldownTime > 0) {
        dashCooldownTime -= 16 * timeScale;
        setDashCooldown(Math.max(0, Math.ceil(dashCooldownTime / 1000)));
      }
      if (slowCooldownTime > 0) {
        slowCooldownTime -= 16 * timeScale;
        setSlowCooldown(Math.max(0, Math.ceil(slowCooldownTime / 1000)));
      }
      if (bombCooldownTime > 0) {
        bombCooldownTime -= 16 * timeScale;
        setBombCooldown(Math.max(0, Math.ceil(bombCooldownTime / 1000)));
      }

      // Update powerup
      if (currentPowerup && now > powerupEndTime) {
        currentPowerup = null;
        setPowerup(null);
      }

      // Reset time scale
      if (timeScale < 1) {
        timeScale = Math.min(1, timeScale + 0.01);
      }

      if (now - lastTimeUpdate >= 1000) {
        currentTimeLeft--;
        setTimeLeft(currentTimeLeft);
        lastTimeUpdate = now;

        if (currentTimeLeft <= 0) {
          currentLives--;
          setLives(currentLives);
          if (currentLives <= 0) {
            isGameOver = true;
            setGameOver(true);
            if (currentScore > currentHighScore) {
              currentHighScore = currentScore;
              setHighScore(currentScore);
              saveHighScore(currentScore);
            }
          } else {
            currentTimeLeft = 60;
            setTimeLeft(60);
          }
        }
      }

      if (cameraShake.intensity > 0) {
        cameraShake.x = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.y = (Math.random() - 0.5) * cameraShake.intensity;
        camera.position.x = cameraShake.x;
        camera.position.y = 8 + cameraShake.y;
        cameraShake.intensity *= 0.9;
        if (cameraShake.intensity < 0.01) {
          cameraShake.intensity = 0;
          camera.position.x = 0;
          camera.position.y = 8;
        }
      }

      stars.forEach(star => {
        star.position.z += 0.2;
        if (star.position.z > 15) {
          star.position.z = Math.random() * -100 - 20;
          const angle = Math.random() * Math.PI * 2;
          const distance = 15 + Math.random() * 30;
          star.position.x = Math.cos(angle) * distance;
          star.position.y = Math.sin(angle) * distance;
        }
      });

      particles.forEach((particle, index) => {
        particle.userData.age++;
        particle.position.add(particle.userData.velocity);
        particle.rotation.x += particle.userData.rotationSpeed.x;
        particle.rotation.y += particle.userData.rotationSpeed.y;
        particle.rotation.z += particle.userData.rotationSpeed.z;

        const life = 1 - (particle.userData.age / particle.userData.lifetime);
        (particle.material as THREE.Material & { opacity?: number }).opacity = life;
        (particle.material as THREE.Material & { transparent?: boolean }).transparent = true;

        if (particle.userData.age >= particle.userData.lifetime) {
          scene.remove(particle);
          particles.splice(index, 1);
        }
      });

      muzzleFlashes.forEach((flash, index) => {
        flash.userData.age++;
        (flash.material as THREE.Material & { opacity?: number }).opacity = 1 - (flash.userData.age / flash.userData.lifetime);
        if (flash.userData.age >= flash.userData.lifetime) {
          scene.remove(flash);
          muzzleFlashes.splice(index, 1);
        }
      });

      // Update powerups
      powerups.forEach((powerupMesh, index) => {
        powerupMesh.position.z += powerupMesh.userData.velocity;
        powerupMesh.rotation.y += 0.05;

        // Check collision with ships
        const dist1 = powerupMesh.position.distanceTo(ship1.position);
        const dist2 = powerupMesh.position.distanceTo(ship2.position);

        if (dist1 < 1.5 || dist2 < 1.5) {
          if (powerupMesh.userData.type === 'shield') {
            currentShield += 3;
            setShield(currentShield);
            shield1.visible = true;
            shield2.visible = true;
          } else {
            currentPowerup = powerupMesh.userData.type;
            powerupEndTime = now + 10000;
            setPowerup(currentPowerup);
          }
          scene.remove(powerupMesh);
          powerups.splice(index, 1);
        } else if (powerupMesh.position.z > 15) {
          scene.remove(powerupMesh);
          powerups.splice(index, 1);
        }
      });

      // Ship 1 controls
      if (keys1.left && ship1.position.x > -10) ship1.position.x -= 0.15;
      if (keys1.right && ship1.position.x < 10) ship1.position.x += 0.15;
      if (keys1.up && ship1.position.y < 8) ship1.position.y += 0.15;
      if (keys1.down && ship1.position.y > -8) ship1.position.y -= 0.15;

      // Ship 2 controls
      if (keys2.left && ship2.position.x > -10) ship2.position.x -= 0.15;
      if (keys2.right && ship2.position.x < 10) ship2.position.x += 0.15;
      if (keys2.up && ship2.position.y < 8) ship2.position.y += 0.15;
      if (keys2.down && ship2.position.y > -8) ship2.position.y -= 0.15;

      // Update crosshairs to follow ships and match enemy depth
      const nearestEnemyZ = enemies.reduce((nearest, enemy) => {
        if (!enemy.userData.alive) return nearest;
        return enemy.position.z > nearest ? enemy.position.z : nearest;
      }, -100);

      // Player 1 crosshairs
      leftCrosshair1.position.x = ship1.position.x - 2.5;
      leftCrosshair1.position.y = ship1.position.y;
      leftCrosshair1.position.z = nearestEnemyZ;

      rightCrosshair1.position.x = ship1.position.x + 2.5;
      rightCrosshair1.position.y = ship1.position.y;
      rightCrosshair1.position.z = nearestEnemyZ;

      // Player 2 crosshairs
      leftCrosshair2.position.x = ship2.position.x - 2.5;
      leftCrosshair2.position.y = ship2.position.y;
      leftCrosshair2.position.z = nearestEnemyZ;

      rightCrosshair2.position.x = ship2.position.x + 2.5;
      rightCrosshair2.position.y = ship2.position.y;
      rightCrosshair2.position.z = nearestEnemyZ;

      // Abilities
      if (keys1.dash && dashCooldownTime <= 0) {
        ship1.position.z -= 5;
        setTimeout(() => { ship1.position.z += 5; }, 200);
        dashCooldownTime = 5000;
        keys1.dash = false;
      }
      if (keys1.slow && slowCooldownTime <= 0) {
        timeScale = 0.3;
        slowCooldownTime = 15000;
        setTimeout(() => { timeScale = 1; }, 5000);
        keys1.slow = false;
      }
      if (keys1.bomb && bombCooldownTime <= 0) {
        enemies.forEach(enemy => {
          if (enemy.userData.alive && enemy.position.z > -30) {
            enemy.userData.health = 0;
          }
        });
        bombCooldownTime = 20000;
        shakeScreen(1);
        keys1.bomb = false;
      }

      const fireRate = currentPowerup === 'rapid' ? 100 : 250;
      if (keys1.space && now - lastShot1 > fireRate) {
        shoot(ship1, true);
        lastShot1 = now;
      }
      if (keys2.space && now - lastShot2 > fireRate) {
        shoot(ship2, false);
        lastShot2 = now;
      }

      bullets.forEach((bullet, index) => {
        if (!bullet.userData.active) return;

        if (bullet.userData.lifetime !== undefined) {
          bullet.userData.age++;
          if (bullet.userData.age >= bullet.userData.lifetime) {
            bullet.userData.active = false;
            scene.remove(bullet);
            bullets.splice(index, 1);
            return;
          }
        }

        bullet.position.z -= 0.6 * timeScale;
        if (bullet.position.z < -60) {
          bullet.userData.active = false;
          scene.remove(bullet);
          bullets.splice(index, 1);
        }
      });

      if (currentLevel >= 2 && enemyBullets.length === 0) {
        const shootingChance = 0.001 * currentLevel * timeScale;
        enemies.forEach(enemy => {
          if (!enemy.userData.alive || enemyBullets.length > 0) return;
          if (Math.random() < shootingChance) {
            const enemyBulletGeometry = new THREE.CylinderGeometry(0.2, 0.2, 5, 8);
            const enemyBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const enemyBullet = new THREE.Mesh(enemyBulletGeometry, enemyBulletMaterial);
            enemyBullet.position.copy(enemy.position);
            enemyBullet.rotation.x = Math.PI / 2;
            enemyBullet.userData.active = true;
            enemyBullet.userData.health = 2;
            scene.add(enemyBullet);
            enemyBullets.push(enemyBullet);
            startAlarm();
          }
        });
      }

      enemyBullets.forEach((bullet, index) => {
        if (!bullet.userData.active) return;
        bullet.position.z += 0.4 * timeScale;

        // Check if player bullets can destroy enemy bullets
        bullets.forEach((playerBullet, pIndex) => {
          if (!playerBullet.userData.active) return;
          const dist = bullet.position.distanceTo(playerBullet.position);
          if (dist < 1) {
            bullet.userData.health--;
            if (bullet.userData.health <= 0) {
              bullet.userData.active = false;
              scene.remove(bullet);
              enemyBullets.splice(index, 1);
              stopAlarm();
              createExplosion(bullet.position, new THREE.Color(0xff0000));
            }
            playerBullet.userData.active = false;
            scene.remove(playerBullet);
            bullets.splice(pIndex, 1);
          }
        });

        if (!isInvincible && bullet.userData.active) {
          const dist1 = bullet.position.distanceTo(ship1.position);
          const dist2 = bullet.position.distanceTo(ship2.position);

          if (dist1 < 2 || dist2 < 2) {
            bullet.userData.active = false;
            scene.remove(bullet);
            enemyBullets.splice(index, 1);
            stopAlarm();

            shakeScreen(0.5);

            if (currentShield > 0) {
              currentShield--;
              setShield(currentShield);
              if (currentShield === 0) {
                shield1.visible = false;
                shield2.visible = false;
              }
            } else {
              currentLives--;
              setLives(currentLives);

              currentCombo = 0;
              currentMultiplier = 1;
              setCombo(0);
              setMultiplier(1);

              if (currentLives <= 0) {
                isGameOver = true;
                setGameOver(true);
                if (currentScore > currentHighScore) {
                  currentHighScore = currentScore;
                  setHighScore(currentScore);
                  saveHighScore(currentScore);
                }
              } else {
                isInvincible = true;
                let flickerCount = 0;
                flickerInterval = window.setInterval(() => {
                  ship1.visible = !ship1.visible;
                  ship2.visible = !ship2.visible;
                  flickerCount++;
                  if (flickerCount >= 10) {
                    if (flickerInterval) {
                      window.clearInterval(flickerInterval);
                    }
                    ship1.visible = true;
                    ship2.visible = true;
                    isInvincible = false;
                    flickerInterval = null;
                  }
                }, 200);
              }
            }
            return;
          }
        }

        if (bullet.position.z > 15) {
          bullet.userData.active = false;
          scene.remove(bullet);
          enemyBullets.splice(index, 1);
          stopAlarm();
        }
      });

      if (enemyBullets.length === 0) {
        stopAlarm();
      }

      enemies.forEach(enemy => {
        if (!enemy.userData.alive) return;

        const moveSpeed = enemySpeed * enemy.userData.speed * timeScale;
        enemy.position.z += moveSpeed;

        if (enemy.userData.formation === 'circle') {
          enemy.userData.circleTime += 0.02 * timeScale;
          const radius = 10;
          const angle = enemy.userData.circleTime;
          enemy.position.x = Math.cos(angle) * radius;
          enemy.position.y = Math.sin(angle) * radius;
        } else if (enemy.userData.type === 'zigzag') {
          enemy.userData.zigzagTime += 0.05 * timeScale;
          enemy.position.x = enemy.userData.originalX + Math.sin(enemy.userData.zigzagTime) * 3;
        }

        enemy.rotation.x += 0.01 * timeScale;
        enemy.rotation.y += 0.01 * timeScale;

        // Enemies pass through instead of ending game
        if (enemy.position.z > 20 && enemy.userData.alive) {
          enemy.userData.alive = false;
          scene.remove(enemy);
        }
      });

      bullets.forEach((bullet, bIndex) => {
        if (!bullet.userData.active) return;

        for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
          const enemy = enemies[eIndex];
          if (!enemy.userData.alive) continue;

          const distance = bullet.position.distanceTo(enemy.position);
          if (distance < 1.5) {
            bullet.userData.active = false;
            scene.remove(bullet);
            bullets.splice(bIndex, 1);

            enemy.userData.health--;

            if (enemy.userData.health <= 0) {
              enemy.userData.alive = false;
              createExplosion(enemy.position, enemy.userData.color);
              createPowerup(enemy.position);
              playExplosionSound(enemy.userData.type);
              shakeScreen(0.2);

              // Properly remove enemy from scene and array
              scene.remove(enemy);
              enemies.splice(eIndex, 1);

              addKill();
              const points = 10 * currentMultiplier;
              currentScore += points;
              setScore(currentScore);
            } else {
              // find a Mesh child whose geometry is a BoxGeometry (body)
              const bodyMesh = enemy.children.find((child: THREE.Object3D) => {
                const mesh = child as THREE.Mesh;
                return mesh.geometry !== undefined && (mesh.geometry as any).type === 'BoxGeometry';
              }) as THREE.Mesh | undefined;
              if (bodyMesh) {
                (bodyMesh.material as THREE.MeshPhongMaterial).emissive.setRGB(1, 0, 0);
                setTimeout(() => {
                  if (enemy.userData.alive && bodyMesh.material) {
                    const col = enemy.userData.color as THREE.Color;
                    const hsl = { h: 0, s: 0, l: 0 };
                    col.getHSL(hsl);
                    (bodyMesh.material as THREE.MeshPhongMaterial).emissive.setHSL(hsl.h, 1, 0.2);
                  }
                }, 100);
              }
            }
            break;
          }
        }
      });

      const aliveEnemies = enemies.filter(e => e.userData.alive);
      if (aliveEnemies.length === 0 && !isPaused) {
        const timeBonus = currentTimeLeft * 5;
        currentScore += timeBonus;
        setScore(currentScore);

        playLevelCompleteSound();

        startNextWave();
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (flickerInterval) window.clearInterval(flickerInterval);
      if (comboTimeout) window.clearTimeout(comboTimeout);
      stopAlarm();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const resetGame = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 text-white font-mono bg-black bg-opacity-70 p-4 rounded text-sm">
        <div className="text-xl font-bold mb-2">Level {level} - Wave {wave}</div>
        <div>Score: {score}</div>
        <div>High: {highScore}</div>
        <div>Lives: {lives}</div>
        <div>Shield: {shield}</div>
        <div className={timeLeft <= 10 ? 'text-red-500 font-bold' : ''}>Time: {timeLeft}s</div>
        {combo > 0 && <div className="text-yellow-400 font-bold">Combo: {combo} x{multiplier}</div>}
        {powerup && <div className="text-purple-400 font-bold">Powerup: {powerup.toUpperCase()}</div>}
      </div>

      <div className="absolute top-4 right-4 text-white font-mono text-xs bg-black bg-opacity-70 p-3 rounded">
        <div className="font-bold mb-1">Player 1 (Green):</div>
        <div>←→↑↓: Move | SPACE: Shoot</div>
        <div>Shift: Dash ({dashCooldown}s)</div>
        <div>Ctrl: Slow ({slowCooldown}s)</div>
        <div>Alt: Bomb ({bombCooldown}s)</div>
        <div className="font-bold mt-2 mb-1">Player 2 (Blue):</div>
        <div>WASD: Move | F: Shoot</div>
        <div>Q: Dash | E: Slow | R: Bomb</div>
        <div className="mt-2 text-yellow-400">
          <div>Powerups:</div>
          <div>🔵 Shield | 🟣 Rapid Fire</div>
          <div>🟡 Spread | 🔴 Laser</div>
        </div>
      </div>

      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
          <div className="text-center text-white">
            <h1 className="text-6xl font-bold mb-4">GAME OVER</h1>
            <p className="text-3xl mb-2">Level {level} - Wave {wave}</p>
            <p className="text-3xl mb-2">Final Score: {score}</p>
            {score > highScore && <p className="text-2xl text-yellow-400 mb-4">NEW HIGH SCORE!</p>}
            <button onClick={resetGame} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded text-xl">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceInvaders3D;