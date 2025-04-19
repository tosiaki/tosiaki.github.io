// modules/spacetime.js (Modernized)

// -----------
// | Private |
// -----------

// Simulation state
let spacetime = []; // Array storing all particle objects
let bnRoot = null; // Root of the Barnes-Hut tree

// Simulation settings
const config = {
    calculationsPerSec: 100, // How many simulation steps are performed a second
    calculationSpeed: 1,     // Time step multiplier (dt = calculationSpeed / calculationsPerSec implicitly?) - careful tuning needed
    massMultiplier: 1,       // Visual exaggeration for radius calculation
    G: 1,                    // Gravitational Constant
    BN_THETA: 0.9,           // Barnes-Hut opening angle parameter (accuracy vs speed)
    MAXDEPTH: 50,            // Max depth of the Barnes-Hut tree
    // ETA: 0,               // Softening constant (removed, wasn't used effectively)
    // GFACTOR: 2,           // (removed, wasn't used effectively)
    ENERGY_DAMPING_FACTOR: 0.001, // Factor for artificial damping of high-energy particles (if needed)
    ESCAPE_VELOCITY_CHECK: false, // Enable check to remove particles far away (can be expensive)
    MAX_DISTANCE_FACTOR: 1000,   // Factor times sqrt(total mass) to determine removal distance
    MERGE_DISTANCE_FACTOR: 1.0, // Factor for merge distance check (original had *5, which seems large)
};

// Calculation interval loop
let spacetimeLoopId = null;
let debugLoopId = null;

// --- Particle Class ---
class Particle {
    constructor(options) {
        // Core properties
        this.x = options.x;
        this.y = options.y;
        this.mass = options.mass;
        this._cachedRadius = 0;

        // Velocity and Acceleration (using Verlet integration requires current & previous position)
        this.velX = options.velX || 0; // Store initial velocity for Verlet start
        this.velY = options.velY || 0;
        this.accX = options.accX || 0;
        this.accY = options.accY || 0;

        // Verlet integration state
        // Initialize lastX/lastY based on current pos and initial velocity
        // x_last = x_current - v_current * dt + 0.5 * a_current * dt^2
        // Assuming a_current is 0 initially and dt is represented by calculationSpeed for initialization step
        this.lastX = this.x - this.velX * config.calculationSpeed;
        this.lastY = this.y - this.velY * config.calculationSpeed;

        // Other properties
        this.density = options.density !== undefined ? options.density : 1;
        this.path = options.path !== undefined ? options.path : []; // Path for rendering (optional)
        this.cameraFocus = options.cameraFocus !== undefined ? options.cameraFocus : false; // Is camera focused?

        // Internal state for simulation step
        this.markedForRemoval = false; // Flag for merging/removal

        this.updateCachedRadius();
    }

    _calculateRadius() {
        if (this.mass <= 0 || this.density <= 0) return 0;
        const volume = this.mass * this.density * config.massMultiplier; // Use module config
        return Math.cbrt(volume / (4 / 3 * Math.PI));
    }

    // Method to update the cache
    updateCachedRadius() {
        this._cachedRadius = this._calculateRadius();
    }

    // Public method to GET the radius (now reads from cache)
    getRadius() {
        // Optional: Recalculate if needed, but for now, rely on external updates
        // if (this._cachedRadius === undefined) this.updateCachedRadius(); // Defensive
        return this._cachedRadius;
    }

    // Calculate current velocity (primarily for info/debug, Verlet uses positions)
    getCurrentVelocity() {
        const dt = config.calculationSpeed; // Assuming dt is represented by this factor
        if (dt === 0) return { vx: 0, vy: 0 };
        const vx = (this.x - this.lastX) / dt;
        const vy = (this.y - this.lastY) / dt;
        return { vx, vy };
    }

    getSpeed() {
        const { vx, vy } = this.getCurrentVelocity();
        return Math.sqrt(vx * vx + vy * vy);
    }

    getMomentum() {
        const speed = this.getSpeed();
        return speed * this.mass;
    }

    // Add current position to path history (limit length)
    updatePath() {
        this.path.push({ x: this.x, y: this.y });
        // Limit path length (heuristic based on radius/speed, needs tuning)
        const maxLen = Math.min(120, (this.getRadius() * 20) / (this.getSpeed() + 0.1)); // Avoid division by zero
        if (this.path.length > maxLen) {
            this.path.shift(); // Remove oldest point
        }
    }
}

// --- Helper Functions ---

const getObjectDistanceSquared = (objA, objB) => {
    const dx = objA.x - objB.x;
    const dy = objA.y - objB.y;
    return dx * dx + dy * dy;
};

const getObjectDistance = (objA, objB) => {
    return Math.sqrt(getObjectDistanceSquared(objA, objB));
};

// --- Collision Detection and Merging ---

// Creates a merged particle from two input particles
function createMergedParticle(objA, objB) {
    const totalMass = objA.mass + objB.mass;
    if (totalMass === 0) return null; // Avoid division by zero if both masses are zero

    // Conserve momentum: p_final = pA + pB => m_total * v_final = mA * vA + mB * vB
    // Use Verlet positions to estimate velocity for momentum calculation
    const dt = config.calculationSpeed;
    const vAx = (objA.x - objA.lastX) / dt;
    const vAy = (objA.y - objA.lastY) / dt;
    const vBx = (objB.x - objB.lastX) / dt;
    const vBy = (objB.y - objB.lastY) / dt;

    const finalVelX = (objA.mass * vAx + objB.mass * vBx) / totalMass;
    const finalVelY = (objA.mass * vAy + objB.mass * vBy) / totalMass;

    // Position is the center of mass
    const finalX = (objA.x * objA.mass + objB.x * objB.mass) / totalMass;
    const finalY = (objA.y * objA.mass + objB.y * objB.mass) / totalMass;

    // New density (weighted average)
    const finalDensity = (objA.density * objA.mass + objB.density * objB.mass) / totalMass;

    // New path is a copy of the larger object's path (or could be cleared/merged)
    const finalPath = objA.mass >= objB.mass ? [...objA.path] : [...objB.path];

    // Camera focus if either object had it
    const finalCameraFocus = objA.cameraFocus || objB.cameraFocus;

    return new Particle({
        x: finalX,
        y: finalY,
        velX: finalVelX, // Used only for initializing the new particle's lastX/lastY
        velY: finalVelY,
        mass: totalMass,
        density: finalDensity,
        path: finalPath,
        cameraFocus: finalCameraFocus,
        // accX, accY default to 0
        // lastX, lastY will be calculated in the constructor based on finalX, finalY, finalVelX, finalVelY
    });
}

// Detects and handles collisions/merges using a spatial grid
function handleCollisionsAndMerges() {
    if (spacetime.length < 2) return;

    let mergedOccurred = false;
    const particlesToMerge = []; // Store pairs [indexA, indexB]
    const indicesToRemove = new Set(); // Store indices of particles to remove
    const newParticles = []; // Store newly created merged particles

    // 1. Build Spatial Grid for broad phase collision detection
    let minX = Infinity, maxX = -Infinity; // Initialize properly
    let minY = Infinity, maxY = -Infinity;
    let maxRadius = 0;

    if (spacetime.length > 0) { // Ensure spacetime is not empty before accessing index 0
        minX = spacetime[0].x; maxX = spacetime[0].x;
        minY = spacetime[0].y; maxY = spacetime[0].y;
    }

    for (const particle of spacetime) {
        // Skip particles already marked (e.g., from a previous pass if made iterative)
        // if (particle.markedForRemoval) continue; // Not strictly needed with Set logic below

        minX = Math.min(minX, particle.x);
        maxX = Math.max(maxX, particle.x);
        minY = Math.min(minY, particle.y);
        maxY = Math.max(maxY, particle.y);
        maxRadius = Math.max(maxRadius, particle.getRadius());
    }

    // Use cell size based on largest object radius (or a minimum size)
    // Ensure cell size is positive, even if maxRadius is 0
    const cellSize = Math.max(2 * maxRadius, 1);
    const grid = new Map(); // Using Map for potentially sparse grid: "x_y" -> [particleIndex1, ...]

    for (let i = 0; i < spacetime.length; i++) {
        // No need to check markedForRemoval here, indicesToRemove handles it
        const particle = spacetime[i];
        const gridX = Math.floor(particle.x / cellSize);
        const gridY = Math.floor(particle.y / cellSize);
        const key = `${gridX}_${gridY}`;

        if (!grid.has(key)) {
            grid.set(key, []);
        }
        grid.get(key).push(i);
    }

    // 2. Check for collisions (narrow phase) within grid cells and neighbors
    // ----> Add label to the outer loop <----
    particleLoop:
    for (let i = 0; i < spacetime.length; i++) {
        // Skip if already marked for removal by a previous merge in this pass
        if (indicesToRemove.has(i)) continue;

        const particleA = spacetime[i];
        const gridX = Math.floor(particleA.x / cellSize);
        const gridY = Math.floor(particleA.y / cellSize);

        // Check current cell and 8 neighbors
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${gridX + dx}_${gridY + dy}`;
                if (grid.has(key)) {
                    const cellParticles = grid.get(key);
                    for (const j of cellParticles) {
                        // Avoid self-check and checks where j is already marked
                        // Also ensure j > i to check each pair only once
                        if (j <= i || indicesToRemove.has(j)) continue;

                        const particleB = spacetime[j];

                        // Actual distance check for merging
                        const radiusA = particleA.getRadius();
                        const radiusB = particleB.getRadius();
                        const mergeDistance = (radiusA + radiusB) * config.MERGE_DISTANCE_FACTOR; // Use config
                        const distSq = getObjectDistanceSquared(particleA, particleB); // Use helper

                        if (distSq < mergeDistance * mergeDistance) {
                            // Mark for merge
                            indicesToRemove.add(i);
                            indicesToRemove.add(j);
                            particlesToMerge.push([i, j]);
                            mergedOccurred = true;

                            // ----> Use labeled continue instead of goto <----
                            continue particleLoop; // Skip rest of checks for particle 'i' and go to next i
                        }
                    }
                }
            }
        }
        // Removed the invalid label: next_particle_i:;
    }

    // 3. Process Merges
    if (mergedOccurred) {
        // It's crucial to create merged particles based on the *original* objects
        // before modifying the spacetime array.
        for (const [indexA, indexB] of particlesToMerge) {
             // Ensure indices are still valid (should be, as we only add)
             if (spacetime[indexA] && spacetime[indexB]){
                 const merged = createMergedParticle(spacetime[indexA], spacetime[indexB]);
                 if (merged) {
                     newParticles.push(merged);
                 }
             } else {
                 console.warn("Skipping merge due to invalid indices:", indexA, indexB);
             }
        }

        // 4. Update spacetime array: filter out removed, add new
        spacetime = spacetime.filter((_, index) => !indicesToRemove.has(index));
        spacetime.push(...newParticles);

        // If merges happened, we might ideally run another collision pass
        // to handle chain reactions within one step. For simplicity,
        // the next simulation step will handle subsequent merges.
        // To handle chain reactions within one step, you could uncomment:
        // handleCollisionsAndMerges(); // Recursive call (use with caution!)
    }
}

// --- Barnes-Hut Tree Implementation ---

// Represents a node in the Barnes-Hut tree (Quadtree)
class BHNode {
    constructor(box) {
        this.box = box; // Bounding box [minX, minY, maxX, maxY]
        this.centerOfMass = { mass: 0, x: 0, y: 0 };
        this.particleIndices = []; // Indices of particles contained DIRECTLY (only for leaf nodes or beyond MAXDEPTH)
        this.children = [null, null, null, null]; // NW, NE, SW, SE
        this.isLeaf = true;
        this.numParticles = 0; // Total particles in this node and subnodes
    }
}

// Clears the Barnes-Hut tree (allow garbage collection)
function bnDeleteTree() {
    bnRoot = null; // Just release the reference to the root
}

// Determines which quadrant a particle belongs to within a node's box
function getQuadrant(particle, nodeBox) {
    const midX = (nodeBox[0] + nodeBox[2]) / 2;
    const midY = (nodeBox[1] + nodeBox[3]) / 2;

    if (particle.x < midX) { // Left
        return (particle.y < midY) ? 0 : 2; // 0: NW, 2: SW
    } else { // Right
        return (particle.y < midY) ? 1 : 3; // 1: NE, 3: SE
    }
}

// Inserts a particle into the Barnes-Hut tree
function bnInsertParticle(node, particleIndex, depth) {
    const particle = spacetime[particleIndex];

    // Update Center of Mass (cumulative)
    const totalMass = node.centerOfMass.mass + particle.mass;
    if (totalMass > 0) {
        node.centerOfMass.x = (node.centerOfMass.x * node.centerOfMass.mass + particle.x * particle.mass) / totalMass;
        node.centerOfMass.y = (node.centerOfMass.y * node.centerOfMass.mass + particle.y * particle.mass) / totalMass;
    } else {
         // Avoid NaN if both masses are zero, place at particle pos
        node.centerOfMass.x = particle.x;
        node.centerOfMass.y = particle.y;
    }
    node.centerOfMass.mass = totalMass;
    node.numParticles++;


    if (node.isLeaf) {
        if (node.particleIndices.length === 0) {
            // Node was empty, just add the particle
            node.particleIndices.push(particleIndex);
        } else {
            // Node already has a particle, need to subdivide (if not at max depth)
            if (depth >= config.MAXDEPTH) {
                // Max depth reached, store particle here anyway
                node.particleIndices.push(particleIndex);
            } else {
                // Subdivide: Create children nodes and move existing particle(s) down
                node.isLeaf = false;
                const existingParticleIndex = node.particleIndices[0]; // Assuming only one before subdividing
                node.particleIndices = []; // Clear particle index from internal node

                // Create child nodes
                const [minX, minY, maxX, maxY] = node.box;
                const midX = (minX + maxX) / 2;
                const midY = (minY + maxY) / 2;
                node.children[0] = new BHNode([minX, minY, midX, midY]); // NW
                node.children[1] = new BHNode([midX, minY, maxX, midY]); // NE
                node.children[2] = new BHNode([minX, midY, midX, maxY]); // SW
                node.children[3] = new BHNode([midX, midY, maxX, maxY]); // SE

                // Re-insert the existing particle into the appropriate child
                const existingQuad = getQuadrant(spacetime[existingParticleIndex], node.box);
                bnInsertParticle(node.children[existingQuad], existingParticleIndex, depth + 1);

                // Insert the new particle into the appropriate child
                const newQuad = getQuadrant(particle, node.box);
                bnInsertParticle(node.children[newQuad], particleIndex, depth + 1);
            }
        }
    } else {
        // Node is internal, insert particle into the appropriate child
        const quad = getQuadrant(particle, node.box);
        if (!node.children[quad]) {
             // Should not happen if subdivision logic is correct, but handle defensively
             console.error("BH Tree Error: Child node missing during insertion.");
             // Potentially create the child node here if needed
        }
        bnInsertParticle(node.children[quad], particleIndex, depth + 1);
    }
}


// Builds the Barnes-Hut tree from the current spacetime particles
function bnBuildTree() {
    bnDeleteTree(); // Clear the old tree

    if (spacetime.length === 0) {
        bnRoot = null;
        return;
    }

    // Determine bounding box dynamically
    let minX = spacetime[0].x, maxX = spacetime[0].x;
    let minY = spacetime[0].y, maxY = spacetime[0].y;
    for (let i = 1; i < spacetime.length; i++) {
        minX = Math.min(minX, spacetime[i].x);
        maxX = Math.max(maxX, spacetime[i].x);
        minY = Math.min(minY, spacetime[i].y);
        maxY = Math.max(maxY, spacetime[i].y);
    }

    // Add some padding to avoid particles exactly on the edge
    const paddingX = (maxX - minX) * 0.01 + 1; // Add small absolute padding too
    const paddingY = (maxY - minY) * 0.01 + 1;
    const rootBox = [minX - paddingX, minY - paddingY, maxX + paddingX, maxY + paddingY];

    bnRoot = new BHNode(rootBox);

    // Insert all particles
    for (let i = 0; i < spacetime.length; i++) {
        // Ensure particle is within the root box (should be due to padding)
        if (spacetime[i].x >= rootBox[0] && spacetime[i].x <= rootBox[2] &&
            spacetime[i].y >= rootBox[1] && spacetime[i].y <= rootBox[3])
        {
            bnInsertParticle(bnRoot, i, 0);
        } else {
            console.warn("Particle outside root bounding box during BH build:", i, spacetime[i]);
            // Decide how to handle: skip, expand box dynamically (complex), or clamp position?
            // Skipping is simplest for now.
        }
    }
}

// Calculates the gravitational force exerted by a node (or particle) on a target particle
function calculateForceOnParticle(targetParticleIndex, node) {
    const targetParticle = spacetime[targetParticleIndex];
    let forceX = 0;
    let forceY = 0;

    if (node.numParticles === 0) {
         return { forceX, forceY }; // Empty node exerts no force
    }


    if (node.isLeaf) {
        // Node is a leaf, calculate direct interaction with particles in it
        for (const sourceParticleIndex of node.particleIndices) {
            if (targetParticleIndex === sourceParticleIndex) continue; // Don't calculate force on self

            const sourceParticle = spacetime[sourceParticleIndex];
            const dx = sourceParticle.x - targetParticle.x;
            const dy = sourceParticle.y - targetParticle.y;
            const distSq = dx * dx + dy * dy;

            // Softening: Add a small epsilon to avoid division by zero and extremely large forces at close range
            // A simple epsilon squared added to distSq is common. Let's use particle radii.
            const softeningDistSq = (targetParticle.getRadius() + sourceParticle.getRadius()) * 0.1; // Small fraction of radii
            const rSq = distSq + softeningDistSq*softeningDistSq;

            if (rSq > 1e-9) { // Avoid division by zero / very small numbers
                const dist = Math.sqrt(rSq);
                // Force = G * m1 * m2 / r^2
                // Acceleration = Force / m1 = G * m2 / r^2
                // Accel vector = (G * m2 / r^2) * (dx/dist, dy/dist) = G * m2 * (dx, dy) / r^3
                const forceMagnitude = config.G * sourceParticle.mass / rSq;
                const factor = forceMagnitude / dist;
                forceX += factor * dx;
                forceY += factor * dy;
            }
             // Handle direct collision force if needed (original code had complex logic here)
             // Simple elastic collision or merging is handled separately.
             // The original getAccelVec had specific close-range logic - can re-add if needed.
        }
    } else {
        // Node is internal, check Barnes-Hut criterion (s/d < theta)
        const dx = node.centerOfMass.x - targetParticle.x;
        const dy = node.centerOfMass.y - targetParticle.y;
        const distSq = dx * dx + dy * dy;

        // s = width of the node's box
        const nodeWidth = node.box[2] - node.box[0]; // Use width, assumes roughly square cells

        // Check if node contains the target particle. If so, we *must* recurse further.
        const containsTarget = targetParticle.x >= node.box[0] && targetParticle.x <= node.box[2] &&
                              targetParticle.y >= node.box[1] && targetParticle.y <= node.box[3];

        // Criterion: if (width / distance) < theta, treat node as a single mass point.
        // Use width^2 / distSq < theta^2 to avoid sqrt.
        if (!containsTarget && (nodeWidth * nodeWidth / distSq) < (config.BN_THETA * config.BN_THETA)) {
            // Treat as single point mass
             const softeningDistSq = (targetParticle.getRadius()) * 0.1; // Soften interaction with CoM too
             const rSq = distSq + softeningDistSq*softeningDistSq;

            if (rSq > 1e-9) {
                const dist = Math.sqrt(rSq);
                const forceMagnitude = config.G * node.centerOfMass.mass / rSq;
                const factor = forceMagnitude / dist;
                forceX += factor * dx;
                forceY += factor * dy;
            }
        } else {
            // Node is too close or contains the target, recurse into children
            for (const child of node.children) {
                if (child) { // Check if child exists
                    const childForce = calculateForceOnParticle(targetParticleIndex, child);
                    forceX += childForce.forceX;
                    forceY += childForce.forceY;
                }
            }
        }
    }

    return { forceX, forceY };
}


// --- Simulation Step ---

// Calculate forces on all particles using the BH tree
function calculateAllForces() {
    if (!bnRoot) return; // No tree, no forces

    for (let i = 0; i < spacetime.length; i++) {
        const particle = spacetime[i];
        // Reset acceleration for this step
        particle.accX = 0;
        particle.accY = 0;

        const { forceX, forceY } = calculateForceOnParticle(i, bnRoot);
        particle.accX = forceX; // Note: BH force calculation directly gives acceleration (Force/mass_target)
        particle.accY = forceY;
    }
}

// Update particle positions using Verlet integration
function updatePositions() {
    const dt = config.calculationSpeed; // Time step
    const dtSq = dt * dt;

    for (const particle of spacetime) {
        // Standard Verlet integration
        const nextX = 2 * particle.x - particle.lastX + particle.accX * dtSq;
        const nextY = 2 * particle.y - particle.lastY + particle.accY * dtSq;

        particle.lastX = particle.x;
        particle.lastY = particle.y;
        particle.x = nextX;
        particle.y = nextY;

        // Optional: Update velocity estimate if needed elsewhere (e.g., path trimming)
        // particle.velX = (particle.x - particle.lastX) / dt;
        // particle.velY = (particle.y - particle.lastY) / dt;

        // Optional: Add path point
        // particle.updatePath();
    }
}

// Optional: Remove particles that have drifted too far away
function removeEscapedParticles() {
     if (!config.ESCAPE_VELOCITY_CHECK || !bnRoot || bnRoot.centerOfMass.mass <= 0) return;

     const totalMass = bnRoot.centerOfMass.mass;
     const escapeDistSq = totalMass * config.MAX_DISTANCE_FACTOR * config.MAX_DISTANCE_FACTOR; // Heuristic based on total mass

     const centerMassX = bnRoot.centerOfMass.x;
     const centerMassY = bnRoot.centerOfMass.y;

     spacetime = spacetime.filter(particle => {
        const dx = particle.x - centerMassX;
        const dy = particle.y - centerMassY;
        const distSq = dx*dx + dy*dy;
        return distSq <= escapeDistSq;
     });
}


// --- Main Simulation Loop Function ---

function simulationStep() {
    console.time("step:updateRadii");
    // Update cached radii for all particles IF mass/density could change outside merging
    // If mass only changes via merging, this might be redundant, but safer for now.
    for (const particle of spacetime) {
        particle.updateCachedRadius(); // Recalculate based on current mass/density
    }
    console.timeEnd("step:updateRadii");

    console.time("step:merge");
    handleCollisionsAndMerges(); // Uses particle.getRadius() -> cached value
    console.timeEnd("step:merge");

    console.time("step:buildTree");
    bnBuildTree();
    console.timeEnd("step:buildTree");

    console.time("step:calcForces");
    calculateAllForces(); // Uses particle.getRadius() -> cached value
    console.timeEnd("step:calcForces");

    console.time("step:updatePos");
    updatePositions();
    console.timeEnd("step:updatePos");

    // 5. Optional: Remove escaped particles
    removeEscapedParticles();

    // 6. Optional: Update paths for rendering
    // for (const particle of spacetime) {
    //     particle.updatePath();
    // }
}

// --- Debugging ---
function startDebugLoop() {
    if (debugLoopId) clearInterval(debugLoopId); // Clear existing loop if any
    debugLoopId = setInterval(() => {
        if (!bnRoot) return;
        let totalMass = 0;
        let totalMomentumX = 0;
        let totalMomentumY = 0;
        const dt = config.calculationSpeed;

        for (const particle of spacetime) {
            totalMass += particle.mass;
            if (dt > 0) {
                const vx = (particle.x - particle.lastX) / dt;
                const vy = (particle.y - particle.lastY) / dt;
                totalMomentumX += particle.mass * vx;
                totalMomentumY += particle.mass * vy;
            }
        }
        console.log(`Particles: ${spacetime.length}, Total Mass: ${totalMass.toFixed(2)}, CoM: (${bnRoot.centerOfMass.x.toFixed(2)}, ${bnRoot.centerOfMass.y.toFixed(2)}), Momentum: (${totalMomentumX.toFixed(2)}, ${totalMomentumY.toFixed(2)})`);
    }, 2000); // Log every 2 seconds
}

function stopDebugLoop() {
     if (debugLoopId) clearInterval(debugLoopId);
     debugLoopId = null;
}


// ----------
// | Public |
// ----------

// Exported API for controlling the simulation
export const spacetimeApi = {
    // Initialize with optional custom settings
    initialize: (initialSettings = {}) => {
        Object.assign(config, initialSettings); // Overwrite defaults with provided settings
        spacetime = []; // Ensure clean start
        bnRoot = null;
        console.log("Spacetime initialized with config:", config);
    },

    // --- Configuration ---
    setCalculationsPerSec: (cps) => {
        if (cps > 0) {
            config.calculationsPerSec = cps;
            if (spacetimeLoopId) { // If loop is running, restart it with new interval
                spacetimeApi.stopLoop();
                spacetimeApi.startLoop();
            }
        }
    },
    setCalculationSpeed: (speed) => {
        config.calculationSpeed = speed;
    },
    setMassMultiplier: (multiplier) => {
        config.massMultiplier = multiplier;
    },
    setGravity: (g) => {
        config.G = g;
    },
    setTheta: (theta) => {
        config.BN_THETA = theta;
    },
    setMergeDistanceFactor: (factor) => {
         config.MERGE_DISTANCE_FACTOR = factor;
    },

    // --- Simulation Control ---
    startLoop: () => {
        if (spacetimeLoopId) return; // Already running
        const interval = 1000 / config.calculationsPerSec;
        spacetimeLoopId = setInterval(simulationStep, interval);
        startDebugLoop(); // Start debug logging
        console.log(`Spacetime loop started (${config.calculationsPerSec} calculations/sec)`);
    },

    stopLoop: () => {
        if (spacetimeLoopId) {
            clearInterval(spacetimeLoopId);
            spacetimeLoopId = null;
            stopDebugLoop(); // Stop debug logging
            console.log("Spacetime loop stopped.");
        }
    },

    // --- Particle Management ---
    addParticle: (options) => {
        // Ensure required options are present
        if (options.x === undefined || options.y === undefined || options.mass === undefined) {
            console.error("Cannot add particle: Missing x, y, or mass.", options);
            return;
        }
        const newParticle = new Particle(options);
        spacetime.push(newParticle);
    },

    clearSpacetime: () => {
        spacetime = [];
        bnDeleteTree(); // Clear the BH tree as well
        console.log("Spacetime cleared.");
    },

    // --- Accessing Data ---
    getParticles: () => {
        // Return a copy to prevent external modification of the internal array
        return [...spacetime];
    },

    // Find the particle currently marked for camera focus
    getFocusedParticle: () => {
        return spacetime.find(p => p.cameraFocus === true) || null;
    },

    // Cycle camera focus to the next/previous particle
    cycleFocus: (forward = true) => {
        if (spacetime.length === 0) return;

        const currentIndex = spacetime.findIndex(p => p.cameraFocus === true);
        let nextIndex = -1;

        if (currentIndex === -1) {
            // No particle currently focused, focus the first one
            nextIndex = 0;
        } else {
            spacetime[currentIndex].cameraFocus = false; // Unfocus current
            const direction = forward ? 1 : -1;
            nextIndex = (currentIndex + direction + spacetime.length) % spacetime.length;
        }

        if (nextIndex !== -1 && spacetime[nextIndex]) {
             spacetime[nextIndex].cameraFocus = true;
        }
    },

    // --- Manual Step ---
    // Allows running the simulation step by step externally
    step: simulationStep,

    // --- Get Config ---
    getConfig: () => ({...config}) // Return a copy
};

// Optional: Make the Particle class available if needed externally
export { Particle };
