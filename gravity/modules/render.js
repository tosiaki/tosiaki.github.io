// modules/render.js
import { spacetimeApi } from './spacetime.js'; // Import the modernized spacetime API

// -----------
// | Private |
// -----------

let canvas = null;
let ctx = null;
let renderLoopId = null;
const fps = 60;
let config = {
    massMultiplier: 1, // Will be set during initialization
    showGrid: true,
    drawPath: false,
};

// Mouse state (updated by GUI module) for drawing builder preview
let mousePreview = {
    visible: false,
    state: 'placement', // 'placement', 'mass', 'velocity', 'disk'
    x: 0, y: 0,        // Current mouse coords (client)
    x2: 0, y2: 0,       // Anchor point for mass/velocity (client)
    radius: 0           // Radius for mass/disk preview (client pixels)
};

const camera = {
    x: 0, y: 0,       // Top-left corner of the view in world coordinates
    marginX: 0,       // User-defined offset X from focused object center
    marginY: 0,       // User-defined offset Y from focused object center
    preferredX: 0,    // Target marginX during animation
    preferredY: 0,    // Target marginY during animation
    zoom: 1,          // Camera zoom level
    preferredZoom: 1, // Target zoom during animation
    drag: 50,         // Amount to move margin per key press (world units?)
    xIT: 0,           // Animation iterations remaining for X margin
    yIT: 0,           // Animation iterations remaining for Y margin
    zoomIT: 0,        // Animation iterations remaining for zoom
    // --- Internal animation state ---
    _initialMarginX: 0, _offsetX: 0,
    _initialMarginY: 0, _offsetY: 0,
    _initialZoom: 1, _offsetZoom: 0,
    // --- Coordinate Conversion ---
    // World coordinates to Screen coordinates
    worldToScreenX: (worldX) => (worldX - camera.x) * camera.zoom,
    worldToScreenY: (worldY) => (worldY - camera.y) * camera.zoom,
    // Screen coordinates to World coordinates
    screenToWorldX: (screenX) => camera.x + screenX / camera.zoom,
    screenToWorldY: (screenY) => camera.y + screenY / camera.zoom
};

function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // No need for beginPath here, drawing functions will start their own
}

// Handles WASDQE camera movement input
function handleCameraKeyPress(e) {
    const key = e.key.toLowerCase();
    let targetZoomElement = document.getElementById('menu-zoom'); // Quick access for updating input value

    switch (key) {
        case 'w':
            camera.preferredY -= camera.drag / camera.zoom; // Adjust drag based on zoom
            camera.yIT = fps; // Start animation (1 second)
            break;
        case 'a':
            camera.preferredX -= camera.drag / camera.zoom;
            camera.xIT = fps;
            break;
        case 's':
            camera.preferredY += camera.drag / camera.zoom;
            camera.yIT = fps;
            break;
        case 'd':
            camera.preferredX += camera.drag / camera.zoom;
            camera.xIT = fps;
            break;
        case 'e': // Zoom In
            camera.preferredZoom = Math.max(0.1, Math.round((camera.preferredZoom + 0.1) * 10) / 10); // Prevent zoom <= 0
            if (targetZoomElement) targetZoomElement.value = camera.preferredZoom.toFixed(1);
            camera.zoomIT = fps;
            break;
        case 'q': // Zoom Out
             camera.preferredZoom = Math.max(0.1, Math.round((camera.preferredZoom - 0.1) * 10) / 10);
            if (targetZoomElement) targetZoomElement.value = camera.preferredZoom.toFixed(1);
            camera.zoomIT = fps;
            break;
        case 'r': // Reset Camera
            api.resetCamera(); // Use the exported API function
            break;
    }
}

// Interpolation function (smooth step or similar can be used)
// Original used sqrt, let's replicate that effect (though lerp might be simpler)
function interpolateSqrt(current, target, initial, totalSteps, remainingSteps) {
    if (remainingSteps <= 0) return target;
    if (totalSteps <= 0) return target;

    const totalDist = target - initial;
    if (Math.abs(totalDist) < 1e-6) return target; // Avoid division by zero / NaN

    const fractionDone = (totalSteps - remainingSteps) / totalSteps; // 0 to 1
    // Original formula rearranged: sign(offset) * sqrt(offset^2 - (offset * remaining/total - offset)^2)
    // Let offset = totalDist, t = fractionDone = (totalSteps - remaining) / totalSteps
    // offset * remaining/total - offset = offset * (remaining/total - 1) = offset * (remaining - total)/total = offset * (-fractionDone)
    // = sign(offset) * sqrt(offset^2 - (-offset*fractionDone)^2)
    // = sign(offset) * sqrt(offset^2 * (1 - fractionDone^2))
    // = sign(offset) * abs(offset) * sqrt(1 - fractionDone^2)
    // = totalDist * sqrt(1 - fractionDone^2) -- This seems wrong, doesn't end at target.

    // Let's reinterpret the original logic: it calculates the *change* from the initial value.
    // change = sign(offsetX) * sqrt(offsetX^2 - (offsetX * (fps - iter)/fps - offsetX)^2)
    // Let totalSteps = fps, remainingSteps = iter. fractionRemaining = iter/fps
    // change = sign(offset) * sqrt(offset^2 - (offset * fractionRemaining - offset)^2)
    // change = sign(offset) * sqrt(offset^2 - (offset * (fractionRemaining - 1))^2)
    // change = sign(offset) * sqrt(offset^2 * (1 - (fractionRemaining - 1)^2))
    // change = sign(offset) * |offset| * sqrt(1 - (1-fractionRemaining)^2)
    // change = offset * sqrt(1 - (1-fractionRemaining)^2) // Where fractionRemaining = remainingSteps / totalSteps

    const fractionRemaining = remainingSteps / totalSteps;
    const change = target - initial; // Total change needed = offset
    const currentChange = change * Math.sqrt(1 - Math.pow(1 - fractionRemaining, 2)); // This should give the change *from* initial at this step

    // It seems the formula intended to calculate the instantaneous value directly, let's try simple lerp first
    // return current + (target - current) * 0.1; // Simple exponential decay / lerp

    // Let's stick to the original complex formula if possible, maybe it calculates the *current value* not the change
    const offset = target - initial;
    if (Math.abs(offset) < 1e-6) return target;
    const value = initial + Math.sign(offset) * Math.sqrt(Math.pow(offset, 2) - Math.pow(offset * (remainingSteps / totalSteps) - offset, 2));
    // Need to be careful with NaN if the term inside sqrt becomes negative due to floating point errors
     if (isNaN(value)) {
         // console.warn("NaN in interpolation, snapping to target.");
         return target;
     }
     return value;

}


// Updates camera position, centering on the focused object with smooth interpolation
function updateCamera() {
    const focusedObject = spacetimeApi.getFocusedParticle(); // Get from spacetime module

    if (focusedObject) {
        // Animate Margins (User Offset)
        if (camera.xIT > 0) {
            if (camera.xIT === fps) { // First step of animation
                camera._offsetX = camera.preferredX - camera.marginX;
                camera._initialMarginX = camera.marginX;
            }
            camera.xIT -= 1;
            camera.marginX = interpolateSqrt(camera.marginX, camera.preferredX, camera._initialMarginX, fps, camera.xIT);
        } else {
            camera.marginX = camera.preferredX;
        }

        if (camera.yIT > 0) {
             if (camera.yIT === fps) {
                camera._offsetY = camera.preferredY - camera.marginY;
                camera._initialMarginY = camera.marginY;
            }
            camera.yIT -= 1;
            camera.marginY = interpolateSqrt(camera.marginY, camera.preferredY, camera._initialMarginY, fps, camera.yIT);
        } else {
            camera.marginY = camera.preferredY;
        }

        // Animate Zoom
        if (camera.zoomIT > 0) {
            if (camera.zoomIT === fps) {
                camera._offsetZoom = camera.preferredZoom - camera.zoom;
                camera._initialZoom = camera.zoom;
            }
             camera.zoomIT -= 1;
             camera.zoom = interpolateSqrt(camera.zoom, camera.preferredZoom, camera._initialZoom, fps, camera.zoomIT);
             // Clamp zoom to prevent issues
             camera.zoom = Math.max(0.01, camera.zoom); // Set a minimum zoom level
        } else {
            camera.zoom = Math.max(0.01, camera.preferredZoom);
        }

        // Calculate final camera world coordinates (top-left)
        if (canvas && camera.zoom > 0) {
            camera.x = focusedObject.x - (canvas.width / 2 / camera.zoom) + camera.marginX;
            camera.y = focusedObject.y - (canvas.height / 2 / camera.zoom) + camera.marginY;
        }
    } else {
        // Optional: Handle case where no object is focused (e.g., free camera?)
        // For now, do nothing, camera stays where it was.
        // Or reset margins if desired:
         camera.xIT = 0; camera.yIT = 0; // Stop margin animation if object lost
         camera.marginX = camera.preferredX;
         camera.marginY = camera.preferredY;
         // Keep zoom animation going if active
         if (camera.zoomIT > 0) {
             if (camera.zoomIT === fps) { /* setup initial/offset */ }
             camera.zoomIT--;
             camera.zoom = interpolateSqrt(camera.zoom, camera.preferredZoom, camera._initialZoom, fps, camera.zoomIT);
             camera.zoom = Math.max(0.01, camera.zoom);
         } else {
             camera.zoom = Math.max(0.01, camera.preferredZoom);
         }
         // Camera world position (x, y) remains unchanged without focus
    }
}

function renderObject(particle) {
    if (!ctx || !canvas) return;

    const screenX = camera.worldToScreenX(particle.x);
    const screenY = camera.worldToScreenY(particle.y);
    const radius = particle.getRadius(); // Use the method from the Particle class
    const screenRadius = radius * camera.zoom;

    // Basic culling: Don't draw if object is way off-screen
    const cullMargin = Math.max(screenRadius, 50); // Add margin based on radius
    if (screenX < -cullMargin || screenX > canvas.width + cullMargin ||
        screenY < -cullMargin || screenY > canvas.height + cullMargin) {
        return;
    }

    // Draw Path
    if (config.drawPath && particle.path && particle.path.length > 1) {
        ctx.beginPath();
        const start = particle.path[0];
        ctx.moveTo(camera.worldToScreenX(start.x), camera.worldToScreenY(start.y));

        // Using quadratic curves for smoothing (as in original)
        if (particle.path.length === 2) {
             const end = particle.path[1];
             ctx.lineTo(camera.worldToScreenX(end.x), camera.worldToScreenY(end.y));
        } else {
            for (let i = 1; i < particle.path.length - 2; i++) {
                const p1 = particle.path[i];
                const p2 = particle.path[i + 1];
                const xc = (p1.x + p2.x) / 2;
                const yc = (p1.y + p2.y) / 2;
                ctx.quadraticCurveTo(
                    camera.worldToScreenX(p1.x), camera.worldToScreenY(p1.y),
                    camera.worldToScreenX(xc), camera.worldToScreenY(yc)
                );
            }
            // Curve through the last two points
            const p_last2 = particle.path[particle.path.length - 2];
            const p_last1 = particle.path[particle.path.length - 1];
             ctx.quadraticCurveTo(
                camera.worldToScreenX(p_last2.x), camera.worldToScreenY(p_last2.y),
                camera.worldToScreenX(p_last1.x), camera.worldToScreenY(p_last1.y)
            );
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = "#AAAAAA"; // Slightly lighter grey for paths
        ctx.stroke();
    }

    // Draw Object Circle
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(1, screenRadius), 0, 2 * Math.PI, false); // Ensure min radius of 1px

    ctx.fillStyle = particle.cameraFocus ? '#40A2BF' : '#000000'; // Blue if focused, black otherwise
    ctx.fill();

    // Optional: Add stroke for visibility on dark backgrounds
    // ctx.strokeStyle = "#666666";
    // ctx.lineWidth = 1;
    // ctx.stroke();
}

// Renders the preview circle/line for the mass builder UI
function renderMassBuilderPreview() {
    if (!mousePreview.visible || !ctx) return;

    ctx.fillStyle = 'rgba(170, 170, 170, 0.7)'; // Semi-transparent grey
    ctx.strokeStyle = '#D55'; // Red for velocity line
    ctx.lineWidth = 2;

    switch (mousePreview.state) {
        case 'placement':
            // Maybe draw a small cursor target? For now, do nothing.
            break;
        case 'mass':
            // Draw circle originating from mouse.x2, y2 with radius
            ctx.beginPath();
            ctx.arc(mousePreview.x2, mousePreview.y2, mousePreview.radius, 0, 2 * Math.PI);
            ctx.fill();
            break;
        case 'disk':
             // Draw larger circle for disk area
            ctx.beginPath();
            ctx.arc(mousePreview.x2, mousePreview.y2, mousePreview.radius, 0, 2 * Math.PI);
            ctx.fill();
            break;
        case 'velocity':
            // Draw circle (final size) and velocity line
            ctx.beginPath();
            ctx.arc(mousePreview.x2, mousePreview.y2, mousePreview.radius, 0, 2 * Math.PI);
            ctx.fill();
            // Draw line from placement point (x2, y2) to current mouse (x, y)
            ctx.beginPath();
            ctx.moveTo(mousePreview.x2, mousePreview.y2);
            ctx.lineTo(mousePreview.x, mousePreview.y);
            ctx.stroke();
            break;
    }
}

// Renders a grid based on camera position and zoom
function renderGrid(spacing, color) {
    if (!config.showGrid || !ctx || !canvas || camera.zoom <= 0) return;

    const gridSize = spacing * camera.zoom; // Size of grid squares in screen pixels

    // Calculate the range of grid lines needed based on world coords viewable
    const worldLeft = camera.x;
    const worldTop = camera.y;
    const worldRight = camera.x + canvas.width / camera.zoom;
    const worldBottom = camera.y + canvas.height / camera.zoom;

    // Determine start/end lines based on world coords snapped to grid spacing
    const startX = Math.floor(worldLeft / spacing) * spacing;
    const endX = Math.ceil(worldRight / spacing) * spacing;
    const startY = Math.floor(worldTop / spacing) * spacing;
    const endY = Math.ceil(worldBottom / spacing) * spacing;

    ctx.beginPath(); // Start path for all grid lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = startX; x <= endX; x += spacing) {
        const screenX = camera.worldToScreenX(x);
        // Draw line only if it's roughly within canvas bounds
        if (screenX >= -1 && screenX <= canvas.width + 1) {
             ctx.moveTo(screenX, 0);
             ctx.lineTo(screenX, canvas.height);
        }
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += spacing) {
        const screenY = camera.worldToScreenY(y);
        if (screenY >= -1 && screenY <= canvas.height + 1) {
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
        }
    }

    ctx.stroke(); // Draw all lines at once
}

// Main rendering function called each frame
function renderFrame() {
    if (!canvas || !ctx) return;

    const particles = spacetimeApi.getParticles(); // Get current particles

    clearCanvas();
    updateCamera(); // Update camera position based on focus and animation

    if (config.showGrid) {
        renderGrid(50, "#EEEEEE"); // Render light grey grid with 50 world unit spacing
        // Optional: Render a coarser grid
        // renderGrid(250, "#DDDDDD");
    }

    // Render particles
    for (const particle of particles) {
        renderObject(particle);
    }

    // Render UI elements like the mass builder preview
    renderMassBuilderPreview();
}

// ----------
// | Public |
// ----------

export const renderApi = {
    initialize: (canvasElement, initialMassMultiplier) => {
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            console.error("Render initialization requires a valid Canvas element.");
            return;
        }
        canvas = canvasElement;
        ctx = canvas.getContext('2d');
        config.massMultiplier = initialMassMultiplier;

        // Disable canvas context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Add WASDQE camera movement listener
        document.addEventListener('keypress', handleCameraKeyPress); // Using keypress for WASDQE as in original
        console.log("Render initialized.");
    },

    startLoop: () => {
        if (renderLoopId) return; // Already running
        renderLoopId = setInterval(renderFrame, 1000 / fps);
        console.log(`Render loop started (${fps} fps)`);
    },

    stopLoop: () => {
        if (renderLoopId) {
            clearInterval(renderLoopId);
            renderLoopId = null;
            console.log("Render loop stopped.");
        }
    },

    // --- Configuration ---
    setDrawGrid: (show) => {
        config.showGrid = !!show;
    },
    setDrawPath: (show) => {
        config.drawPath = !!show;
    },
    updateMassMultiplier: (multiplier) => {
        config.massMultiplier = multiplier;
        // Need to update spacetimeApi as well if it uses this directly
        spacetimeApi.setMassMultiplier(multiplier);
    },
    changeZoom: (zoomLevel) => {
        const newZoom = parseFloat(zoomLevel);
        if (!isNaN(newZoom) && newZoom > 0) {
            camera.preferredZoom = newZoom;
            camera.zoomIT = fps; // Start animation
        }
    },

    // --- UI Interaction ---
    // Update the state for the mass builder preview
    setMousePreview: (previewState) => {
        mousePreview = { ...previewState }; // Copy the state
    },

    // --- Camera Control ---
    getCamera: () => {
        // Return a copy or specific methods to avoid direct modification?
        // For now, return direct reference, but careful use is needed.
        return camera;
    },
    resetCamera: () => {
        camera.preferredX = 0;
        camera.preferredY = 0;
        camera.preferredZoom = 1.0;

        // Update the input field if it exists
        const zoomInput = document.getElementById('menu-zoom');
		if (zoomInput) zoomInput.value = camera.preferredZoom.toFixed(1);


        camera.xIT = fps; // Start animation
        camera.yIT = fps;
        camera.zoomIT = fps;
    },

    // --- Cleanup ---
    destroy: () => {
        renderApi.stopLoop();
        document.removeEventListener('keypress', handleCameraKeyPress);
        if (canvas) {
             canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        }
        canvas = null;
        ctx = null;
        console.log("Render destroyed.");
    }
};
