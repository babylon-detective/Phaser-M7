// Wait for DOM to load
window.addEventListener('load', () => {
    const config = {
        type: Phaser.CANVAS,
        canvas: document.getElementById('game-canvas'),
        parent: 'game-container',
        scale: {
            mode: Phaser.Scale.RESIZE,
            width: window.innerWidth,
            height: window.innerHeight,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        backgroundColor: '#000000',
        render: {
            antialias: false,
            pixelArt: true,
            roundPixels: true
        },
        scene: {
            create: create,
            update: update
        }
    };

    const game = new Phaser.Game(config);
});

// Camera and perspective settings
let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let horizon = Math.floor(SCREEN_HEIGHT * 0.65); // Move horizon to 65% from top
const scale = 1;
const baseScale = 16;  // Doubled for faster ground movement effect
const cameraHeight = 200;
const MAX_HORIZON_TILT = 0.3; // Maximum banking angle

// Forward movement settings
let forwardSpeed = 0;
const SPEED_STAGES = [0, 200, 400, 800]; // Adjusted speed values for smoother transitions
let currentSpeedStage = 0;
const MAX_SPEED_STAGE = 3;
const GRID_SIZE = 80; // Slightly smaller grid for smoother appearance
let scrollOffset = 0;

// Camera/world variables
let position = { x: 0, y: 0, z: 0 };  // Added z position for forward movement
let angle = 0;
let horizonTilt = 0; // Current horizon tilt angle

// Player variables
let player = {
    // Main (larger) rectangle
    x: SCREEN_WIDTH / 2,    // Screen position X
    y: SCREEN_HEIGHT * 0.45,   // Position at 45% from top (above horizon)
    size: Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.12,  // Increased size
    angle: 0,              // Facing angle
    speed: 0,             // Current speed
    maxSpeed: 32,          // Doubled again for much faster movement
    moveSpeed: 32,         // Doubled again for faster response
    acceleration: 2.0,    // Doubled for faster acceleration
    deceleration: 0.8,    // Doubled for faster deceleration
    worldX: 0,           // World position X
    worldY: 0,           // World position Y
    
    // Leading (smaller) rectangle
    leader: {
        x: SCREEN_WIDTH / 2,
        y: SCREEN_HEIGHT * 0.45,    // Match main rectangle Y position
        size: Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.06,  // Half the size of main rectangle
        maxDistance: 160,  // Increased for wider turns at high speed
        moveSpeed: 48     // Doubled for even faster response
    }
};

let keys;
let touchControls = {
    left: false,
    right: false,
    up: false,
    down: false,
    accelerate: false
};

function create() {
    this.graphics = this.add.graphics();
    
    keys = this.input.keyboard.addKeys({
        'W': Phaser.Input.Keyboard.KeyCodes.W,
        'S': Phaser.Input.Keyboard.KeyCodes.S,
        'A': Phaser.Input.Keyboard.KeyCodes.A,
        'D': Phaser.Input.Keyboard.KeyCodes.D
    });

    // Add separate handling for both = and + keys
    const equalsKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EQUALS);
    const plusKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    const minusKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);

    let lastTapTime = 0;
    const TAP_THRESHOLD = 300;

    const handleSpeedIncrease = () => {
        const currentTime = Date.now();
        if (currentTime - lastTapTime > TAP_THRESHOLD) {
            if (currentSpeedStage < MAX_SPEED_STAGE) {
                currentSpeedStage++;
                forwardSpeed = SPEED_STAGES[currentSpeedStage];
                console.log(`Speed increased to stage ${currentSpeedStage}, speed: ${forwardSpeed}`);
            }
            lastTapTime = currentTime;
        }
    };

    equalsKey.on('down', handleSpeedIncrease);
    plusKey.on('down', handleSpeedIncrease);

    minusKey.on('down', () => {
        if (currentSpeedStage > 0) {
            currentSpeedStage--;
            forwardSpeed = SPEED_STAGES[currentSpeedStage];
            console.log(`Speed decreased to stage ${currentSpeedStage}, speed: ${forwardSpeed}`);
        }
    });

    // Add touch event listeners
    this.input.on('pointerdown', handleTouchStart, this);
    this.input.on('pointermove', handleTouchMove, this);
    this.input.on('pointerup', handleTouchEnd, this);

    // Handle window resize
    window.addEventListener('resize', () => {
        SCREEN_WIDTH = window.innerWidth;
        SCREEN_HEIGHT = window.innerHeight;
        horizon = Math.floor(SCREEN_HEIGHT * 0.65);
        player.size = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.12;
        player.leader.size = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.06;
        player.y = SCREEN_HEIGHT * 0.45;
        player.leader.y = SCREEN_HEIGHT * 0.45;
    });
}

// Add these new functions for touch controls
function handleTouchStart(pointer) {
    updateTouchControls(pointer);
}

function handleTouchMove(pointer) {
    updateTouchControls(pointer);
}

function handleTouchEnd() {
    // Reset all touch controls
    Object.keys(touchControls).forEach(key => touchControls[key] = false);
}

function updateTouchControls(pointer) {
    const x = pointer.x;
    const y = pointer.y;
    
    // Left side of screen for movement
    if (x < SCREEN_WIDTH / 2) {
        touchControls.left = x < SCREEN_WIDTH / 4;
        touchControls.right = x >= SCREEN_WIDTH / 4;
        touchControls.up = y < SCREEN_HEIGHT / 2;
        touchControls.down = y >= SCREEN_HEIGHT / 2;
    } 
    // Right side of screen for acceleration
    else {
        touchControls.accelerate = true;
    }
}

function update() {
    handlePlayerInput();
    
    // Update forward movement and scroll offset based on current speed stage
    position.z += forwardSpeed;
    
    // Smoother scroll speed calculation
    const scrollSpeedMultiplier = 0.02; // Reduced for smoother scrolling
    scrollOffset = (scrollOffset + forwardSpeed * scrollSpeedMultiplier);
    if (scrollOffset > GRID_SIZE) {
        scrollOffset -= GRID_SIZE; // Smooth wrap-around instead of reset
    }
    
    this.graphics.clear();
    
    // Update horizon tilt based on movement with faster response
    const targetTilt = (player.leader.x - player.x) / player.leader.maxDistance * -MAX_HORIZON_TILT;
    horizonTilt = Phaser.Math.Linear(horizonTilt, targetTilt, 0.2);
    
    // Calculate horizon line positions
    const horizonY1 = horizon - Math.sin(horizonTilt) * (SCREEN_WIDTH / 2);
    const horizonY2 = horizon + Math.sin(horizonTilt) * (SCREEN_WIDTH / 2);

    // Draw rotated sky background
    this.graphics.save();
    this.graphics.fillStyle(0x87CEEB);
    
    // Create tilted sky polygon
    this.graphics.beginPath();
    this.graphics.moveTo(0, 0);
    this.graphics.lineTo(SCREEN_WIDTH, 0);
    this.graphics.lineTo(SCREEN_WIDTH, horizonY2);
    this.graphics.lineTo(0, horizonY1);
    this.graphics.closePath();
    this.graphics.fill();
    
    // Draw ground with Mode 7 perspective and tilted horizon
    for (let screenY = 0; screenY < SCREEN_HEIGHT; screenY++) {
        for (let screenX = 0; screenX < SCREEN_WIDTH; screenX++) {
            const xProgress = (screenX - SCREEN_WIDTH / 2) / (SCREEN_WIDTH / 2);
            const horizonYAtX = horizon + Math.sin(horizonTilt) * (SCREEN_WIDTH / 2) * xProgress;
            
            const distanceFromHorizon = screenY - horizonYAtX;
            if (distanceFromHorizon <= 0) continue;
            
            // Apply Mode 7 perspective with forward movement
            const z = (distanceFromHorizon * baseScale) + position.z;
            const scaleLine = cameraHeight / distanceFromHorizon;
            
            let worldX = (screenX - SCREEN_WIDTH / 2) * scaleLine;
            let worldY = z;

            let rotatedX = worldX * Math.cos(angle) - worldY * Math.sin(angle);
            let rotatedY = worldX * Math.sin(angle) + worldY * Math.cos(angle);
            
            let finalX = rotatedX - position.x;
            let finalY = rotatedY - position.y;
            
            // Adjust grid pattern based on speed and scroll offset
            const speedAdjustedGridSize = GRID_SIZE * (1 + (currentSpeedStage * 0.25)); // Reduced scaling factor
            const adjustedY = finalY + scrollOffset;
            
            // Smoother grid pattern calculation
            const gridX = finalX / speedAdjustedGridSize;
            const gridY = adjustedY / speedAdjustedGridSize;
            const isGrid = (Math.floor(gridX) + Math.floor(gridY)) % 2 === 0;
            
            // Smoother color transitions
            const speedFactor = currentSpeedStage / MAX_SPEED_STAGE;
            const baseColor = isGrid ? 0x00ff00 : 0x008800;
            const brightnessBoost = Math.floor(speedFactor * 30); // Reduced brightness variation
            
            this.graphics.fillStyle(adjustColorBrightness(baseColor, brightnessBoost));
            this.graphics.fillPoint(screenX, screenY, 1);
        }
    }

    // Draw tilted horizon line
    this.graphics.lineStyle(2, 0xFF0000);
    this.graphics.beginPath();
    this.graphics.moveTo(0, horizonY1);
    this.graphics.lineTo(SCREEN_WIDTH, horizonY2);
    this.graphics.strokePath();

    // Draw player
    drawPlayer(this.graphics);
    
    // Update speed indicator to show discrete stages
    this.graphics.fillStyle(0xffffff);
    const speedBarWidth = (currentSpeedStage / MAX_SPEED_STAGE) * 200;
    const speedBarHeight = 20;
    this.graphics.fillRect(10, 10, speedBarWidth, speedBarHeight);
    
    // Clear any existing speed text before adding new one
    if (this.speedText) {
        this.speedText.destroy();
    }
    
    // Add speed stage indicator text
    const speedTexts = ['STOP', 'SLOW', 'MED', 'FAST'];
    this.speedText = this.add.text(220, 10, speedTexts[currentSpeedStage], { 
        fontSize: '20px',
        fill: '#ffffff'
    }).setDepth(1);
}

function handlePlayerInput() {
    let dx = 0;
    let dy = 0;

    // Calculate movement direction for leader
    if (keys.W.isDown || touchControls.up) {
        dy = -1;
    }
    if (keys.S.isDown || touchControls.down) {
        dy = 1;
    }
    if (keys.A.isDown || touchControls.left) {
        dx = -1;
    }
    if (keys.D.isDown || touchControls.right) {
        dx = 1;
    }

    // Move leader
    if (dx !== 0 || dy !== 0) {
        // Normalize diagonal movement
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = dx / length;
        dy = dy / length;

        player.leader.x += dx * player.leader.moveSpeed;
        player.leader.y += dy * player.leader.moveSpeed;

        // Calculate angle based on movement direction
        player.angle = Math.atan2(dy, dx);
    }

    // Keep leader within maximum distance of main rectangle
    const deltaX = player.leader.x - player.x;
    const deltaY = player.leader.y - player.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > player.leader.maxDistance) {
        const angle = Math.atan2(deltaY, deltaX);
        player.leader.x = player.x + Math.cos(angle) * player.leader.maxDistance;
        player.leader.y = player.y + Math.sin(angle) * player.leader.maxDistance;
    }

    // Move main rectangle towards leader
    if (distance > 5) {  // Only move if there's significant distance
        const angle = Math.atan2(deltaY, deltaX);
        player.x += Math.cos(angle) * player.moveSpeed * (distance / player.leader.maxDistance);
        player.y += Math.sin(angle) * player.moveSpeed * (distance / player.leader.maxDistance);
    }

    // Keep both rectangles on screen
    player.x = Phaser.Math.Clamp(player.x, player.size/2, SCREEN_WIDTH - player.size/2);
    player.y = Phaser.Math.Clamp(player.y, player.size/2, SCREEN_HEIGHT - player.size/2);
    player.leader.x = Phaser.Math.Clamp(player.leader.x, player.leader.size/2, SCREEN_WIDTH - player.leader.size/2);
    player.leader.y = Phaser.Math.Clamp(player.leader.y, player.leader.size/2, SCREEN_HEIGHT - player.leader.size/2);

    // Update world position based on leader's movement
    if (distance > 0) {
        const moveAngle = Math.atan2(deltaY, deltaX);
        position.x -= Math.cos(moveAngle) * (distance / player.leader.maxDistance) * player.maxSpeed;
        position.y -= Math.sin(moveAngle) * (distance / player.leader.maxDistance) * player.maxSpeed;
    }
}

function drawPlayer(graphics) {

    
    // Draw leading (smaller) rectangle
    graphics.lineStyle(2, 0xFFFF00);
    graphics.fillStyle(0xFFFF00, 0.7); // Yellow with 70% transparency
    
    // Draw centered smaller square
    graphics.fillRect(
        player.leader.x - player.leader.size/2,
        player.leader.y - player.leader.size/2,
        player.leader.size,
        player.leader.size
    );

        // Draw main (larger) rectangle
    graphics.lineStyle(2, 0xFF0000);
    graphics.fillStyle(0xFF0000, 1.0); // Red with 50% transparency
    
    // Draw centered larger square
    graphics.fillRect(
        player.x - player.size/2, 
        player.y - player.size/2, 
        player.size, 
        player.size
    );
    
    // Draw line connecting the rectangles
    graphics.lineStyle(1, 0xFFFFFF, 0.5);
    graphics.beginPath();
    graphics.moveTo(player.x, player.y);
    graphics.lineTo(player.leader.x, player.leader.y);
    graphics.strokePath();
}

// Helper function to adjust color brightness
function adjustColorBrightness(color, amount) {
    const r = Math.min(255, ((color >> 16) & 0xFF) + amount);
    const g = Math.min(255, ((color >> 8) & 0xFF) + amount);
    const b = Math.min(255, (color & 0xFF) + amount);
    return (r << 16) | (g << 8) | b;
}