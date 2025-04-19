import { spacetimeApi } from './spacetime.js';
import { renderApi } from './render.js';

// --------------
// | Private    |
// --------------

let canvas = null;
let config = {
    massMultiplier: 1, // Visual size exaggeration
    orbitMassSize: 2, // Default radius (screen pixels) for auto-orbit objects
    diskDensity: 2,   // Density factor for disk generation
    menuCustomMassEnabled: false // Track toggle state
};

// Mouse state specific to GUI logic (position, buttons, builder state)
const mouse = {
    clientX: 0,      // Current mouse X relative to viewport
    clientY: 0,      // Current mouse Y relative to viewport
    // --- Mass Builder State ---
    isDown: false,   // Is a mouse button currently pressed?
    button: -1,      // Which button is down (0=left, 1=middle, 2=right)
    state: 'placement', // 'placement', 'mass', 'velocity', 'disk'
    startX: 0,       // Mousedown X position (client coords)
    startY: 0,       // Mousedown Y position (client coords)
    anchorX: 0,      // Anchor X for mass/velocity radius (client coords)
    anchorY: 0,      // Anchor Y for mass/velocity radius (client coords)
    currentRadius: 0 // Calculated radius during mass/disk phase (client pixels)
};

// Calculate mass from the visual radius (screen pixels)
function calculateMassFromRadius(screenRadius) {
    if (!canvas || camera.zoom <= 0) return 0;
    const camera = renderApi.getCamera();
    const worldRadius = screenRadius / camera.zoom;
    // Formula from original (radius = cbrt(mass*density*multiplier / (4/3*PI)))
    // Assume density = 1 for builder
    // r^3 = mass * density * multiplier / (4/3*PI)
    // mass = r^3 * (4/3*PI) / (density * multiplier)
    const density = 1; // Assume density 1 for objects created via UI
    return (Math.pow(worldRadius, 3) * (4 / 3 * Math.PI)) / (density * config.massMultiplier);
}

// Handles placing an object in orbit around the focused object
function placeInAutoOrbit(targetX_world, targetY_world, mass) {
    const focusedObject = spacetimeApi.getFocusedParticle();
    if (!focusedObject) {
        console.warn("Cannot auto-orbit: No object is focused.");
        // Place statically instead?
         spacetimeApi.addParticle({
             x: targetX_world,
             y: targetY_world,
             mass: mass,
             velX: 0,
             velY: 0,
             density: 1 // Assume default density
         });
        return;
    }

    const dx = targetX_world - focusedObject.x;
    const dy = targetY_world - focusedObject.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-6) {
        console.warn("Cannot orbit: Too close to the focused object.");
        // Maybe just add the mass to the focused object?
        // focusedObject.mass += mass; // Be careful modifying directly
        return;
    }

    // Calculate orbital velocity (simplified circular orbit)
    // v = sqrt(G * M / r) - Assuming G=1 from spacetime config
    const G = spacetimeApi.getConfig().G || 1; // Get G from spacetime config
    const orbitalSpeed = Math.sqrt(G * focusedObject.mass / dist);

    // Calculate velocity vector perpendicular to displacement vector (dx, dy)
    // Angle = atan2(dy, dx). Perpendicular angle = Angle + PI/2
    const angle = Math.atan2(dy, dx);
    const velAngle = angle + Math.PI / 2;

    // Add focused object's velocity for relative orbit
    const { vx: focusVx, vy: focusVy } = focusedObject.getCurrentVelocity();

    const finalVelX = focusVx + Math.cos(velAngle) * orbitalSpeed;
    const finalVelY = focusVy + Math.sin(velAngle) * orbitalSpeed;

    spacetimeApi.addParticle({
        x: targetX_world,
        y: targetY_world,
        velX: finalVelX,
        velY: finalVelY,
        mass: mass,
        density: 1 // Assume default density
    });
}

// State machine logic for building/placing masses with mouse
function updateMassBuilderState(eventType) {
    const camera = renderApi.getCamera();

    switch (mouse.state) {
        case 'placement':
            if (eventType === 'mousedown') {
                mouse.startX = mouse.clientX;
                mouse.startY = mouse.clientY;
                mouse.isDown = true;

                if (mouse.button === 0) { // Left Mouse Button -> Custom Mass/Velocity
                    mouse.state = 'mass';
                    mouse.anchorX = mouse.clientX;
                    mouse.anchorY = mouse.clientY;
                    mouse.currentRadius = 0;
                } else if (mouse.button === 2) { // Right Mouse Button -> Auto Orbit
                    // Decide action based on toggle
                    if (config.menuCustomMassEnabled) {
                        // Right-click starts mass definition for auto-orbit size
                        mouse.state = 'mass'; // Go to mass state, but will auto-orbit on mouseup
                        mouse.anchorX = mouse.clientX;
                        mouse.anchorY = mouse.clientY;
                        mouse.currentRadius = 0;
                    } else {
                         // Place predefined size object immediately
                         const worldX = camera.screenToWorldX(mouse.clientX);
                         const worldY = camera.screenToWorldY(mouse.clientY);
                         const mass = calculateMassFromRadius(config.orbitMassSize);
                         placeInAutoOrbit(worldX, worldY, mass);
                         // No state change needed, action is instantaneous
                         mouse.isDown = false; // Reset isDown
                    }
                }
            }
            break; // End placement state

        case 'mass':
             if (eventType === 'mousemove' && mouse.isDown) {
                 // Update radius based on distance from anchor point
                 const dx = mouse.clientX - mouse.anchorX;
                 const dy = mouse.clientY - mouse.anchorY;
                 mouse.currentRadius = Math.sqrt(dx * dx + dy * dy);
             } else if (eventType === 'mouseup') {
                 mouse.isDown = false;
                 if (mouse.button === 0) { // Finished defining mass with Left Mouse
                     // Proceed to velocity definition state
                     mouse.state = 'velocity';
                     // Keep anchorX/Y (where mass is placed) and currentRadius
                 } else if (mouse.button === 2) { // Finished defining mass with Right Mouse (for Auto Orbit)
                     // Place the auto-orbiting object
                     const worldX = camera.screenToWorldX(mouse.anchorX);
                     const worldY = camera.screenToWorldY(mouse.anchorY);
                     const mass = calculateMassFromRadius(mouse.currentRadius > 0 ? mouse.currentRadius : config.orbitMassSize); // Use calculated or default size
                     placeInAutoOrbit(worldX, worldY, mass);
                     // Reset state
                     mouse.state = 'placement';
                     mouse.currentRadius = 0;
                 }
             }
             break; // End mass state

        case 'disk':
             if (eventType === 'mousemove' && mouse.isDown) {
                  // Update radius based on distance from anchor point
                 const dx = mouse.clientX - mouse.anchorX;
                 const dy = mouse.clientY - mouse.anchorY;
                 mouse.currentRadius = Math.sqrt(dx * dx + dy * dy);
             } else if (eventType === 'mouseup' && mouse.button === 0) { // Only trigger on left mouse release
                  mouse.isDown = false;
                  // Generate disk particles
                  const worldCenterX = camera.screenToWorldX(mouse.anchorX);
                  const worldCenterY = camera.screenToWorldY(mouse.anchorY);
                  const worldRadius = mouse.currentRadius / camera.zoom;

                  // Estimate number of particles based on density and area
                  // Original: count = (PI * screenRadius^2 / (50*50*zoom^2)) * density
                  // Effective world area = PI * worldRadius^2
                  // Let's use density as particles per unit area (e.g. per 10000 units^2)
                  const area = Math.PI * worldRadius * worldRadius;
                  const count = Math.max(1, Math.round(area / (100*100) * config.diskDensity)); // Density per 100x100 area

                  const particleMass = calculateMassFromRadius(config.orbitMassSize); // Use default size for disk particles

                  console.log(`Generating disk: Radius ${worldRadius.toFixed(1)}, Count ${count}, Mass ${particleMass.toFixed(3)}`);

                  for (let i = 0; i < count; i++) {
                      const angle = Math.random() * 2 * Math.PI;
                      // Distribute uniformly by area (use sqrt of random for radius)
                      const radiusSq = Math.random() * worldRadius * worldRadius;
                      const r = Math.sqrt(radiusSq);

                      const particleX = worldCenterX + r * Math.cos(angle);
                      const particleY = worldCenterY + r * Math.sin(angle);

                      placeInAutoOrbit(particleX, particleY, particleMass);
                  }

                  // Reset state
                  mouse.state = 'placement';
                  mouse.currentRadius = 0;
             }
             break; // End disk state


        case 'velocity':
            if (eventType === 'mousemove' && mouse.isDown) {
                // Velocity vector preview updates automatically via render module
            } else if (eventType === 'mouseup' && mouse.button === 0) { // Finish with Left Mouse
                mouse.isDown = false;
                // Calculate velocity based on vector from anchor to current mouse pos
                // Vector is (mouse.clientX - mouse.anchorX, mouse.clientY - mouse.anchorY) in screen coords
                // Scale this vector to determine world velocity (original used /100)
                const velScale = 0.01; // Adjust as needed
                const velX_screen = (mouse.clientX - mouse.anchorX) * velScale;
                const velY_screen = (mouse.clientY - mouse.anchorY) * velScale;

                // Convert screen velocity vector to world velocity vector (divide by zoom)
                const velX_world = -velX_screen / camera.zoom; // Negated in original code
                const velY_world = -velY_screen / camera.zoom;

                // Get final world position and mass
                const worldX = camera.screenToWorldX(mouse.anchorX);
                const worldY = camera.screenToWorldY(mouse.anchorY);
                const mass = calculateMassFromRadius(mouse.currentRadius);

                 spacetimeApi.addParticle({
                    x: worldX,
                    y: worldY,
                    velX: velX_world,
                    velY: velY_world,
                    mass: mass,
                    density: 1 // Default density
                 });

                // Reset state
                mouse.state = 'placement';
                mouse.currentRadius = 0;
            }
            break; // End velocity state
    }

    // Update the render module with the current preview state
    renderApi.setMousePreview({
        visible: mouse.state !== 'placement',
        state: mouse.state,
        x: mouse.clientX,         // Current mouse position
        y: mouse.clientY,
        x2: mouse.anchorX,       // Anchor position
        y2: mouse.anchorY,
        radius: mouse.currentRadius // Radius (screen pixels)
    });
}


// --- Event Handlers ---

function handleMouseDown(e) {
    if (!canvas || !canvas.contains(e.target)) return; // Only act on canvas clicks
    mouse.button = e.button; // 0=left, 1=middle, 2=right
    updateMassBuilderState('mousedown');
}

function handleMouseUp(e) {
    // Only process if a button *was* down matching the release button
    if (mouse.isDown && mouse.button === e.button) {
        updateMassBuilderState('mouseup');
    }
    // Always reset isDown on any mouseup
    mouse.isDown = false;
}

function handleMouseMove(e) {
    mouse.clientX = e.clientX;
    mouse.clientY = e.clientY;
    // Update state only if a button is currently held down
    if (mouse.isDown) {
        updateMassBuilderState('mousemove');
    } else {
         // Still update preview position even if button not down (e.g., for placement indicator)
         renderApi.setMousePreview({
             visible: mouse.state !== 'placement', // Show if not in placement
             state: mouse.state,
             x: mouse.clientX, y: mouse.clientY,
             x2: mouse.anchorX, y2: mouse.anchorY,
             radius: mouse.currentRadius
         });
    }
}

function handleMouseLeave(e) {
    // Optional: Cancel mass builder if mouse leaves canvas?
    if (mouse.isDown) {
         console.log("Mouse left canvas during drag, cancelling action.");
         mouse.isDown = false;
         mouse.state = 'placement';
         mouse.currentRadius = 0;
         updateMassBuilderState('cancel'); // Update preview
    }
}

// -------------
// | Public    |
// -------------

export const guiApi = {
    initialize: (canvasElement, initialMassMultiplier) => {
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            console.error("GUI requires a valid Canvas element.");
            return;
        }
        canvas = canvasElement;
        config.massMultiplier = initialMassMultiplier;

        // --- Connect UI Elements ---
        const menuShowGrid = document.getElementById('menu-toggle-grid');
        const menuCustomMass = document.getElementById('menu-toggle-custom-mass');
        const menuDrawPath = document.getElementById('menu-toggle-draw-path');
        const btnResetCamera = document.getElementById('menu-reset-camera');
        const btnGenDisk = document.getElementById('menu-gen-disk');
        const inputMassMultiplier = document.getElementById('menu-mass-multiplier');
        const inputOrbitMass = document.getElementById('menu-orbit-mass');
        const inputDiskDensity = document.getElementById('menu-disk-density');
        const inputZoom = document.getElementById('menu-zoom');
        const inputSpeed = document.getElementById('menu-speed');
        const btnClearSpace = document.getElementById('menu-clear-spacetime');
        const btnCycleFocus = document.getElementById('menu-cycle-focus');

        // Set initial states from HTML (if checked) or defaults
        if (menuShowGrid) {
            renderApi.setDrawGrid(menuShowGrid.checked);
            menuShowGrid.addEventListener('change', () => renderApi.setDrawGrid(menuShowGrid.checked));
        }
        if (menuCustomMass) {
            config.menuCustomMassEnabled = menuCustomMass.checked;
            menuCustomMass.addEventListener('change', () => config.menuCustomMassEnabled = menuCustomMass.checked);
        }
        if (menuDrawPath) {
            renderApi.setDrawPath(menuDrawPath.checked);
            menuDrawPath.addEventListener('change', () => renderApi.setDrawPath(menuDrawPath.checked));
        }

        // Buttons
        if (btnResetCamera) btnResetCamera.addEventListener('click', renderApi.resetCamera);
        if (btnClearSpace) btnClearSpace.addEventListener('click', spacetimeApi.clearSpacetime);
        if (btnCycleFocus) {
            // Use click for cycling forward, contextmenu (right-click) for backward
            btnCycleFocus.addEventListener('click', () => spacetimeApi.cycleFocus(true));
            btnCycleFocus.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Prevent browser context menu
                spacetimeApi.cycleFocus(false);
            });
        }
         if (btnGenDisk) {
             btnGenDisk.addEventListener('click', () => {
                 // Initiate disk generation state
                 const focused = spacetimeApi.getFocusedParticle();
                 const camera = renderApi.getCamera();
                 if (focused && camera) {
                     mouse.state = 'disk';
                     // Start anchor at focused object's screen position
                     mouse.anchorX = camera.worldToScreenX(focused.x);
                     mouse.anchorY = camera.worldToScreenY(focused.y);
                     mouse.isDown = true; // Simulate mouse down to start drawing radius
                     mouse.button = 0; // Act as if left mouse started it
                     mouse.currentRadius = 0;
                     updateMassBuilderState('startdisk'); // Update preview
                     console.log("Starting disk generation mode. Drag from center outwards and release.");
                 } else {
                      console.warn("Cannot generate disk: No object focused.");
                 }
             });
         }


        // Inputs
        if (inputMassMultiplier) {
             inputMassMultiplier.value = config.massMultiplier; // Set initial value
             inputMassMultiplier.addEventListener('change', () => {
                const val = parseFloat(inputMassMultiplier.value);
                if (!isNaN(val) && val > 0) {
                    config.massMultiplier = val;
                    renderApi.updateMassMultiplier(val); // Update render and spacetime via renderApi
                }
             });
        }
        if (inputOrbitMass) {
            inputOrbitMass.value = config.orbitMassSize;
             inputOrbitMass.addEventListener('change', () => {
                const val = parseFloat(inputOrbitMass.value);
                 if (!isNaN(val) && val > 0) config.orbitMassSize = val;
            });
        }
         if (inputDiskDensity) {
             inputDiskDensity.value = config.diskDensity;
             inputDiskDensity.addEventListener('change', () => {
                 const val = parseFloat(inputDiskDensity.value);
                 if (!isNaN(val) && val >= 0) config.diskDensity = val;
             });
         }
        if (inputZoom) {
             const initialZoom = renderApi.getCamera()?.zoom || 1.0;
             inputZoom.value = initialZoom.toFixed(1);
             inputZoom.addEventListener('change', () => renderApi.changeZoom(inputZoom.value));
        }
        if (inputSpeed) {
             const initialSpeed = spacetimeApi.getConfig()?.calculationSpeed || 1.0;
             inputSpeed.value = initialSpeed;
             inputSpeed.addEventListener('change', () => {
                 const val = parseFloat(inputSpeed.value);
                 if (!isNaN(val)) spacetimeApi.setCalculationSpeed(val); // Update spacetime directly
             });
        }

        // Attach mouse listeners to the canvas
        canvas.addEventListener('mousedown', handleMouseDown);
        // Attach mouseup and mousemove to the window to catch events outside canvas during drag
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave); // Handle cancellation

        console.log("GUI initialized.");
    },

    // Cleanup function
    destroy: () => {
         // Remove global listeners
         window.removeEventListener('mouseup', handleMouseUp);
         window.removeEventListener('mousemove', handleMouseMove);
         // Remove canvas listeners (assuming canvas ref is still valid)
         if (canvas) {
             canvas.removeEventListener('mousedown', handleMouseDown);
             canvas.removeEventListener('mouseleave', handleMouseLeave);
             // TODO: Remove listeners from buttons/inputs if necessary,
             // but usually not needed if the elements are simply removed from DOM.
         }
         canvas = null;
         console.log("GUI destroyed.");
    }
};
