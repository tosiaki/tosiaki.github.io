// app.js (Main entry point)
import { canvasUtil } from './utility/canvasUtil.js';
import { spacetimeApi } from './modules/spacetime.js';
import { renderApi } from './modules/render.js';
import { guiApi } from './modules/gui.js';

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    const canvasId = 'simulationCanvas'; // Make sure your HTML has <canvas id="simulationCanvas"></canvas>
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.error(`Canvas element with id "${canvasId}" not found!`);
        return;
    }

    // --- Configuration ---
    const initialSettings = {
        massMultiplier: 200, // Visual size exaggeration
        calculationSpeed: 1, // Simulation speed multiplier
        G: 1,                // Gravitational constant
        BN_THETA: 0.5,       // Barnes-Hut accuracy
        MERGE_DISTANCE_FACTOR: 1.0, // How close radii need to be to merge
        calculationsPerSec: 100, // Simulation steps per second
    };

    // --- Initialization ---
    canvasUtil.initialize(canvas);
    canvasUtil.autoResize();

    spacetimeApi.initialize(initialSettings);
    renderApi.initialize(canvas, initialSettings.massMultiplier);
    guiApi.initialize(canvas, initialSettings.massMultiplier); // Pass canvas and multiplier

    // --- Initial Scene Setup ---
    setupSolarSystemExample();
    // setupAsteroidBeltExample(canvas); // Uncomment to add asteroid belt

    // --- Start Simulation & Rendering ---
    spacetimeApi.startLoop();
    renderApi.startLoop();

    console.log("Application initialized and running.");
});


// --- Example Scene Setup Functions ---

function setupSolarSystemExample() {
    // Center coordinates (approximate)
    const centerX = 200; // window.innerWidth / 2; // Or derive from canvas if needed later
    const centerY = 200; // window.innerHeight / 2;

    // Star
    spacetimeApi.addParticle({
        cameraFocus: true, // Focus on the star initially
        x: centerX,
        y: centerY,
        velX: 0,
        velY: 0,
        mass: 500,
        density: 0.3
        // path: [] // Path initialized automatically by Particle class
    });

    // Function to calculate stable orbit velocity (approximate)
    const getOrbitVel = (starMass, distance) => Math.sqrt(spacetimeApi.getConfig().G * starMass / distance);

    // Mercury (example planet)
    const mercuryDist = 30;
    spacetimeApi.addParticle({
        x: centerX + mercuryDist,
        y: centerY,
        velX: 0,
        velY: getOrbitVel(500, mercuryDist), // Orbiting velocity upwards
        mass: 0.5,
        density: 1
    });

    // Mars (example planet)
    const marsDist = 200;
     spacetimeApi.addParticle({
        x: centerX - marsDist, // Start on the left
        y: centerY,
        velX: 0,
        velY: -getOrbitVel(500, marsDist), // Orbiting velocity downwards
        mass: 3,
        density: 1
    });

    // Earth (example planet)
    const earthDist = 350;
    spacetimeApi.addParticle({
        x: centerX + earthDist,
        y: centerY,
        velX: 0,
        velY: getOrbitVel(500, earthDist),
        mass: 6,
        density: 0.6
    });

    // Moon (orbiting Earth)
    const moonDist = 20; // Distance from Earth
    const earthVelY = getOrbitVel(500, earthDist); // Earth's velocity around Sun
    const moonOrbitVel = getOrbitVel(6, moonDist); // Moon's velocity around Earth
    spacetimeApi.addParticle({
        x: centerX + earthDist + moonDist, // Earth's position + moon offset
        y: centerY,
        velX: 0, // Add Earth's X velocity if not 0
        velY: earthVelY + moonOrbitVel, // Earth's vel + Moon's relative orbital vel
        mass: 0.1,
        density: 1
    });

    // Asteroid Belt Sample
    const numAsteroids = 10;
    const beltMinDist = 50;
    const beltMaxDist = 120;
    for (let i = 0; i < numAsteroids; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = beltMinDist + Math.random() * (beltMaxDist - beltMinDist);
        const orbitVel = getOrbitVel(500, dist);

        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;

        // Velocity is perpendicular to the angle
        const velAngle = angle + Math.PI / 2;
        const velX = Math.cos(velAngle) * orbitVel;
        const velY = Math.sin(velAngle) * orbitVel;

        spacetimeApi.addParticle({
            x: x,
            y: y,
            velX: velX,
            velY: velY,
            mass: 0.0025,
            density: 4
        });
    }
    console.log("Solar system example setup complete.");
}

function setupAsteroidBeltExample(canvas) {
    // Optional: Add a central black hole or large star
    const centerMass = 10000;
    spacetimeApi.addParticle({
        x: 0, y: 0, // Place at origin
        velX: 0, velY: 0,
        mass: centerMass,
        density: 0.0001, // Very dense (visually small)
        cameraFocus: true // Focus on the central object
    });

    const numAsteroids = 1000;
    const maxDist = 500; // Max distance for asteroids
    const G = spacetimeApi.getConfig().G || 1;

    for (let i = 0; i < numAsteroids; i++) {
        const angle = Math.random() * 2 * Math.PI;
        // Distribute more densely towards center (use random^power, power < 1)
        const dist = Math.pow(Math.random(), 0.7) * maxDist;

        if (dist < 10) continue; // Avoid placing exactly at center

        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;

        // Calculate orbital velocity
        const orbitSpeed = Math.sqrt(G * centerMass / dist);
        // Add some randomness to speed for less perfect orbits
        const speedRand = 0.95 + Math.random() * 0.1;
        const finalSpeed = orbitSpeed * speedRand;

        // Velocity perpendicular to position vector
        const velAngle = angle + Math.PI / 2;
        const velX = Math.cos(velAngle) * finalSpeed;
        const velY = Math.sin(velAngle) * finalSpeed;

        spacetimeApi.addParticle({
            x: x,
            y: y,
            velX: velX,
            velY: velY,
            mass: 0.01 + Math.random()*0.02, // Slightly variable mass
            density: 1 + Math.random() // Slightly variable density
        });
    }
    console.log(`Asteroid belt example setup complete (${numAsteroids} asteroids).`);
}
