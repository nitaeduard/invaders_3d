import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const SpaceInvaders3D = () => {
  const mountRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (!mountRef.current) return;

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

    const shipGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.ConeGeometry(0.5, 2, 4);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x004400 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    shipGroup.add(body);
    
    const wingGeometry = new THREE.BoxGeometry(2, 0.2, 1);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x00cc00, emissive: 0x003300 });
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
    
    shipGroup.position.set(0, 0, 0);
    scene.add(shipGroup);

    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, -10);

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioInitialized = false;
    let alarmOscillator = null;
    let alarmGain = null;

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
      
      alarmGain.gain.value = 0.2;
      
      alarmOscillator.start();
      
      setInterval(() => {
        if (alarmOscillator) {
          alarmOscillator.frequency.value = alarmOscillator.frequency.value === 880 ? 1100 : 880;
        }
      }, 200);
    };

    const stopAlarm = () => {
      if (alarmOscillator) {
        alarmOscillator.stop();
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

    const playExplosionSound = () => {
      initAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    };

    const playLevelCompleteSound = () => {
      initAudio();
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
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

    const stars = [];
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

    const leftCrosshairGroup = new THREE.Group();
    const rightCrosshairGroup = new THREE.Group();
    const crosshairMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.4 
    });
    
    const createCrosshair = () => {
      const group = new THREE.Group();
      
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
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.6 
      });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      group.add(dot);
      
      return group;
    };
    
    leftCrosshairGroup.add(createCrosshair());
    rightCrosshairGroup.add(createCrosshair());
    
    leftCrosshairGroup.position.set(-2.5, 0, -40);
    rightCrosshairGroup.position.set(2.5, 0, -40);
    scene.add(leftCrosshairGroup);
    scene.add(rightCrosshairGroup);

    let enemies = [];
    const bullets = [];
    const enemyBullets = [];
    const particles = [];
    const keys = { left: false, right: false, up: false, down: false, space: false };
    let enemySpeed = 0.015;
    let lastShot = 0;
    let alternateGun = false;
    let currentScore = 0;
    let currentLevel = 1;
    let currentLives = 3;
    let isGameOver = false;
    let isPaused = false;
    let currentTimeLeft = 60;
    let lastTimeUpdate = Date.now();
    let isInvincible = false;
    let flickerInterval = null;

    const createExplosion = (position, color) => {
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

    const createEnemies = (level) => {
      const rows = 3 + Math.floor(level / 2);
      const cols = 5 + Math.floor(level / 2);
      const startZ = -40 - (level * 5);
      
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const enemyGroup = new THREE.Group();
          
          const hue = (level * 0.1 + row * 0.1) % 1;
          const enemyColor = new THREE.Color().setHSL(hue, 1, 0.5);
          const enemyEmissive = new THREE.Color().setHSL(hue, 1, 0.2);
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
          
          enemyGroup.position.set(
            col * 2.5 - (cols * 2.5) / 2 + 1.25,
            row * 2.5 - (rows * 2.5) / 2 + 1.25,
            startZ
          );
          
          enemyGroup.userData.alive = true;
          enemyGroup.userData.color = enemyColor;
          scene.add(enemyGroup);
          enemies.push(enemyGroup);
        }
      }
      
      enemySpeed = 0.015 + (level * 0.005);
    };

    createEnemies(currentLevel);

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === 'ArrowUp') keys.up = true;
      if (e.key === 'ArrowDown') keys.down = true;
      if (e.key === ' ') keys.space = true;
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowRight') keys.right = false;
      if (e.key === 'ArrowUp') keys.up = false;
      if (e.key === 'ArrowDown') keys.down = false;
      if (e.key === ' ') keys.space = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const shoot = () => {
      const bulletGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      
      const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
      
      if (alternateGun) {
        bullet.position.set(shipGroup.position.x - 2.5, shipGroup.position.y, shipGroup.position.z - 1);
      } else {
        bullet.position.set(shipGroup.position.x + 2.5, shipGroup.position.y, shipGroup.position.z - 1);
      }
      
      alternateGun = !alternateGun;
      bullet.userData.active = true;
      scene.add(bullet);
      bullets.push(bullet);
      
      playShootSound();
    };

    const startNextLevel = () => {
      isPaused = true;
      
      setTimeout(() => {
        bullets.forEach(bullet => scene.remove(bullet));
        bullets.length = 0;
        
        enemyBullets.forEach(bullet => scene.remove(bullet));
        enemyBullets.length = 0;
        
        enemies.forEach(enemy => scene.remove(enemy));
        enemies = [];
        
        currentLevel++;
        setLevel(currentLevel);
        
        currentTimeLeft = 60;
        setTimeLeft(60);
        lastTimeUpdate = Date.now();
        
        createEnemies(currentLevel);
        
        isPaused = false;
      }, 2000);
    };

    const animate = () => {
      if (isGameOver) return;
      requestAnimationFrame(animate);

      if (isPaused) {
        renderer.render(scene, camera);
        return;
      }

      const now = Date.now();
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
          } else {
            currentTimeLeft = 60;
            setTimeLeft(60);
          }
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
        particle.material.opacity = life;
        particle.material.transparent = true;
        
        if (particle.userData.age >= particle.userData.lifetime) {
          scene.remove(particle);
          particles.splice(index, 1);
        }
      });

      if (keys.left && shipGroup.position.x > -10) {
        shipGroup.position.x -= 0.15;
      }
      if (keys.right && shipGroup.position.x < 10) {
        shipGroup.position.x += 0.15;
      }
      if (keys.up && shipGroup.position.y < 8) {
        shipGroup.position.y += 0.15;
      }
      if (keys.down && shipGroup.position.y > -8) {
        shipGroup.position.y -= 0.15;
      }

      const nearestEnemyZ = enemies.reduce((nearest, enemy) => {
        if (!enemy.userData.alive) return nearest;
        return enemy.position.z > nearest ? enemy.position.z : nearest;
      }, -100);
      
      leftCrosshairGroup.position.x = shipGroup.position.x - 2.5;
      leftCrosshairGroup.position.y = shipGroup.position.y;
      leftCrosshairGroup.position.z = nearestEnemyZ;
      
      rightCrosshairGroup.position.x = shipGroup.position.x + 2.5;
      rightCrosshairGroup.position.y = shipGroup.position.y;
      rightCrosshairGroup.position.z = nearestEnemyZ;

      if (keys.space && now - lastShot > 250) {
        shoot();
        lastShot = now;
      }

      bullets.forEach((bullet, index) => {
        if (!bullet.userData.active) return;
        bullet.position.z -= 0.6;
        if (bullet.position.z < -60) {
          bullet.userData.active = false;
          scene.remove(bullet);
          bullets.splice(index, 1);
        }
      });

      if (currentLevel >= 2 && enemyBullets.length === 0) {
        const shootingChance = 0.001 * currentLevel;
        enemies.forEach(enemy => {
          if (!enemy.userData.alive || enemyBullets.length > 0) return;
          if (Math.random() < shootingChance) {
            const enemyBulletGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
            const enemyBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const enemyBullet = new THREE.Mesh(enemyBulletGeometry, enemyBulletMaterial);
            enemyBullet.position.copy(enemy.position);
            enemyBullet.rotation.x = Math.PI / 2;
            enemyBullet.userData.active = true;
            scene.add(enemyBullet);
            enemyBullets.push(enemyBullet);
            startAlarm();
          }
        });
      }

      enemyBullets.forEach((bullet, index) => {
        if (!bullet.userData.active) return;
        bullet.position.z += 0.4;
        
        if (!isInvincible) {
          const distanceToShip = bullet.position.distanceTo(shipGroup.position);
          if (distanceToShip < 2) {
            bullet.userData.active = false;
            scene.remove(bullet);
            enemyBullets.splice(index, 1);
            stopAlarm();
            
            currentLives--;
            setLives(currentLives);
            
            if (currentLives <= 0) {
              isGameOver = true;
              setGameOver(true);
            } else {
              isInvincible = true;
              let flickerCount = 0;
              flickerInterval = setInterval(() => {
                shipGroup.visible = !shipGroup.visible;
                flickerCount++;
                if (flickerCount >= 10) {
                  clearInterval(flickerInterval);
                  shipGroup.visible = true;
                  isInvincible = false;
                }
              }, 200);
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
        enemy.position.z += enemySpeed;
        enemy.rotation.x += 0.01;
        enemy.rotation.y += 0.01;
        
        if (enemy.position.z > 2 && enemy.userData.alive) {
          currentLives--;
          setLives(currentLives);
          if (currentLives <= 0) {
            isGameOver = true;
            setGameOver(true);
          }
          enemy.userData.alive = false;
          createExplosion(enemy.position, enemy.userData.color);
          scene.remove(enemy);
        }
      });

      bullets.forEach((bullet, bIndex) => {
        if (!bullet.userData.active) return;
        enemies.forEach((enemy) => {
          if (!enemy.userData.alive) return;
          const distance = bullet.position.distanceTo(enemy.position);
          if (distance < 1.2) {
            bullet.userData.active = false;
            scene.remove(bullet);
            bullets.splice(bIndex, 1);
            enemy.userData.alive = false;
            
            createExplosion(enemy.position, enemy.userData.color);
            playExplosionSound();
            
            scene.remove(enemy);
            currentScore += 10;
            setScore(currentScore);
          }
        });
      });

      const aliveEnemies = enemies.filter(e => e.userData.alive);
      if (aliveEnemies.length === 0 && !isPaused) {
        const timeBonus = currentTimeLeft * 5;
        currentScore += timeBonus;
        setScore(currentScore);
        
        playLevelCompleteSound();
        
        startNextLevel();
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
      if (flickerInterval) clearInterval(flickerInterval);
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
      <div className="absolute top-4 left-4 text-white font-mono bg-black bg-opacity-70 p-4 rounded">
        <div className="text-2xl font-bold mb-2">Level {level}</div>
        <div className="text-xl">Score: {score}</div>
        <div className="text-xl">Lives: {lives}</div>
        <div className={`text-xl ${timeLeft <= 10 ? 'text-red-500 font-bold' : ''}`}>
          Time: {timeLeft}s
        </div>
      </div>
      <div className="absolute top-4 right-4 text-white font-mono text-sm bg-black bg-opacity-70 p-4 rounded">
        <div className="font-bold mb-2">Controls:</div>
        <div>← → ↑ ↓ : Move</div>
        <div>SPACE: Shoot</div>
        <div className="mt-3 text-xs text-gray-300">
          <div>Time bonus: {timeLeft * 5} pts</div>
        </div>
      </div>
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
          <div className="text-center text-white">
            <h1 className="text-6xl font-bold mb-4">GAME OVER</h1>
            <p className="text-3xl mb-2">Level Reached: {level}</p>
            <p className="text-3xl mb-8">Final Score: {score}</p>
            <button
              onClick={resetGame}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded text-xl"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceInvaders3D;