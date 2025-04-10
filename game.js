// Wait for DOM to load
window.addEventListener('load', () => {
    const config = {
        type: Phaser.WEBGL,
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
const HORIZON_VERTICAL_MARGIN = 200; // Increased from 100 to 200 for wider movement range

// Dash settings
const DASH_SPEED = 1600; // Doubled dash speed
const DASH_DURATION = 100; // Halved dash duration for quicker dashes
const DASH_COOLDOWN = 500; // Halved cooldown for more frequent dashes

// Forward movement settings
let forwardSpeed = 0;
const SPEED_STAGES = [0, 400, 800, 1600]; // Doubled all speed values
let currentSpeedStage = 0;
const MAX_SPEED_STAGE = 3;
const GRID_SIZE = 100;
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
    size: Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.15,
    angle: 0,              // Facing angle
    speed: 0,             // Current speed
    maxSpeed: 64,          // Doubled for faster movement
    moveSpeed: 64,         // Doubled for faster response
    acceleration: 4.0,    // Doubled for faster acceleration
    deceleration: 1.6,    // Doubled for faster deceleration
    worldX: 0,           // World position X
    worldY: 0,           // World position Y
    
    // Leading (smaller) rectangle
    leader: {
        x: SCREEN_WIDTH / 2,
        y: SCREEN_HEIGHT * 0.45,    // Match main rectangle Y position
        size: Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.06,
        maxDistance: 320,  // Doubled for wider turns at high speed
        moveSpeed: 96     // Doubled for even faster response
    },
    isDashing: false,
    dashCooldown: 0,
    lastDashTime: 0,
    dashDirection: { x: 0, y: 0 }
};

let keys;

// Add these constants near the top with other constants
const GRID_COLOR_1 = 0x00AA00; // Darker green for better contrast
const GRID_COLOR_2 = 0x00FF00; // Brighter green
const GRID_COLOR_3 = 0x00CC00; // New middle shade
const GRID_PATTERN_SIZE = 4; // Size of the non-repeating pattern
const GRID_LINE_WIDTH = 1; // Thinner grid lines
const GROUND_COLOR_NEAR = 0x00FF00;  // Bright green near the horizon
const GROUND_COLOR_FAR = 0x003300;   // Dark green in the distance
const GRADIENT_INTENSITY = 1.5;      // Controls how quickly the gradient changes
const TILE_SIZE = 100; // Size of each tile
const X_COLOR = 0x00AA00; // Color for the X pattern
const X_WIDTH = 2; // Width of the X lines
const NOISE_SCALE = 0.01;
const WAVE_FREQUENCY = 0.05;
const WAVE_AMPLITUDE = 0.2;
const PATTERN_SCALE = 0.1;
const SCANLINE_SPACING = 2;          // Increased for better performance
const PERSPECTIVE_SCALE = 0.5;       // Controls perspective scaling

// Add these constants near the top
const TRACK_WIDTH = 200;           // Width of the track
const TRACK_BORDER_WIDTH = 20;     // Width of the track borders
const TRACK_CENTER_LINE_WIDTH = 4; // Width of the center line
const TRACK_COLOR = 0x333333;      // Dark gray for the track
const TRACK_BORDER_COLOR = 0xFFFFFF; // White for track borders
const TRACK_CENTER_COLOR = 0xFFFFFF; // White for center line
const TRACK_PATTERN_LENGTH = 100;   // Length of the dashed center line pattern

function create() {
    this.graphics = this.add.graphics();
    
    keys = this.input.keyboard.addKeys({
        'W': Phaser.Input.Keyboard.KeyCodes.W,
        'S': Phaser.Input.Keyboard.KeyCodes.S,
        'A': Phaser.Input.Keyboard.KeyCodes.A,
        'D': Phaser.Input.Keyboard.KeyCodes.D,
        'SHIFT': Phaser.Input.Keyboard.KeyCodes.SHIFT
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

    // Handle window resize
    window.addEventListener('resize', () => {
        SCREEN_WIDTH = window.innerWidth;
        SCREEN_HEIGHT = window.innerHeight;
        horizon = Math.floor(SCREEN_HEIGHT * 0.65);
        player.size = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.15;
        player.leader.size = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.06;
        player.y = SCREEN_HEIGHT * 0.45;
        player.leader.y = SCREEN_HEIGHT * 0.45;
    });
}

function update() {
    handlePlayerInput();
    
    // Update forward movement and scroll offset based on current speed stage
    position.z += forwardSpeed;
    
    // Smoother scroll speed calculation
    const scrollSpeedMultiplier = 0.02;
    scrollOffset = (scrollOffset + forwardSpeed * scrollSpeedMultiplier);
    if (scrollOffset > GRID_SIZE) {
        scrollOffset -= GRID_SIZE;
    }
    
    this.graphics.clear();
    
    // Calculate vertical movement compensation
    const verticalMovement = (player.y - (SCREEN_HEIGHT * 0.45)) / (SCREEN_HEIGHT * 0.45);
    const horizonOffset = -verticalMovement * HORIZON_VERTICAL_MARGIN;
    
    // Update horizon position with vertical compensation
    const compensatedHorizon = horizon + horizonOffset;
    
    // Update horizon tilt based on movement with faster response
    const targetTilt = (player.leader.x - player.x) / player.leader.maxDistance * -MAX_HORIZON_TILT;
    horizonTilt = Phaser.Math.Linear(horizonTilt, targetTilt, 0.2);
    
    // Calculate tilted horizon points for ground alignment
    const horizonPoints = [];
    for (let x = 0; x <= SCREEN_WIDTH; x += SCANLINE_SPACING) {
        const xProgress = (x - SCREEN_WIDTH / 2) / (SCREEN_WIDTH / 2);
        const y = compensatedHorizon + Math.sin(horizonTilt) * (SCREEN_WIDTH / 2) * xProgress;
        horizonPoints.push({ x, y });
    }
    
    // Draw rotated sky background using the same horizon points
    this.graphics.save();
    this.graphics.fillStyle(0x87CEEB);
    
    // Create tilted sky polygon using the calculated horizon points
    this.graphics.beginPath();
    this.graphics.moveTo(0, 0);
    this.graphics.lineTo(SCREEN_WIDTH, 0);
    this.graphics.lineTo(SCREEN_WIDTH, horizonPoints[horizonPoints.length - 1].y);
    this.graphics.lineTo(0, horizonPoints[0].y);
    this.graphics.closePath();
    this.graphics.fill();
    
    // Optimized ground rendering using scanlines
    const speedFactor = currentSpeedStage / MAX_SPEED_STAGE;
    
    // Pre-calculate tilt factors
    const tiltAngle = horizonTilt;
    const cosTheta = Math.cos(tiltAngle);
    const sinTheta = Math.sin(tiltAngle);
    
    // Draw ground from tilted horizon
    for (let i = 0; i < horizonPoints.length - 1; i++) {
        const startX = horizonPoints[i].x;
        const endX = horizonPoints[i + 1].x;
        const startY = horizonPoints[i].y;
        
        for (let screenY = Math.floor(startY); screenY < SCREEN_HEIGHT; screenY += SCANLINE_SPACING) {
            const distanceFromHorizon = screenY - startY;
            if (distanceFromHorizon <= 0) continue;
            
            // Calculate perspective for this scanline
            const z = (distanceFromHorizon * baseScale) + position.z;
            const scaleLine = cameraHeight / distanceFromHorizon * PERSPECTIVE_SCALE;
            
            // Calculate the tilt offset for this scanline
            const verticalProgress = (screenY - compensatedHorizon) / (SCREEN_HEIGHT - compensatedHorizon);
            const xOffset = Math.sin(horizonTilt) * (SCREEN_WIDTH / 2) * verticalProgress;
            
            // Draw segment
            for (let screenX = startX; screenX < endX; screenX += SCANLINE_SPACING) {
                const xProgress = (screenX - SCREEN_WIDTH / 2) / (SCREEN_WIDTH / 2);
                
                // Apply horizon tilt to world coordinates
                let worldX = (screenX - SCREEN_WIDTH / 2 - xOffset * xProgress) * scaleLine;
                let worldY = z;
                
                // Apply camera rotation and tilt transformation
                let tiltedX = worldX * cosTheta - worldY * sinTheta;
                let tiltedY = worldX * sinTheta + worldY * cosTheta;
                
                let rotatedX = tiltedX * Math.cos(angle) - tiltedY * Math.sin(angle);
                let rotatedY = tiltedX * Math.sin(angle) + tiltedY * Math.cos(angle);
                
                let finalX = rotatedX - position.x;
                let finalY = rotatedY - position.y;
                
                const adjustedY = finalY + scrollOffset;
                
                // Calculate distance from track center
                const distanceFromCenter = Math.abs(finalX);
                
                // Determine if pixel is on track
                const isOnTrack = distanceFromCenter < TRACK_WIDTH / 2;
                const isOnBorder = distanceFromCenter >= (TRACK_WIDTH / 2 - TRACK_BORDER_WIDTH) && 
                                 distanceFromCenter <= TRACK_WIDTH / 2;
                const isOnCenterLine = Math.abs(distanceFromCenter) < TRACK_CENTER_LINE_WIDTH / 2;
                
                // Calculate pattern for dashed center line
                const dashPattern = Math.floor(adjustedY / TRACK_PATTERN_LENGTH) % 2 === 0;
                
                // Set color based on track position
                if (isOnBorder) {
                    this.graphics.fillStyle(TRACK_BORDER_COLOR);
                } else if (isOnCenterLine && dashPattern) {
                    this.graphics.fillStyle(TRACK_CENTER_COLOR);
                } else if (isOnTrack) {
                    this.graphics.fillStyle(TRACK_COLOR);
                } else {
                    // Calculate gradient for off-track areas
                    const gradientProgress = Math.min(1, distanceFromHorizon / (SCREEN_HEIGHT - compensatedHorizon) * GRADIENT_INTENSITY);
                    
                    // Base color interpolation
                    const r = Math.floor(((GROUND_COLOR_NEAR >> 16) & 0xFF) * (1 - gradientProgress) + ((GROUND_COLOR_FAR >> 16) & 0xFF) * gradientProgress);
                    const g = Math.floor(((GROUND_COLOR_NEAR >> 8) & 0xFF) * (1 - gradientProgress) + ((GROUND_COLOR_FAR >> 8) & 0xFF) * gradientProgress);
                    const b = Math.floor((GROUND_COLOR_NEAR & 0xFF) * (1 - gradientProgress) + (GROUND_COLOR_FAR & 0xFF) * gradientProgress);
                    
                    const baseColor = (r << 16) | (g << 8) | b;
                    const brightnessBoost = Math.floor(speedFactor * 20);
                    this.graphics.fillStyle(adjustColorBrightness(baseColor, brightnessBoost));
                }
                
                this.graphics.fillRect(screenX, screenY, SCANLINE_SPACING, SCANLINE_SPACING);
            }
        }
    }

    // Draw tilted horizon line
    this.graphics.lineStyle(2, 0xFF0000);
    this.graphics.beginPath();
    this.graphics.moveTo(0, horizonPoints[0].y);
    this.graphics.lineTo(SCREEN_WIDTH, horizonPoints[horizonPoints.length - 1].y);
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

    // Update dash cooldown
    const currentTime = Date.now();
    if (!player.isDashing && currentTime - player.lastDashTime < DASH_COOLDOWN) {
        player.dashCooldown = (DASH_COOLDOWN - (currentTime - player.lastDashTime)) / DASH_COOLDOWN;
    } else {
        player.dashCooldown = 0;
    }

    // Draw dash cooldown indicator
    if (player.dashCooldown > 0) {
        this.graphics.fillStyle(0x000000);
        this.graphics.fillRect(10, 40, 200, 20);
        this.graphics.fillStyle(0x00ff00);
        this.graphics.fillRect(10, 40, 200 * (1 - player.dashCooldown), 20);
    }
}

function handlePlayerInput() {
    let dx = 0;
    let dy = 0;

    // Calculate movement direction for leader using only keyboard
    if (keys.W.isDown) {
        dy = -1;
    }
    if (keys.S.isDown) {
        dy = 1;
    }
    if (keys.A.isDown) {
        dx = -1;
    }
    if (keys.D.isDown) {
        dx = 1;
    }

    // Handle dash
    const currentTime = Date.now();
    if (keys.SHIFT.isDown && !player.isDashing && currentTime - player.lastDashTime > DASH_COOLDOWN) {
        // Start dash
        player.isDashing = true;
        player.lastDashTime = currentTime;
        
        // Normalize dash direction
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            player.dashDirection = {
                x: dx / length,
                y: dy / length
            };
        } else {
            // If no direction keys are pressed, dash in current facing direction
            player.dashDirection = {
                x: Math.cos(player.angle),
                y: Math.sin(player.angle)
            };
        }
    }

    // Move leader
    if (dx !== 0 || dy !== 0) {
        // Normalize diagonal movement
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = dx / length;
        dy = dy / length;

        if (player.isDashing) {
            // Apply dash movement
            player.leader.x += player.dashDirection.x * DASH_SPEED;
            player.leader.y += player.dashDirection.y * DASH_SPEED;
            
            // Check if dash duration has ended
            if (currentTime - player.lastDashTime > DASH_DURATION) {
                player.isDashing = false;
            }
        } else {
            // Normal movement
            player.leader.x += dx * player.leader.moveSpeed;
            player.leader.y += dy * player.leader.moveSpeed;
        }

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

    // Calculate viewport margins based on player size
    const viewportMargin = player.size * 1.5; // Doubled the margin
    
    // Keep both rectangles on screen with margin
    player.x = Phaser.Math.Clamp(player.x, viewportMargin, SCREEN_WIDTH - viewportMargin);
    player.y = Phaser.Math.Clamp(player.y, viewportMargin, SCREEN_HEIGHT - viewportMargin);
    player.leader.x = Phaser.Math.Clamp(player.leader.x, viewportMargin, SCREEN_WIDTH - viewportMargin);
    player.leader.y = Phaser.Math.Clamp(player.leader.y, viewportMargin, SCREEN_HEIGHT - viewportMargin);

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

// Enhanced color adjustment function
function adjustColorBrightness(color, amount) {
    const r = Math.min(255, Math.max(0, ((color >> 16) & 0xFF) + amount));
    const g = Math.min(255, Math.max(0, ((color >> 8) & 0xFF) + amount));
    const b = Math.min(255, Math.max(0, (color & 0xFF) + amount));
    return (r << 16) | (g << 8) | b;
}