// utility/canvasUtil.js

let canvas = null;

function resizeHandler() {
    if (!canvas) return;
    // Ensure canvas has dimensions before trying to read offset sizes
    if (canvas.offsetParent !== null) {
         // Use clientWidth/clientHeight for dimensions excluding borders/scrollbar
         canvas.width = canvas.clientWidth;
         canvas.height = canvas.clientHeight;
    }
    // Optional: Add a fallback or initial sizing if needed when not in DOM yet
    // else {
    //    console.warn("Canvas not ready for resize yet.");
    // }
}

// Exported API
export const canvasUtil = {
    initialize: (canvasElement) => {
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            console.error("canvasUtil requires a valid Canvas element.");
            return;
        }
        canvas = canvasElement;
        // Initial resize attempt
        requestAnimationFrame(resizeHandler); // Use rAF to wait for layout
    },

    autoResize: () => {
        window.addEventListener('resize', resizeHandler);
        // Call initial resize one more time to be sure
        requestAnimationFrame(resizeHandler);
    },

    // Optional: Function to stop resizing if needed
    stopAutoResize: () => {
         window.removeEventListener('resize', resizeHandler);
    },

    getCanvas: () => canvas // Allow other modules to get the canvas reference if needed
};
