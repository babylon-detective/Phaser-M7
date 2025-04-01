const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// Camera and perspective settings
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const horizon = 150;
const scale = 1;
const baseScale = 4;
const cameraHeight = 200;

// Camera/world variables
let position = { x: 0, y: 0 };
let angle = 0;

// Player variables
let player = {
    x: SCREEN_WIDTH / 2,    // Screen position X
    y: SCREEN_HEIGHT / 2,   // Start in middle of screen
    size: 40,              // Larger square size
    angle: 0,              // Facing angle
    speed: 0,             // Current speed
    maxSpeed: 8,          // Maximum speed
    moveSpeed: 8,         // Increased WASD movement speed
    acceleration: 0.5,    // Forward acceleration
    deceleration: 0.2,    // Speed decay
    worldX: 0,           // World position X
    worldY: 0            // World position Y
};

let keys;

function create() {
    this.graphics = this.add.graphics();
    
    keys = this.input.keyboard.addKeys({
        'W': Phaser.Input.Keyboard.KeyCodes.W,
        'S': Phaser.Input.Keyboard.KeyCodes.S,
        'A': Phaser.Input.Keyboard.KeyCodes.A,
        'D': Phaser.Input.Keyboard.KeyCodes.D,
        'accelerate': Phaser.Input.Keyboard.KeyCodes.CLOSE_BRACKET
    });
}

function update() {
    handlePlayerInput();
    
    this.graphics.clear();
    
    // Draw sky
    this.graphics.fillStyle(0x87CEEB);
    this.graphics.fillRect(0, 0, SCREEN_WIDTH, horizon);
    
    // Draw ground with Mode 7 perspective
    for (let screenY = horizon; screenY < SCREEN_HEIGHT; screenY++) {
        let z = (screenY - horizon) * baseScale;
        let scaleLine = cameraHeight / (screenY - horizon);
        
        for (let screenX = 0; screenX < SCREEN_WIDTH; screenX++) {
            let worldX = (screenX - SCREEN_WIDTH / 2) * scaleLine;
            let worldY = z;

            let rotatedX = worldX * Math.cos(angle) - worldY * Math.sin(angle);
            let rotatedY = worldX * Math.sin(angle) + worldY * Math.cos(angle);
            
            let finalX = rotatedX - position.x;
            let finalY = rotatedY - position.y;
            
            const gridSize = 100;
            let isGrid = (Math.floor(finalX / gridSize) + Math.floor(finalY / gridSize)) % 2 === 0;
            
            this.graphics.fillStyle(isGrid ? 0x00ff00 : 0x008800);
            this.graphics.fillPoint(screenX, screenY, 1);
        }
    }

    // Draw horizon line for visibility
    this.graphics.lineStyle(2, 0xFF0000);
    this.graphics.beginPath();
    this.graphics.moveTo(0, horizon);
    this.graphics.lineTo(SCREEN_WIDTH, horizon);
    this.graphics.strokePath();

    // Draw player
    drawPlayer(this.graphics);
    
    // Draw speed indicator
    this.graphics.fillStyle(0xffffff);
    this.graphics.fillRect(10, 10, Math.abs(player.speed) * 10, 10);
}

function handlePlayerInput() {
    // WASD Movement on screen
    if (keys.W.isDown) {
        player.y -= player.moveSpeed;
    }
    if (keys.S.isDown) {
        player.y += player.moveSpeed;
    }
    if (keys.A.isDown) {
        player.x -= player.moveSpeed;
        player.angle = Math.PI;  // Face left
    }
    if (keys.D.isDown) {
        player.x += player.moveSpeed;
        player.angle = 0;        // Face right
    }

    // Keep player on screen
    player.x = Phaser.Math.Clamp(player.x, 0, SCREEN_WIDTH);
    player.y = Phaser.Math.Clamp(player.y, 0, SCREEN_HEIGHT); // Allow movement above horizon

    // Acceleration with ]
    if (keys.accelerate.isDown) {
        player.speed = Math.min(player.speed + player.acceleration, player.maxSpeed);
    } else {
        player.speed = Math.max(0, player.speed - player.deceleration);
    }

    // Update world position based on speed and angle
    if (player.speed > 0) {
        position.x -= Math.cos(player.angle) * player.speed;
        position.y -= Math.sin(player.angle) * player.speed;
    }
}

function drawPlayer(graphics) {
    // Draw square player
    graphics.lineStyle(2, 0xFF0000);
    graphics.fillStyle(0xFF0000, 0.5); // Red with 50% transparency
    
    // Draw centered square
    graphics.fillRect(
        player.x - player.size/2, 
        player.y - player.size/2, 
        player.size, 
        player.size
    );
    
    // Draw direction indicator (small line showing facing direction)
    graphics.lineStyle(2, 0xFFFF00);
    graphics.beginPath();
    graphics.moveTo(player.x, player.y);
    graphics.lineTo(
        player.x + Math.cos(player.angle) * (player.size/2),
        player.y + Math.sin(player.angle) * (player.size/2)
    );
    graphics.strokePath();
}