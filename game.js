"use strict"; // Enables JavaScript strict mode, which catches certain coding mistakes and prevents unsafe behavior.

// ============================================================
// NEON DRIFT
// Optimized renderer + proper start/finish lane
// ============================================================

const canvas = document.getElementById("gameCanvas"); // Finds the HTML canvas element where the game will be drawn.

if (!canvas) { // Checks whether the canvas was actually found.
    throw new Error("Canvas #gameCanvas was not found."); // Stops the game and shows an error if the canvas is missing.
}

const ctx = canvas.getContext("2d", { // Creates a 2D drawing context so JavaScript can draw on the canvas.
    alpha: false // Tells the browser the canvas does not need transparency, which can improve rendering performance.
});

if (!ctx) { // Checks whether the browser successfully created the drawing context.
    throw new Error("Could not create 2D canvas context."); // Stops the game if the drawing context could not be created.
}

// ============================================================
// UI
// ============================================================

const startScreen = document.getElementById("startScreen"); // Gets the main menu/start screen from the HTML.
const startButton = document.getElementById("startButton"); // Gets the button used to start the race.

const finishScreen = document.getElementById("finishScreen"); // Gets the screen shown when the race is finished.
const restartButton = document.getElementById("restartButton"); // Gets the button used to restart the race.

const scoreElement = document.getElementById("score"); // Gets the HTML element that displays the player's score.
const lapElement = document.getElementById("lap"); // Gets the HTML element that displays the current lap.
const speedElement = document.getElementById("speed"); // Gets the HTML element that displays the player's speed.

const boostFill = document.getElementById("boostFill"); // Gets the boost bar element whose width represents remaining boost.
const boostPercent = document.getElementById("boostPercent"); // Gets the text element that displays the boost percentage.

const comboElement = document.getElementById("combo"); // Gets the element containing the drift combo display.
const comboText = document.getElementById("comboText"); // Gets the text element used to display the combo type.
const comboValue = document.getElementById("comboValue"); // Gets the element that displays the current combo multiplier.

const messageElement = document.getElementById("message"); // Gets the temporary message container used for things like "GO!".
const messageText = document.getElementById("messageText"); // Gets the element where the temporary message text is placed.

const finalScoreElement = document.getElementById("finalScore"); // Gets the element that displays the final score.
const finalLapsElement = document.getElementById("finalLaps"); // Gets the element that displays the completed lap count.
const finalCoinsElement = document.getElementById("finalCoins"); // Gets the element that displays the collected coin count.

// ============================================================
// GAME STATE
// ============================================================

let gameStarted = false; // Tracks whether the actual race is currently running.
let raceFinished = false; // Tracks whether the player has completed the race.

let score = 0; // Stores the player's current score.
let lap = 1; // Stores the player's current lap number.

const TOTAL_LAPS = 69; // Sets the total number of laps required to finish the race.

let coins = 0; // Stores how many coins the player has collected.
let raceTime = 0; // Stores how long the current race has been running in seconds.

let finishCooldown = 2; // Prevents the finish line from being triggered repeatedly for a short period.
let previousFinishSide = null; // Stores which side of the finish line the player was on during the previous physics update.

let driftScore = 0; // Stores points earned during the current drift.
let driftCombo = 1; // Stores the current drift multiplier.
let driftTimer = 0; // Tracks how long the current drift has lasted.

let messageTimer = 0; // Stores how long the current temporary message should remain visible.

// ============================================================
// CANVAS / PERFORMANCE
// ============================================================

let DPR = 1; // Stores the device pixel ratio used to render the canvas.

function resizeCanvas() { // Resizes the canvas whenever the browser window changes size.
    const maxDPR = // Calculates the maximum allowed device pixel ratio.
        window.innerWidth > 1600 // Checks whether the screen is wider than 1600 pixels.
            ? 1.15 // Uses a lower DPR limit on large screens to reduce rendering workload.
            : 1.25; // Allows a slightly higher DPR on smaller screens.

    DPR = Math.min( // Chooses the smaller value between the device's actual DPR and our performance limit.
        window.devicePixelRatio || 1, // Gets the device's pixel ratio, using 1 if the browser does not provide one.
        maxDPR // Prevents the DPR from going above the chosen performance limit.
    );

    canvas.width = // Sets the canvas's internal pixel width.
        Math.max( // Makes sure the canvas is never smaller than one pixel.
            1, // Minimum allowed width.
            Math.floor( // Rounds the calculated width down to a whole pixel.
                window.innerWidth * DPR // Converts the browser width into high-DPI canvas pixels.
            )
        );

    canvas.height = // Sets the canvas's internal pixel height.
        Math.max( // Makes sure the canvas is never smaller than one pixel.
            1, // Minimum allowed height.
            Math.floor( // Rounds the calculated height down to a whole pixel.
                window.innerHeight * DPR // Converts the browser height into high-DPI canvas pixels.
            )
        );

    canvas.style.width = // Sets the displayed CSS width of the canvas.
        window.innerWidth + "px"; // Makes the canvas visually fill the browser width.

    canvas.style.height = // Sets the displayed CSS height of the canvas.
        window.innerHeight + "px"; // Makes the canvas visually fill the browser height.

    ctx.setTransform( // Resets the canvas drawing transform to account for the device pixel ratio.
        DPR, // Horizontal scaling factor.
        0, // Horizontal skew.
        0, // Vertical skew.
        DPR, // Vertical scaling factor.
        0, // Horizontal translation.
        0 // Vertical translation.
    );
}

window.addEventListener( // Registers a listener that reacts to browser window changes.
    "resize", // Runs the listener whenever the window is resized.
    resizeCanvas // Calls resizeCanvas so the game adapts to the new screen size.
);

resizeCanvas(); // Performs the first canvas resize immediately when the game loads.

// ============================================================
// INPUT
// ============================================================

const keys = {}; // Stores which keyboard keys are currently being held down.

window.addEventListener( // Listens for keyboard key presses.
    "keydown", // Runs whenever a key is pressed down.
    (event) => { // Creates a function that receives information about the pressed key.
        keys[event.code] = true; // Marks the pressed key as active in the keys object.

        if ( // Checks whether the pressed key is one of the keys used for driving.
            event.code === "Space" || // Checks for the Space key used for boost.
            event.code === "ArrowUp" || // Checks for the Up Arrow used for acceleration.
            event.code === "ArrowDown" || // Checks for the Down Arrow used for braking/reversing.
            event.code === "ArrowLeft" || // Checks for the Left Arrow used for steering.
            event.code === "ArrowRight" // Checks for the Right Arrow used for steering.
        ) {
            event.preventDefault(); // Stops the browser from performing its normal action for these keys.
        }

        if ( // Checks whether the player pressed R while the game is running.
            event.code === "KeyR" && // Checks specifically for the R key.
            gameStarted // Makes sure the restart command only works during the game.
        ) {
            restartRace(); // Resets the race when R is pressed.
        }
    }
);

window.addEventListener( // Listens for keyboard key releases.
    "keyup", // Runs whenever a key is released.
    (event) => { // Creates a function that receives information about the released key.
        keys[event.code] = false; // Marks the released key as inactive.
    }
);

// ============================================================
// HELPERS
// ============================================================

function clamp(value, min, max) { // Creates a helper that keeps a number between a minimum and maximum.
    return Math.max( // Returns the larger of the minimum and the calculated value.
        min, // The smallest value allowed.
        Math.min(max, value) // The value is first limited to the maximum.
    );
}

function lerp(a, b, t) { // Creates a helper for smoothly moving a value from a toward b.
    return ( // Returns the interpolated value.
        a + // Starts with the first value.
        (b - a) * t // Moves a percentage t of the distance toward the second value.
    );
}

function random(min, max) { // Creates a helper for generating a random number inside a range.
    return ( // Returns the generated random number.
        min + // Starts at the minimum value.
        Math.random() * // Generates a random decimal from 0 up to 1 and scales it.
        (max - min) // Sets the size of the random range.
    );
}

function magnitude(x, y) { // Calculates the length of a 2D velocity or vector.
    return Math.sqrt( // Uses the square-root part of the Pythagorean theorem.
        x * x + // Adds the squared horizontal component.
        y * y // Adds the squared vertical component.
    );
}

// ============================================================
// TRACK
// ============================================================

const track = [ // Stores the points that make up the centerline of the racing track.
    { x: -500, y: 0 }, // First point of the track.
    { x: 0, y: -450 }, // Second point of the track.
    { x: 700, y: -500 }, // Third point of the track.
    { x: 1250, y: -150 }, // Fourth point of the track.
    { x: 1450, y: 500 }, // Fifth point of the track.
    { x: 1200, y: 1050 }, // Sixth point of the track.
    { x: 650, y: 1350 }, // Seventh point of the track.
    { x: 0, y: 1250 }, // Eighth point of the track.
    { x: -550, y: 1000 }, // Ninth point of the track.
    { x: -900, y: 500 }, // Tenth point of the track.
    { x: -850, y: 100 }, // Eleventh point of the track.
    { x: -650, y: -250 } // Twelfth point of the track.
];

const TRACK_WIDTH = 300; // Sets the total width of the road.
const TRACK_RADIUS = // Calculates half the road width, useful for finding its edges.
    TRACK_WIDTH / 2;

// ============================================================
// TRACK SEGMENTS
// ============================================================

const segments = []; // Creates an array that will hold pre-calculated information about every track segment.

for ( // Starts a loop through every point in the track.
    let i = 0; // Starts the loop at track point zero.
    i < track.length; // Continues until every track point has been processed.
    i++ // Moves to the next track point after each loop.
) {
    const a = track[i]; // Gets the current track point.

    const b = // Gets the next track point.
        track[ // Accesses the track array.
        (i + 1) % // Moves to the next point and uses modulo so the final point connects back to the first.
        track.length // Uses the total number of track points for the wrap-around.
        ];

    const dx = // Calculates the horizontal distance between the two points.
        b.x - a.x; // Subtracts the current point's X coordinate from the next point's X coordinate.

    const dy = // Calculates the vertical distance between the two points.
        b.y - a.y; // Subtracts the current point's Y coordinate from the next point's Y coordinate.

    const length = // Calculates the length of this track segment.
        Math.sqrt( // Uses the Pythagorean theorem to calculate the distance.
            dx * dx + // Squares the horizontal distance.
            dy * dy // Squares the vertical distance.
        );

    segments.push({ // Adds all pre-calculated information about this segment to the segments array.
        ax: a.x, // Stores the starting point's X coordinate.
        ay: a.y, // Stores the starting point's Y coordinate.

        bx: b.x, // Stores the ending point's X coordinate.
        by: b.y, // Stores the ending point's Y coordinate.

        dx, // Stores the horizontal direction/distance.
        dy, // Stores the vertical direction/distance.

        length, // Stores the segment's total length.

        dirX: // Stores the normalized horizontal direction of the segment.
            dx / length, // Divides horizontal distance by total length to normalize it.

        dirY: // Stores the normalized vertical direction of the segment.
            dy / length, // Divides vertical distance by total length to normalize it.

        nx: // Stores the horizontal component of the segment's perpendicular normal.
            -dy / length, // Rotates the direction 90 degrees and normalizes it.

        ny: // Stores the vertical component of the segment's perpendicular normal.
            dx / length // Rotates the direction 90 degrees and normalizes it.
    });
}

// ============================================================
// START / FINISH GEOMETRY
// ============================================================

const firstSegment = // Gets the first segment of the track.
    segments[0]; // Segment zero is used to determine the finish line's direction.

// track[0] sits right at a sharp zig-zag vertex where
// segment 11 -> 0 and segment 0 -> 1 both bend sharply back
// on themselves. A gate placed exactly on that vertex, drawn
// perpendicular to segment 0's direction, doesn't cross a
// single lane of pavement -- it cuts across the *notch*
// between the two separate strands of the zig-zag (visible as
// the checkered line floating over a gap instead of sitting on
// the road). Placing the finish line partway along segment 0
// instead keeps it on a straight, unambiguous piece of road,
// clear of both corners.

const FINISH_SEGMENT_T = 0.5; // Places the finish line halfway along the first track segment.

const finishPoint = { // Creates the exact center point of the finish line.
    x: firstSegment.ax + firstSegment.dx * FINISH_SEGMENT_T, // Calculates the finish line's X position.
    y: firstSegment.ay + firstSegment.dy * FINISH_SEGMENT_T // Calculates the finish line's Y position.
};

const finishDirX = // Stores the horizontal direction the finish line is crossed in.
    firstSegment.dirX; // Uses the first segment's normalized direction.

const finishDirY = // Stores the vertical direction the finish line is crossed in.
    firstSegment.dirY; // Uses the first segment's normalized direction.

const finishNormalX = // Stores the horizontal component of the finish line's sideways direction.
    firstSegment.nx; // Uses the first segment's normal vector.

const finishNormalY = // Stores the vertical component of the finish line's sideways direction.
    firstSegment.ny; // Uses the first segment's normal vector.

// ============================================================
// PLAYER
// ============================================================

const player = { // Stores all of the player's car properties and physics values.
    x: finishPoint.x, // Starts the car at the finish line's X coordinate.
    y: finishPoint.y, // Starts the car at the finish line's Y coordinate.

    vx: 0, // Stores the car's horizontal velocity.
    vy: 0, // Stores the car's vertical velocity.

    angle: Math.atan2( // Calculates the starting angle of the car.
        finishDirY, // Uses the finish direction's vertical component.
        finishDirX // Uses the finish direction's horizontal component.
    ),

    // Real rotational momentum. The car's heading no longer
    // snaps straight to the steering input -- it only turns as
    // fast as this value allows, and this value has its own
    // inertia. That's what makes counter-steering necessary and
    // spinning out possible.
    angularVelocity: 0, // Stores how quickly the car is currently rotating.

    // Sideways slip from the previous physics tick, used to
    // feed oversteer back into next tick's rotation.
    lastSidewaysVelocity: 0, // Stores the previous physics update's sideways sliding speed.

    radius: 22, // Sets the collision radius of the car.

    acceleration: 600, // Sets how strongly the car accelerates forward.
    brakePower: 850, // Sets how strongly the car brakes or reverses.

    maxSpeed: 900, // Sets the normal maximum speed of the car.

    steering: 3.5, // Controls how strongly steering affects the car's rotation.

    normalGrip: 0.76, // Controls how quickly sideways movement is removed during normal driving.
    driftGrip: 0.991, // Controls how much sideways movement is preserved while drifting.

    boost: 100, // Stores the current boost amount as a percentage.
    boosting: false, // Tracks whether the boost is currently active.

    grinding: false, // Tracks whether the car is currently rubbing against a wall.

    wallCooldown: 0 // Prevents wall crashes from triggering repeatedly in rapid succession.
};

// ============================================================
// CAMERA
// ============================================================

const camera = { // Stores the camera's position, look-ahead, and screen shake.
    x: player.x, // Starts the camera at the player's X position.
    y: player.y, // Starts the camera at the player's Y position.

    lookX: 0, // Stores how far the camera looks ahead horizontally.
    lookY: 0, // Stores how far the camera looks ahead vertically.

    shake: 0 // Stores the current amount of camera shake.
};

function updateCamera(dt) { // Updates the camera position every physics tick.
    const speed = // Calculates the player's current speed.
        magnitude( // Uses the vector magnitude helper.
            player.vx, // Uses the player's horizontal velocity.
            player.vy // Uses the player's vertical velocity.
        );

    const followStrength = // Calculates how strongly the camera follows the player.
        clamp( // Keeps the camera follow speed within a sensible range.
            10 + // Gives the camera a base follow strength.
            speed * 0.035, // Makes the camera respond more strongly at higher speeds.
            10, // Minimum camera follow strength.
            24 // Maximum camera follow strength.
        );

    const smoothing = // Converts the follow strength into frame-rate-independent smoothing.
        1 - // Starts with the maximum smoothing value.
        Math.exp( // Uses exponential smoothing for consistent movement.
            -followStrength * // Applies the camera's follow strength.
            dt // Accounts for the current physics timestep.
        );

    const lookDistance = // Calculates how far ahead of the car the camera should look.
        clamp( // Prevents the camera from looking too far ahead.
            speed * 0.16, // Makes look-ahead increase with speed.
            0, // Minimum look-ahead distance.
            190 // Maximum look-ahead distance.
        );

    let targetLookX = 0; // Stores the desired horizontal camera look-ahead.
    let targetLookY = 0; // Stores the desired vertical camera look-ahead.

    if (speed > 1) { // Only calculates a direction if the car is actually moving.
        targetLookX = // Calculates the horizontal look-ahead position.
            player.vx / // Divides horizontal velocity by speed to get a normalized direction.
            speed * // Multiplies that direction by the desired look distance.
            lookDistance; // Sets how far ahead the camera looks.

        targetLookY = // Calculates the vertical look-ahead position.
            player.vy / // Divides vertical velocity by speed to get a normalized direction.
            speed * // Multiplies that direction by the desired look distance.
            lookDistance; // Sets how far ahead the camera looks.
    }

    camera.lookX = lerp( // Smoothly moves the camera's horizontal look-ahead toward its target.
        camera.lookX, // Current horizontal look-ahead.
        targetLookX, // Desired horizontal look-ahead.
        smoothing // Amount of movement toward the target.
    );

    camera.lookY = lerp( // Smoothly moves the camera's vertical look-ahead toward its target.
        camera.lookY, // Current vertical look-ahead.
        targetLookY, // Desired vertical look-ahead.
        smoothing // Amount of movement toward the target.
    );

    camera.x = lerp( // Smoothly moves the camera horizontally toward the player's position.
        camera.x, // Current camera X position.
        player.x + // Starts from the player's X position.
        camera.lookX, // Adds the camera's forward look-ahead.
        smoothing // Controls how quickly the camera catches up.
    );

    camera.y = lerp( // Smoothly moves the camera vertically toward the player's position.
        camera.y, // Current camera Y position.
        player.y + // Starts from the player's Y position.
        camera.lookY, // Adds the camera's forward look-ahead.
        smoothing // Controls how quickly the camera catches up.
    );

    if ( // Checks whether camera shake is currently active.
        camera.shake > 0 // Shake only needs updating when it is above zero.
    ) {
        camera.shake = // Reduces the camera shake over time.
            Math.max( // Prevents the shake value from becoming negative.
                0, // Minimum shake amount.
                camera.shake - // Starts with the current shake amount.
                dt * 8 // Reduces shake based on elapsed time.
            );
    }
}

// ============================================================
// CLOSEST TRACK POINT
// ============================================================

function getClosestTrackPoint( // Finds the point on the track closest to a given world position.
    px, // Receives the X coordinate to check.
    py // Receives the Y coordinate to check.
) {
    let closest = null; // Stores the closest point found so far.
    let closestDistanceSq = // Stores the squared distance to the closest point.
        Infinity; // Starts at infinity so the first valid point will be closer.

    for ( // Loops through every track segment.
        const segment of segments // Gets each pre-calculated track segment.
    ) {
        const abx = // Gets the segment's horizontal direction/distance.
            segment.dx; // Uses the pre-calculated horizontal difference.

        const aby = // Gets the segment's vertical direction/distance.
            segment.dy; // Uses the pre-calculated vertical difference.

        const lengthSq = // Calculates the squared length of the segment.
            segment.length * // Multiplies the segment length by itself.
            segment.length; // Avoids an unnecessary square root here.

        let t = // Calculates where the closest point falls along the segment.
            (
                (px - // Gets the horizontal distance from the segment start to the test point.
                    segment.ax) *
                abx + // Multiplies that distance by the segment's horizontal direction.
                (py - // Gets the vertical distance from the segment start to the test point.
                    segment.ay) *
                aby // Multiplies that distance by the segment's vertical direction.
            ) /
            lengthSq; // Divides by the squared segment length to get the normalized position.

        t = clamp( // Keeps the closest point inside the actual segment.
            t, // The calculated position along the segment.
            0, // Minimum position, meaning the segment start.
            1 // Maximum position, meaning the segment end.
        );

        const pointX = // Calculates the X coordinate of the closest point.
            segment.ax + // Starts at the segment's first point.
            abx * t; // Moves along the segment according to t.

        const pointY = // Calculates the Y coordinate of the closest point.
            segment.ay + // Starts at the segment's first point.
            aby * t; // Moves along the segment according to t.

        const dx = // Calculates horizontal distance from the test position to the closest point.
            px -
            pointX;

        const dy = // Calculates vertical distance from the test position to the closest point.
            py -
            pointY;

        const distanceSq = // Calculates squared distance between the two points.
            dx * dx + // Squares the horizontal distance.
            dy * dy; // Squares the vertical distance.

        if ( // Checks whether this point is closer than the previous closest point.
            distanceSq <
            closestDistanceSq
        ) {
            closestDistanceSq = // Updates the stored closest squared distance.
                distanceSq;

            closest = { // Stores information about the new closest point.
                x: pointX, // Stores the closest point's X coordinate.
                y: pointY, // Stores the closest point's Y coordinate.
                distanceSq, // Stores the squared distance.
                distance: // Stores the normal distance.
                    Math.sqrt( // Converts squared distance into normal distance.
                        distanceSq // Uses the calculated squared distance.
                    ),
                segment // Stores which track segment contains the closest point.
            };
        }
    }

    return closest; // Returns the closest point and its information.
}

// ============================================================
// PARTICLE SYSTEM
// ============================================================

const MAX_PARTICLES = 220; // Limits the total number of particles to reduce CPU/GPU workload.

const particles = []; // Creates the array that stores every particle.

for ( // Starts creating the particle pool.
    let i = 0; // Starts at particle zero.
    i < MAX_PARTICLES; // Continues until the maximum particle count is reached.
    i++ // Moves to the next particle slot.
) {
    particles.push({ // Adds a new reusable particle object to the pool.
        active: false, // Marks the particle as unused initially.

        x: 0, // Stores the particle's X position.
        y: 0, // Stores the particle's Y position.

        vx: 0, // Stores the particle's horizontal velocity.
        vy: 0, // Stores the particle's vertical velocity.

        life: 0, // Stores how much time the particle has left.
        maxLife: 0, // Stores the particle's original lifetime.

        size: 0, // Stores the particle's rendered size.

        type: 0 // Stores which visual effect type the particle belongs to.
    });
}

let particleQuality = 1; // Controls what percentage of requested particles are actually spawned.

let particleCursor = 0; // Remembers where the particle pool should search from next time.

function spawnParticle( // Creates or reuses a particle from the particle pool.
    x, // Starting X position.
    y, // Starting Y position.
    vx, // Starting horizontal velocity.
    vy, // Starting vertical velocity.
    life, // How long the particle should remain alive.
    size, // How large the particle should be.
    type = 0 // Visual particle type, defaulting to normal yellow particles.
) {
    if ( // Randomly skips particles when performance mode lowers particle quality.
        Math.random() >
        particleQuality
    ) {
        return; // Stops without spawning anything if this particle is filtered out.
    }

    for ( // Searches through the particle pool for an unused particle.
        let i = 0; // Starts searching at offset zero.
        i < MAX_PARTICLES; // Searches no more than the maximum number of particles.
        i++ // Moves to the next pool slot.
    ) {
        const index = // Calculates the actual pool index to inspect.
            (
                particleCursor +
                i // Starts from the remembered cursor and moves forward.
            ) %
            MAX_PARTICLES; // Wraps around to the beginning of the pool when needed.

        const particle = // Gets the particle object at the calculated index.
            particles[index];

        if ( // Checks whether this particle slot is already being used.
            particle.active
        ) {
            continue; // Skips this particle and searches for another one.
        }

        particleCursor = // Moves the cursor to the slot after the one we just used.
            (
                index + 1 // Adds one to the current particle index.
            ) %
            MAX_PARTICLES; // Wraps the cursor around if it reaches the end.

        particle.active = true; // Marks this particle as active.

        particle.x = x; // Sets the particle's starting X position.
        particle.y = y; // Sets the particle's starting Y position.

        particle.vx = vx; // Sets the particle's starting horizontal velocity.
        particle.vy = vy; // Sets the particle's starting vertical velocity.

        particle.life = life; // Sets the particle's remaining lifetime.
        particle.maxLife = life; // Stores the original lifetime for alpha calculations.

        particle.size = size; // Sets the particle's rendered size.

        particle.type = type; // Sets the particle's visual effect type.

        return; // Stops searching because a particle was successfully created.
    }
}

// ============================================================
// PARTICLE EFFECTS
// ============================================================

function crashParticles() { // Creates sparks when the car crashes into a wall.
    const count = // Chooses how many crash particles to create.
        particleQuality >= 0.8 // Checks whether particle quality is high enough.
            ? 16 // Creates more particles when performance allows it.
            : 8; // Creates fewer particles when performance is reduced.

    for ( // Loops through the number of particles that should be created.
        let i = 0; // Starts at particle zero.
        i < count; // Continues until the requested amount has been created.
        i++ // Moves to the next particle.
    ) {
        const angle = // Picks a random direction for the spark.
            Math.random() * // Generates a random value from 0 to 1.
            Math.PI * // Scales it to half a circle.
            2; // Doubles it to cover the full circle.

        const speed = // Picks a random speed for the spark.
            random( // Uses the game's random range helper.
                150, // Minimum spark speed.
                500 // Maximum spark speed.
            );

        spawnParticle( // Creates the crash particle.
            player.x, // Starts the particle at the car's X position.
            player.y, // Starts the particle at the car's Y position.

            Math.cos(angle) * // Converts the random angle into horizontal movement.
            speed, // Applies the chosen spark speed.

            Math.sin(angle) * // Converts the random angle into vertical movement.
            speed, // Applies the chosen spark speed.

            random( // Chooses a random lifetime.
                0.2, // Minimum particle lifetime.
                0.5 // Maximum particle lifetime.
            ),

            random(2, 4), // Gives the spark a random size between 2 and 4 pixels.

            0 // Uses particle type zero, which is the yellow/orange spark style.
        );
    }
}

function grindingParticles() { // Creates small sparks when the car is rubbing against a wall.
    spawnParticle( // Creates one grinding particle.
        player.x + // Starts near the player's X position.
        random(-15, 15), // Adds random horizontal offset.

        player.y + // Starts near the player's Y position.
        random(-15, 15), // Adds random vertical offset.

        Math.cos( // Calculates horizontal velocity from the chosen direction.
            player.angle + // Starts from the car's current direction.
            Math.PI + // Points the particle backward.
            random(-0.8, 0.8) // Adds random spread to the particle direction.
        ) *
        random(80, 220), // Gives the particle a random speed.

        Math.sin( // Calculates vertical velocity from the chosen direction.
            player.angle + // Starts from the car's current direction.
            Math.PI + // Points the particle backward.
            random(-0.8, 0.8) // Adds random spread to the particle direction.
        ) *
        random(80, 220), // Gives the particle a random speed.

        random( // Chooses a short lifetime for the grinding spark.
            0.12, // Minimum lifetime.
            0.25 // Maximum lifetime.
        ),

        random(1, 3), // Gives the particle a small random size.

        0 // Uses the yellow/orange spark type.
    );
}

function driftParticles() { // Creates particles behind the car while drifting.
    spawnParticle( // Creates a drift particle.
        player.x + // Starts near the car's X position.
        random(-20, 20), // Adds random horizontal spread.

        player.y + // Starts near the car's Y position.
        random(-20, 20), // Adds random vertical spread.

        Math.cos( // Calculates horizontal velocity for the particle.
            player.angle + // Uses the car's current direction.
            Math.PI // Sends the particle backward.
        ) *
        random(50, 170), // Gives the particle a random backward speed.

        Math.sin( // Calculates vertical velocity for the particle.
            player.angle + // Uses the car's current direction.
            Math.PI // Sends the particle backward.
        ) *
        random(50, 170), // Gives the particle a random backward speed.

        random( // Chooses a short particle lifetime.
            0.15, // Minimum lifetime.
            0.28 // Maximum lifetime.
        ),

        random(1, 3), // Gives the particle a small random size.

        1 // Uses particle type one, the pink drift particle style.
    );
}

function boostParticles() { // Creates particles behind the car while boosting.
    const forwardX = // Calculates the horizontal direction the car is facing.
        Math.cos( // Converts the car's angle into an X direction.
            player.angle // Uses the car's current rotation.
        );

    const forwardY = // Calculates the vertical direction the car is facing.
        Math.sin( // Converts the car's angle into a Y direction.
            player.angle // Uses the car's current rotation.
        );

    spawnParticle( // Creates a boost particle.
        player.x - // Starts behind the car.
        forwardX * 25, // Moves 25 pixels backward from the front direction.

        player.y - // Starts behind the car.
        forwardY * 25, // Moves 25 pixels backward from the front direction.

        -forwardX * // Sends the particle opposite the car's direction.
        random(100, 250), // Gives it a random speed.

        -forwardY * // Sends the particle opposite the car's direction.
        random(100, 250), // Gives it a random speed.

        0.2, // Gives the boost particle a short fixed lifetime.

        random(2, 4), // Gives the particle a random size.

        2 // Uses particle type two, the cyan boost particle style.
    );
}

// ============================================================
// PARTICLE UPDATE
// ============================================================

function updateParticles(dt) { // Updates the position and lifetime of every active particle.
    for ( // Loops through every particle in the pool.
        const particle of particles // Gets each particle object.
    ) {
        if ( // Checks whether this particle is currently unused.
            !particle.active
        ) {
            continue; // Skips inactive particles to save processing time.
        }

        particle.life -= dt; // Reduces the particle's remaining lifetime.

        if ( // Checks whether the particle has reached the end of its lifetime.
            particle.life <= 0
        ) {
            particle.active = // Marks the particle as available for reuse.
                false;

            continue; // Skips the rest of this particle's update.
        }

        particle.x += // Moves the particle horizontally.
            particle.vx * dt; // Uses velocity multiplied by elapsed time.

        particle.y += // Moves the particle vertically.
            particle.vy * dt; // Uses velocity multiplied by elapsed time.

        const decay = // Calculates velocity decay so particles slow down over time.
            Math.pow( // Raises the decay value to a time-scaled power.
                0.025, // Base decay value.
                dt // Makes the decay depend on elapsed time.
            );

        particle.vx *= decay; // Reduces the particle's horizontal velocity.
        particle.vy *= decay; // Reduces the particle's vertical velocity.
    }
}

// ============================================================
// PARTICLE DRAW
// ============================================================

function drawParticles( // Draws visible particles onto the canvas.
    viewLeft, // Left edge of the currently visible world area.
    viewRight, // Right edge of the currently visible world area.
    viewTop, // Top edge of the currently visible world area.
    viewBottom // Bottom edge of the currently visible world area.
) {
    ctx.save(); // Saves the current canvas drawing settings.

    ctx.globalCompositeOperation = // Changes how particles blend with the scene.
        "lighter"; // Makes bright particles add light to the scene.

    for ( // Loops through every particle.
        const particle of particles // Gets each particle from the particle pool.
    ) {
        if ( // Checks whether the particle is inactive.
            !particle.active
        ) {
            continue; // Skips inactive particles.
        }

        if ( // Checks whether the particle is outside the visible camera area.
            particle.x < viewLeft || // Checks the left boundary.
            particle.x > viewRight || // Checks the right boundary.
            particle.y < viewTop || // Checks the top boundary.
            particle.y > viewBottom // Checks the bottom boundary.
        ) {
            continue; // Skips drawing particles that the player cannot see.
        }

        const alpha = // Calculates how transparent the particle should currently be.
            particle.life / // Uses the remaining lifetime.
            particle.maxLife; // Divides by the original lifetime.

        ctx.globalAlpha = // Applies the calculated transparency to the particle.
            alpha;

        if ( // Checks whether this is a drift particle.
            particle.type === 1
        ) {
            ctx.fillStyle = // Sets the drift particle color.
                "#ff008c"; // Uses neon pink.
        } else if ( // Checks whether this is a boost particle.
            particle.type === 2
        ) {
            ctx.fillStyle = // Sets the boost particle color.
                "#00f6ff"; // Uses neon cyan.
        } else {
            ctx.fillStyle = // Sets the normal particle color.
                "#ffd43b"; // Uses neon yellow.
        }

        ctx.fillRect( // Draws the particle as a small rectangle.
            particle.x, // Particle X position.
            particle.y, // Particle Y position.
            particle.size, // Particle width.
            particle.size // Particle height.
        );
    }

    ctx.restore(); // Restores the canvas settings that existed before particle drawing.
}

// ============================================================
// PLAYER UPDATE
// ============================================================

function updatePlayer(dt) { // Updates all of the player's physics and race behavior.
    const forwardX = // Calculates the horizontal direction the car is facing.
        Math.cos( // Converts the angle into an X direction.
            player.angle // Uses the player's current angle.
        );

    const forwardY = // Calculates the vertical direction the car is facing.
        Math.sin( // Converts the angle into a Y direction.
            player.angle // Uses the player's current angle.
        );

    const rightX = // Calculates the horizontal direction to the car's right side.
        -forwardY; // Rotates the forward vector by 90 degrees.

    const rightY = // Calculates the vertical direction to the car's right side.
        forwardX; // Completes the perpendicular right-side vector.

    let throttle = 0; // Stores whether the player is accelerating forward, backward, or not at all.

    if ( // Checks whether the player is pressing forward.
        keys["KeyW"] || // Checks the W key.
        keys["ArrowUp"] // Checks the Up Arrow.
    ) {
        throttle = 1; // Sets throttle to positive one for forward movement.
    }

    if ( // Checks whether the player is pressing backward.
        keys["KeyS"] || // Checks the S key.
        keys["ArrowDown"] // Checks the Down Arrow.
    ) {
        throttle = -1; // Sets throttle to negative one for backward movement.
    }

    let steer = 0; // Stores the current steering direction.

    if ( // Checks whether the player is steering left.
        keys["KeyA"] || // Checks the A key.
        keys["ArrowLeft"] // Checks the Left Arrow.
    ) {
        steer = -1; // Sets steering to negative one for left.
    }

    if ( // Checks whether the player is steering right.
        keys["KeyD"] || // Checks the D key.
        keys["ArrowRight"] // Checks the Right Arrow.
    ) {
        steer = 1; // Sets steering to positive one for right.
    }

    const speed = // Calculates the car's current speed.
        magnitude( // Uses the velocity magnitude helper.
            player.vx, // Horizontal velocity.
            player.vy // Vertical velocity.
        );

    const drifting = // Determines whether the player is currently drifting.
        (
            keys["ShiftLeft"] || // Checks the left Shift key.
            keys["ShiftRight"] // Checks the right Shift key.
        ) &&
        speed > 100; // Requires the car to be moving quickly enough to drift.

    // ========================================================
    // ENGINE
    // ========================================================

    if ( // Checks whether the player is accelerating forward.
        throttle > 0
    ) {
        player.vx += // Adds forward acceleration to horizontal velocity.
            forwardX *
            player.acceleration *
            dt;

        player.vy += // Adds forward acceleration to vertical velocity.
            forwardY *
            player.acceleration *
            dt;
    }

    if ( // Checks whether the player is braking or reversing.
        throttle < 0
    ) {
        player.vx -= // Applies backward acceleration to horizontal velocity.
            forwardX *
            player.brakePower *
            dt;

        player.vy -= // Applies backward acceleration to vertical velocity.
            forwardY *
            player.brakePower *
            dt;
    }

    // ========================================================
    // STEERING / YAW
    // ========================================================
    //
    // The heading no longer snaps straight to the input. Steering
    // sets a TARGET turn rate; the car's actual angular velocity
    // only catches up to that target over time (turnResponsiveness),
    // and it's slower to catch up while drifting -- the car takes
    // a moment to respond, same as a real one with its weight
    // shifted and the rear stepping out.
    //
    // On top of that, once the car is sliding sideways
    // (lastSidewaysVelocity, from last tick), that slide feeds
    // back into MORE rotation in the same direction (oversteerFactor
    // is negative, see comment below) instead of just fizzling out.
    // Left alone, that feedback compounds -- the car keeps rotating
    // further into the slide -- so you have to actively steer the
    // other way to cancel it out, or you spin out. That feedback
    // loop, not the grip values, is what makes this an actual drift
    // instead of the car's nose just gliding wherever you point it.

    const steeringFactor = // Calculates how much steering should affect the car based on speed.
        clamp( // Keeps the steering factor within the allowed range.
            speed / 280, // Makes steering become stronger as speed increases.
            0, // Minimum steering factor.
            1 // Maximum steering factor.
        );

    const steeringPower = // Chooses the steering strength depending on whether the car is drifting.
        drifting // Checks the current drifting state.
            ? 1.55 // Makes steering more powerful while drifting.
            : 1; // Uses normal steering power when not drifting.

    const targetAngularVelocity = // Calculates how quickly the car wants to rotate.
        steer * // Applies the steering direction.
        player.steering * // Applies the car's steering strength.
        steeringFactor * // Applies speed-based steering.
        steeringPower; // Applies the drift steering multiplier.

    const turnResponsiveness = // Determines how quickly the car's rotation catches the steering target.
        drifting // Checks whether the player is drifting.
            ? 3.2 // Makes the car slower to react while drifting.
            : 9; // Makes normal steering react faster.

    player.angularVelocity += // Moves the current angular velocity toward the target.
        (
            targetAngularVelocity - // Calculates the difference between desired and current rotation.
            player.angularVelocity
        ) *
        turnResponsiveness * // Controls how quickly the difference is corrected.
        dt; // Makes the change depend on elapsed time.

    // Oversteer feedback. Sign is negative: a slide to the car's
    // right (positive sideways velocity) means the tail has
    // stepped out to the left, and a real car's yaw moment in
    // that situation keeps rotating the nose further left
    // (angle decreasing) -- i.e. further into the spin -- until
    // it's caught by steering the other way.
    const oversteerFactor = // Controls how strongly sideways sliding feeds back into rotation.
        drifting // Checks whether the car is drifting.
            ? -0.0034 // Uses stronger oversteer feedback during drifting.
            : -0.0009; // Uses weaker oversteer feedback during normal driving.

    player.angularVelocity += // Adds sideways-slip feedback to the car's rotation.
        player.lastSidewaysVelocity * // Uses sideways velocity from the previous physics tick.
        oversteerFactor; // Converts sideways movement into additional rotational movement.

    // Natural yaw damping, so an uncorrected spin still bleeds
    // off eventually instead of spinning forever. Grip stabilizes
    // this fast; drifting lets it linger, which is the whole point.
    const angularDamping = // Controls how quickly unwanted rotation naturally slows down.
        drifting // Checks whether the car is drifting.
            ? 0.988 // Keeps more rotation while drifting.
            : 0.90; // Removes rotation faster during normal driving.

    player.angularVelocity *= // Applies the rotational damping.
        Math.pow( // Scales the damping based on elapsed time.
            angularDamping, // Uses the selected damping strength.
            dt * 60 // Converts the fixed physics timestep into a 60Hz-compatible multiplier.
        );

    player.angularVelocity = // Limits the maximum rotation speed.
        clamp( // Keeps angular velocity inside the allowed range.
            player.angularVelocity, // Current angular velocity.
            -7, // Maximum rotation speed to the left.
            7 // Maximum rotation speed to the right.
        );

    player.angle += // Changes the car's angle.
        player.angularVelocity * // Uses the current rotation speed.
        dt; // Applies it over the current timestep.

    // ========================================================
    // VELOCITY SPLIT
    // ========================================================

    const forwardVelocity = // Calculates how much of the car's velocity points forward.
        player.vx * // Uses horizontal velocity.
        forwardX + // Projects it onto the car's forward direction.
        player.vy * // Uses vertical velocity.
        forwardY; // Adds the vertical projection.

    const sidewaysVelocity = // Calculates how much the car is sliding sideways.
        player.vx * // Uses horizontal velocity.
        rightX + // Projects it onto the car's right direction.
        player.vy * // Uses vertical velocity.
        rightY; // Adds the vertical projection.

    player.lastSidewaysVelocity = // Saves the sideways velocity for the next physics update.
        sidewaysVelocity;

    const grip = // Chooses how much sideways grip the car currently has.
        drifting // Checks whether the car is drifting.
            ? player.driftGrip // Uses low sideways correction during drifting.
            : player.normalGrip; // Uses stronger sideways correction normally.

    const sidewaysMultiplier = // Converts grip into a time-scaled multiplier.
        Math.pow( // Applies grip consistently regardless of timestep.
            grip, // Uses the selected grip value.
            dt * 60 // Scales the value for 60Hz physics.
        );

    const newSidewaysVelocity = // Calculates the sideways velocity after grip is applied.
        sidewaysVelocity *
        sidewaysMultiplier; // Reduces or preserves sideways sliding depending on grip.

    player.vx = // Rebuilds horizontal velocity using forward and sideways movement.
        forwardX *
        forwardVelocity + // Adds the forward part of the velocity.
        rightX *
        newSidewaysVelocity; // Adds the remaining sideways movement.

    player.vy = // Rebuilds vertical velocity using forward and sideways movement.
        forwardY *
        forwardVelocity + // Adds the forward part of the velocity.
        rightY *
        newSidewaysVelocity; // Adds the remaining sideways movement.

    // ========================================================
    // DRIFT SCORE
    // ========================================================

    const sidewaysAmount = // Gets the absolute amount of sideways sliding.
        Math.abs( // Removes the direction and keeps only the size of the slide.
            sidewaysVelocity
        );

    if ( // Checks whether the player is performing a significant drift.
        drifting && // Requires the Shift key to be held.
        sidewaysAmount > 45 && // Requires enough sideways movement.
        speed > 180 // Requires the car to be moving fast enough.
    ) {
        driftTimer += dt; // Increases the duration of the current drift.

        driftScore += // Adds points to the current drift score.
            sidewaysAmount * // Rewards stronger sideways movement.
            speed * // Rewards higher speed.
            0.002 * // Controls the overall drift scoring rate.
            dt; // Applies the score over elapsed time.

        driftCombo = // Calculates the current drift multiplier.
            clamp( // Keeps the multiplier within its allowed range.
                1 + // Starts the multiplier at one.
                Math.floor( // Rounds the timer-based multiplier down.
                    driftTimer / // Uses the current drift duration.
                    1.2 // Increases the combo roughly every 1.2 seconds.
                ),
                1, // Minimum combo multiplier.
                99 // Maximum combo multiplier.
            );

        score += // Adds immediate drift points to the main score.
            sidewaysAmount * // Rewards more sideways movement.
            0.025 * // Controls how many points the slide generates.
            dt; // Applies scoring over elapsed time.

        if ( // Checks whether the combo element exists in the HTML.
            comboElement
        ) {
            comboElement.classList.add( // Adds the CSS class that makes the combo UI visible/active.
                "active" // The CSS class used by the combo display.
            );
        }

        if ( // Checks whether the combo text element exists.
            comboText
        ) {
            comboText.textContent = // Changes the combo label.
                "DRIFT"; // Displays the word DRIFT.
        }

        if ( // Checks whether the combo value element exists.
            comboValue
        ) {
            comboValue.textContent = // Updates the displayed multiplier.
                "x" + // Adds the multiplication symbol.
                driftCombo; // Adds the current combo number.
        }

        if ( // Randomly decides whether to create a drift particle.
            Math.random() <
            0.28 *
            particleQuality
        ) {
            driftParticles(); // Creates a pink drift particle.
        }
    } else {
        if ( // Checks whether the player had been drifting for a meaningful amount of time.
            driftTimer > 0.4
        ) {
            score += // Adds the completed drift's bonus to the main score.
                driftScore * // Uses the points earned during the drift.
                driftCombo; // Multiplies them by the final combo.
        }

        driftTimer = 0; // Resets the drift timer.
        driftScore = 0; // Resets the temporary drift score.
        driftCombo = 1; // Resets the combo multiplier.

        if ( // Checks whether the combo UI exists.
            comboElement
        ) {
            comboElement.classList.remove( // Removes the active CSS class from the combo UI.
                "active" // The class that makes the combo visible.
            );
        }
    }

    // ========================================================
    // BOOST
    // ========================================================

    player.boosting = // Determines whether boost should currently be active.
        keys["Space"] && // Requires the Space key to be held.
        player.boost > 0 && // Requires some boost energy to remain.
        speed > 50; // Requires the car to already be moving.

    if ( // Checks whether boost is active.
        player.boosting
    ) {
        player.vx += // Adds boost acceleration horizontally.
            forwardX *
            1200 *
            dt;

        player.vy += // Adds boost acceleration vertically.
            forwardY *
            1200 *
            dt;

        player.boost -= // Consumes boost energy.
            35 * dt; // Drains 35 boost units per second.

        player.boost = // Prevents boost from going below zero.
            Math.max(
                0, // Minimum boost amount.
                player.boost // Current boost value.
            );

        if ( // Randomly decides whether to create a boost particle.
            Math.random() <
            0.35 *
            particleQuality
        ) {
            boostParticles(); // Creates a cyan boost particle.
        }
    } else {
        player.boost = // Recharges the boost meter when boost is not being used.
            Math.min(
                100, // Maximum boost amount.
                player.boost + // Starts with the current boost.
                8 * dt // Adds 8 boost units per second.
            );
    }

    // ========================================================
    // SPEED LIMIT
    // ========================================================

    const currentSpeed = // Calculates the car's current speed after acceleration and boost.
        magnitude( // Calculates the velocity vector's length.
            player.vx, // Horizontal velocity.
            player.vy // Vertical velocity.
        );

    const maxSpeed = // Chooses the maximum speed depending on whether boost is active.
        player.boosting // Checks whether boost is active.
            ? player.maxSpeed * // Uses the normal maximum speed as a base.
            1.5 // Allows 50% more speed while boosting.
            : player.maxSpeed; // Uses the normal maximum speed otherwise.

    if ( // Checks whether the car is moving faster than its current maximum.
        currentSpeed >
        maxSpeed
    ) {
        const scale = // Calculates how much the velocity needs to be reduced.
            maxSpeed /
            currentSpeed;

        player.vx *= scale; // Scales horizontal velocity down.
        player.vy *= scale; // Scales vertical velocity down.
    }

    // ========================================================
    // DRAG
    // ========================================================

    const drag = // Chooses how much natural resistance affects the car.
        throttle === 0 // Checks whether the player is not accelerating.
            ? 0.985 // Uses stronger drag when coasting.
            : 0.996; // Uses weaker drag while accelerating.

    const dragMultiplier = // Converts drag into a time-scaled multiplier.
        Math.pow( // Applies the drag consistently over time.
            drag, // Uses the selected drag value.
            dt * 60 // Scales it for 60Hz physics.
        );

    player.vx *= // Applies drag to horizontal velocity.
        dragMultiplier;

    player.vy *= // Applies drag to vertical velocity.
        dragMultiplier;

    // ========================================================
    // MOVE
    // ========================================================

    player.x += // Moves the car horizontally.
        player.vx * dt; // Uses horizontal velocity and elapsed time.

    player.y += // Moves the car vertically.
        player.vy * dt; // Uses vertical velocity and elapsed time.

    // ========================================================
    // WALL
    // ========================================================

    handleWallCollision(); // Checks whether the car has hit or is grinding against the road edge.

    // ========================================================
    // FINISH
    // ========================================================

    updateFinishLine(); // Checks whether the player has crossed the finish line.

    // ========================================================
    // TIMER
    // ========================================================

    raceTime += dt; // Adds the current physics timestep to the race timer.

    if ( // Checks whether the wall collision cooldown is active.
        player.wallCooldown > 0
    ) {
        player.wallCooldown -= // Counts the cooldown down.
            dt; // Reduces it by the elapsed physics time.
    }
}

// ============================================================
// WALL COLLISION
// ============================================================

function handleWallCollision() { // Handles collisions between the car and the track boundaries.
    const closest = // Finds the closest point on the track to the car.
        getClosestTrackPoint( // Uses the track-point helper.
            player.x, // Gives the car's X position.
            player.y // Gives the car's Y position.
        );

    if (!closest) { // Checks whether a closest point could not be found.
        return; // Stops the collision check if no track point exists.
    }

    const allowedDistance = // Calculates how far the car's center can be from the road center.
        TRACK_RADIUS - // Starts with half of the road width.
        player.radius; // Subtracts the car's collision radius.

    if ( // Checks whether the car is safely inside the road.
        closest.distance <=
        allowedDistance
    ) {
        player.grinding = // Marks the car as not touching the wall.
            false;

        return; // Stops because no wall collision is happening.
    }

    const dx = // Calculates the horizontal distance from the road center to the car.
        player.x -
        closest.x;

    const dy = // Calculates the vertical distance from the road center to the car.
        player.y -
        closest.y;

    const distanceFromCenter = // Calculates the car's distance from the closest track point.
        Math.sqrt( // Converts the squared distance into normal distance.
            dx * dx + // Squares horizontal distance.
            dy * dy // Squares vertical distance.
        );

    if ( // Checks for an extremely tiny distance that could cause division problems.
        distanceFromCenter <
        0.001
    ) {
        return; // Stops before attempting to normalize a nearly zero vector.
    }

    const nx = // Calculates the horizontal collision normal.
        dx /
        distanceFromCenter;

    const ny = // Calculates the vertical collision normal.
        dy /
        distanceFromCenter;

    const penetration = // Calculates how far the car has moved beyond the allowed road boundary.
        closest.distance -
        allowedDistance;

    player.x -= // Pushes the car back inside the road horizontally.
        nx * penetration;

    player.y -= // Pushes the car back inside the road vertically.
        ny * penetration;

    const normalVelocity = // Calculates how quickly the car is moving into the wall.
        player.vx * nx + // Projects horizontal velocity onto the wall normal.
        player.vy * ny; // Adds the vertical projection.

    if ( // Only reacts strongly if the car is moving outward into the wall.
        normalVelocity > 0
    ) {
        const tangentX = // Calculates the part of velocity parallel to the wall.
            player.vx -
            nx *
            normalVelocity;

        const tangentY = // Calculates the vertical part of velocity parallel to the wall.
            player.vy -
            ny *
            normalVelocity;

        player.vx = // Replaces horizontal velocity with mostly tangential movement.
            tangentX * 0.84; // Reduces speed slightly while grinding.

        player.vy = // Replaces vertical velocity with mostly tangential movement.
            tangentY * 0.84; // Reduces speed slightly while grinding.

        player.grinding = // Marks the car as currently grinding the wall.
            true;

        if ( // Randomly decides whether to create a grinding spark.
            Math.random() <
            0.28 *
            particleQuality
        ) {
            grindingParticles(); // Creates a yellow grinding spark.
        }

        if ( // Checks whether the collision was strong enough to count as a crash.
            Math.abs( // Gets the absolute collision speed.
                normalVelocity
            ) > 180 && // Requires at least 180 units of impact speed.
            player.wallCooldown <= // Makes sure another crash was not just triggered.
            0
        ) {
            const kick = // Calculates how strongly the car should bounce backward.
                Math.min( // Caps the backward kick so it cannot become excessive.
                    Math.abs( // Gets the absolute collision speed.
                        normalVelocity
                    ) * 0.25, // Converts collision speed into a backward kick.
                    180 // Maximum backward kick.
                );

            player.vx -= // Pushes the car away from the wall horizontally.
                nx * kick;

            player.vy -= // Pushes the car away from the wall vertically.
                ny * kick;

            crashParticles(); // Creates the larger crash particle burst.

            camera.shake = // Sets camera shake based on collision strength.
                clamp( // Keeps the shake inside a reasonable range.
                    Math.abs( // Uses the absolute impact speed.
                        normalVelocity
                    ) / 700, // Converts impact speed into shake strength.
                    0.2, // Minimum shake.
                    1 // Maximum shake.
                );

            player.wallCooldown = // Prevents another crash from immediately triggering.
                0.15; // Keeps the crash cooldown active for 0.15 seconds.
        }
    }
}

// ============================================================
// FINISH LINE
// ============================================================

// getFinishSide tells us which side of the finish PLANE the
// player is on. The finish plane is perpendicular to the
// direction of travel, so "side" must be measured along
// finishDir (the direction the car actually drives through
// the gate) -- NOT finishNormal (which only measures the
// car's left/right position across the road and has nothing
// to do with whether the car has passed through the gate).
function getFinishSide( // Calculates which side of the finish plane the player is on.
    x, // Receives the position's X coordinate.
    y // Receives the position's Y coordinate.
) {
    const dx = // Calculates horizontal distance from the finish point.
        x -
        finishPoint.x;

    const dy = // Calculates vertical distance from the finish point.
        y -
        finishPoint.y;

    return ( // Returns a signed value representing the side of the finish plane.
        dx * // Uses horizontal distance.
        finishDirX + // Projects it onto the finish direction.
        dy * // Uses vertical distance.
        finishDirY // Adds the vertical projection.
    );
}

function updateFinishLine() { // Checks whether the player has crossed the finish line.
    if ( // Checks whether the finish-line cooldown is active.
        finishCooldown > 0
    ) {
        finishCooldown -= // Counts the cooldown down.
            FIXED_DT; // Uses the fixed physics timestep.
    }

    const side = // Gets the player's current side of the finish plane.
        getFinishSide( // Uses the finish-side calculation.
            player.x, // Player X position.
            player.y // Player Y position.
        );

    if ( // Checks whether this is the first time checking the finish line.
        previousFinishSide ===
        null
    ) {
        previousFinishSide = // Stores the player's starting side of the finish plane.
            side;

        return; // Stops because a crossing cannot be detected yet.
    }

    const crossed = // Determines whether the player moved from the negative side to the positive side.
        previousFinishSide <
        0 &&
        side >= 0;

    previousFinishSide = // Saves the current side for the next physics update.
        side;

    if ( // Checks whether the finish line should not currently trigger.
        !crossed || // Requires an actual crossing.
        finishCooldown > 0 || // Requires the finish cooldown to have expired.
        raceTime < 2 // Prevents the starting position from immediately counting as a lap.
    ) {
        return; // Stops without completing a lap.
    }

    // Make sure the player is actually
    // inside the road width when crossing.
    //
    // Road width is the LATERAL dimension of the
    // road, i.e. how far the player is offset to
    // either side of the centerline -- that's the
    // finishNormal axis, not finishDir. This is what
    // prevents a random crossing far away from the
    // physical finish lane.

    const lateralOffset = // Calculates how far sideways the player is from the finish line's center.
        (
            player.x -
            finishPoint.x
        ) *
        finishNormalX + // Projects horizontal distance onto the sideways road direction.
        (
            player.y -
            finishPoint.y
        ) *
        finishNormalY; // Adds the vertical sideways projection.

    if ( // Checks whether the player is too far sideways from the finish lane.
        Math.abs( // Gets the absolute lateral distance.
            lateralOffset
        ) >
        TRACK_RADIUS + // Allows the normal half-width of the road.
        35 // Adds a small tolerance so the finish detection is forgiving.
    ) {
        return; // Does not count the crossing if the car was outside the lane.
    }

    finishCooldown = 2; // Starts a two-second cooldown before another finish crossing can count.

    completeLap(); // Completes the current lap.
}

function completeLap() { // Handles what happens when the player completes a lap.
    if ( // Checks whether this was the final required lap.
        lap >= TOTAL_LAPS
    ) {
        finishRace(); // Ends the race instead of starting another lap.
        return; // Stops this function after finishing the race.
    }

    lap++; // Moves the player to the next lap.

    score += 5000; // Gives the player 5,000 bonus points for completing a lap.

    showMessage( // Displays a message on screen.
        "LAP " + // Starts the message with the word LAP.
        lap // Adds the new lap number.
    );
}

// ============================================================
// FINISH
// ============================================================

function finishRace() { // Handles everything that happens when the race ends.
    raceFinished = true; // Marks the race as completed.
    gameStarted = false; // Stops the gameplay simulation.

    player.vx *= 0.25; // Quickly slows the car's horizontal velocity.
    player.vy *= 0.25; // Quickly slows the car's vertical velocity.

    if ( // Checks whether the final score element exists.
        finalScoreElement
    ) {
        finalScoreElement.textContent = // Displays the final score.
            String( // Converts the score into text.
                Math.floor( // Removes decimal places from the score.
                    score
                )
            ).padStart( // Adds leading zeroes to keep the display the same width.
                6, // Makes the displayed number six characters wide.
                "0" // Uses zero as the padding character.
            );
    }

    if ( // Checks whether the final lap element exists.
        finalLapsElement
    ) {
        finalLapsElement.textContent = // Displays the number of completed laps.
            TOTAL_LAPS;
    }

    if ( // Checks whether the final coin element exists.
        finalCoinsElement
    ) {
        finalCoinsElement.textContent = // Displays the number of collected coins.
            coins;
    }

    if ( // Checks whether the finish screen exists.
        finishScreen
    ) {
        finishScreen.classList.remove( // Removes the hidden CSS class.
            "hidden" // Makes the finish screen visible.
        );
    }

    if ( // Checks whether the combo UI exists.
        comboElement
    ) {
        comboElement.classList.remove( // Hides the active combo display.
            "active" // Removes the CSS class that activates it.
        );
    }
}

// ============================================================
// RESET RACE
// ============================================================

function resetPlayer() { // Resets the player's car back to its starting state.
    player.x = // Resets the player's horizontal position.
        finishPoint.x;

    player.y = // Resets the player's vertical position.
        finishPoint.y;

    player.vx = 0; // Stops all horizontal movement.
    player.vy = 0; // Stops all vertical movement.

    player.angle = // Points the car along the starting track direction.
        Math.atan2( // Converts the direction vector into an angle.
            finishDirY, // Uses the finish direction's vertical component.
            finishDirX // Uses the finish direction's horizontal component.
        );

    player.angularVelocity = 0; // Removes any leftover rotational momentum.
    player.lastSidewaysVelocity = 0; // Removes any leftover sideways sliding.

    player.boost = 100; // Refills the boost meter completely.

    player.boosting = false; // Makes sure boost is not active.
    player.grinding = false; // Makes sure the car is not grinding.
    player.wallCooldown = 0; // Removes any active wall crash cooldown.
}

function restartRace() { // Completely resets the current race and starts it again.
    raceFinished = false; // Marks the race as not finished.
    gameStarted = true; // Immediately starts the restarted race.

    score = 0; // Resets the score.
    lap = 1; // Resets the lap number.
    coins = 0; // Resets the coin count.

    raceTime = 0; // Resets the race timer.

    finishCooldown = 2; // Resets the finish-line cooldown.
    previousFinishSide = null; // Removes the previously stored finish-line side.

    driftScore = 0; // Resets the temporary drift score.
    driftCombo = 1; // Resets the drift multiplier.
    driftTimer = 0; // Resets the drift timer.

    resetPlayer(); // Puts the car back at the starting position.

    camera.x = // Resets the camera's horizontal position.
        player.x;

    camera.y = // Resets the camera's vertical position.
        player.y;

    camera.lookX = 0; // Removes horizontal camera look-ahead.
    camera.lookY = 0; // Removes vertical camera look-ahead.
    camera.shake = 0; // Removes any camera shake.

    for ( // Loops through all particles.
        const particle of particles // Gets each particle in the particle pool.
    ) {
        particle.active = // Disables every existing particle.
            false;
    }

    if ( // Checks whether the finish screen exists.
        finishScreen
    ) {
        finishScreen.classList.add( // Hides the finish screen again.
            "hidden" // Adds the CSS class that hides it.
        );
    }

    if ( // Checks whether the start screen exists.
        startScreen
    ) {
        startScreen.style.display = // Makes sure the start screen stays hidden after restarting.
            "none";
    }

    showMessage( // Displays a short message before the restarted race begins.
        "GET READY" // Text shown to the player.
    );
}

// ============================================================
// START
// ============================================================

function startGame() { // Starts the race from the main menu.
    if ( // Checks whether the game is already running.
        gameStarted
    ) {
        return; // Stops so clicking Start multiple times does not reset the race.
    }

    gameStarted = true; // Starts the game simulation.
    raceFinished = false; // Makes sure the race is marked as unfinished.

    score = 0; // Resets the score.
    lap = 1; // Starts on lap one.
    coins = 0; // Resets the coin count.

    raceTime = 0; // Resets the race timer.

    finishCooldown = 2; // Gives the finish line its starting cooldown.
    previousFinishSide = null; // Clears the previous finish-line position.

    driftScore = 0; // Clears any previous drift score.
    driftCombo = 1; // Resets the drift multiplier.
    driftTimer = 0; // Resets the drift timer.

    resetPlayer(); // Places the car at the starting position.

    camera.x = // Places the camera directly on the player.
        player.x;

    camera.y = // Places the camera directly on the player.
        player.y;

    camera.lookX = 0; // Removes horizontal camera look-ahead.
    camera.lookY = 0; // Removes vertical camera look-ahead.
    camera.shake = 0; // Removes any camera shake.

    if ( // Checks whether the start screen exists.
        startScreen
    ) {
        startScreen.style.display = // Hides the main menu.
            "none";
    }

    if ( // Checks whether the finish screen exists.
        finishScreen
    ) {
        finishScreen.classList.add( // Makes sure the finish screen is hidden.
            "hidden" // CSS class used to hide the finish screen.
        );
    }

    showMessage( // Displays the race-start message.
        "GO!" // Text shown to the player.
    );
}

if ( // Checks whether the start button exists.
    startButton
) {
    startButton.addEventListener( // Adds a click listener to the start button.
        "click", // Runs the function when the button is clicked.
        startGame // Starts the game.
    );
}

if ( // Checks whether the restart button exists.
    restartButton
) {
    restartButton.addEventListener( // Adds a click listener to the restart button.
        "click", // Runs the function when the button is clicked.
        restartRace // Restarts the race.
    );
}

// ============================================================
// MESSAGE
// ============================================================

function showMessage(text) { // Displays a temporary message to the player.
    if ( // Checks whether the message element exists.
        !messageElement
    ) {
        return; // Stops if the message UI is missing.
    }

    messageText.textContent = // Changes the message displayed on screen.
        text;

    messageElement.style.opacity = // Makes the message fully visible.
        "1";

    messageTimer = 1.4; // Keeps the message visible for 1.4 seconds.
}

function updateMessage(dt) { // Updates the message timer and hides expired messages.
    if ( // Checks whether there is currently no message timer running.
        messageTimer <= 0
    ) {
        return; // Stops because there is nothing to update.
    }

    messageTimer -= dt; // Counts the message timer down.

    if ( // Checks whether the message timer has expired.
        messageTimer <= 0
    ) {
        messageElement.style.opacity = // Makes the message invisible.
            "0";
    }
}

// ============================================================
// HUD
// ============================================================

function updateHUD() { // Updates all visible race information on the screen.
    const speed = // Calculates the player's current speed.
        magnitude( // Uses the velocity magnitude helper.
            player.vx, // Horizontal velocity.
            player.vy // Vertical velocity.
        );

    if ( // Checks whether the score element exists.
        scoreElement
    ) {
        scoreElement.textContent = // Updates the score displayed on screen.
            String( // Converts the score to text.
                Math.floor( // Removes decimal places.
                    score
                )
            ).padStart( // Adds leading zeroes.
                6, // Makes the score six characters wide.
                "0" // Uses zeroes as padding.
            );
    }

    if ( // Checks whether the lap element exists.
        lapElement
    ) {
        lapElement.textContent = // Updates the displayed lap counter.
            lap + // Adds the current lap.
            " / " + // Adds the separator between current and total laps.
            TOTAL_LAPS; // Adds the total lap count.
    }

    if ( // Checks whether the speed element exists.
        speedElement
    ) {
        speedElement.textContent = // Updates the displayed speed.
            Math.floor( // Removes decimal places.
                speed * 0.22 // Converts the game's internal speed into the displayed km/h-style value.
            );
    }

    const boost = // Gets the current boost while making sure it stays within 0 to 100.
        clamp( // Uses the clamp helper.
            player.boost, // Current boost amount.
            0, // Minimum boost.
            100 // Maximum boost.
        );

    if ( // Checks whether the boost bar exists.
        boostFill
    ) {
        boostFill.style.width = // Changes the visual width of the boost bar.
            boost + "%"; // Converts the boost number into a CSS percentage.
    }

    if ( // Checks whether the boost percentage text exists.
        boostPercent
    ) {
        boostPercent.textContent = // Updates the boost percentage text.
            Math.floor( // Removes decimal places.
                boost // Uses the current boost amount.
            ) +
            "%"; // Adds the percentage symbol.
    }
}

// ============================================================
// STATIC TRACK CACHE
// ============================================================

const WORLD_PADDING = 120; // Adds extra space around the cached track so its edges are not clipped.

let trackCache = null; // Stores the pre-rendered track canvas.

const worldBounds = { // Defines the rectangular area covered by the game world.
    minX: -1100, // Minimum world X coordinate.
    minY: -650, // Minimum world Y coordinate.
    maxX: 1650, // Maximum world X coordinate.
    maxY: 1500 // Maximum world Y coordinate.
};

function createTrackCache() { // Pre-renders the static track so it does not have to be redrawn from scratch every frame.
    const width = // Calculates the width needed for the cached world.
        Math.ceil( // Rounds the result up to a whole pixel.
            worldBounds.maxX - // Starts with the world's maximum X.
            worldBounds.minX + // Subtracts the world's minimum X to get its width.
            WORLD_PADDING * 2 // Adds padding on both sides.
        );

    const height = // Calculates the height needed for the cached world.
        Math.ceil( // Rounds the result up to a whole pixel.
            worldBounds.maxY - // Starts with the world's maximum Y.
            worldBounds.minY + // Subtracts the world's minimum Y to get its height.
            WORLD_PADDING * 2 // Adds padding above and below.
        );

    trackCache = // Creates an off-screen canvas used as the static track cache.
        document.createElement( // Creates a new HTML element.
            "canvas" // Requests a canvas element.
        );

    trackCache.width = // Sets the cache's pixel width.
        width;

    trackCache.height = // Sets the cache's pixel height.
        height;

    const cache = // Gets the drawing context for the off-screen cache.
        trackCache.getContext( // Requests a 2D drawing context.
            "2d" // Uses the standard 2D canvas renderer.
        );

    if (!cache) { // Checks whether the cache drawing context failed to initialize.
        trackCache = null; // Disables the cache if the context is unavailable.
        return; // Stops the cache creation function.
    }

    const offsetX = // Calculates how much to shift world coordinates into cache coordinates.
        -worldBounds.minX + // Moves the minimum world X toward zero.
        WORLD_PADDING; // Adds the required padding.

    const offsetY = // Calculates how much to shift world coordinates into cache coordinates.
        -worldBounds.minY + // Moves the minimum world Y toward zero.
        WORLD_PADDING; // Adds the required padding.

    cache.save(); // Saves the cache canvas drawing state.

    cache.translate( // Moves the cache's coordinate system to match world coordinates.
        offsetX, // Horizontal offset.
        offsetY // Vertical offset.
    );

    cache.lineJoin = // Controls how connected road corners are drawn.
        "round"; // Rounds the joins between road segments.

    cache.lineCap = // Controls how line ends are drawn.
        "round"; // Rounds line ends.

    // --------------------------------------------------------
    // Track glow
    // --------------------------------------------------------

    cache.beginPath(); // Starts a new path for the track outline.

    for ( // Loops through every point in the track.
        let i = 0; // Starts at track point zero.
        i < track.length; // Continues until every track point is processed.
        i++ // Moves to the next point.
    ) {
        const p = // Gets the current track point.
            track[i];

        if (i === 0) { // Checks whether this is the first track point.
            cache.moveTo( // Moves the drawing cursor to the first point without drawing.
                p.x, // First point's X coordinate.
                p.y // First point's Y coordinate.
            );
        } else {
            cache.lineTo( // Draws a line from the previous point to this point.
                p.x, // Current point's X coordinate.
                p.y // Current point's Y coordinate.
            );
        }
    }

    cache.closePath(); // Connects the final point back to the first point.

    cache.shadowBlur = 18; // Gives the track glow a soft blurred edge.

    cache.shadowColor = // Sets the color used for the track glow.
        "#00eaff"; // Uses neon cyan.

    cache.strokeStyle = // Sets the transparent color of the glow line.
        "rgba(0,220,255,0.20)"; // Uses a faint cyan.

    cache.lineWidth = // Sets the width of the glow around the road.
        TRACK_WIDTH + 16; // Makes the glow slightly wider than the road.

    cache.stroke(); // Draws the glowing track outline.

    // --------------------------------------------------------
    // Road
    // --------------------------------------------------------

    cache.shadowBlur = 0; // Turns off the glow before drawing the main road.

    cache.strokeStyle = // Sets the road's main color.
        "#151a29"; // Uses a dark blue-gray.

    cache.lineWidth = // Sets the actual road width.
        TRACK_WIDTH;

    cache.stroke(); // Draws the main road.

    // --------------------------------------------------------
    // Road edge
    // --------------------------------------------------------

    cache.strokeStyle = // Sets the color of the road edge.
        "rgba(0,230,255,0.35)"; // Uses a semi-transparent cyan.

    cache.lineWidth = 4; // Sets the thickness of the road edge.

    cache.stroke(); // Draws the glowing road edge.

    cache.restore(); // Restores the cache canvas drawing settings.
}

createTrackCache(); // Builds the static track cache once when the game loads.

// ============================================================
// DRAW TRACK
// ============================================================

function drawTrack() { // Draws the cached track and finish line.
    if ( // Checks whether the static track cache was created successfully.
        trackCache
    ) {
        ctx.drawImage( // Copies the cached track onto the main game canvas.
            trackCache, // Uses the pre-rendered track image.

            worldBounds.minX - // Calculates where the cached image should begin horizontally.
            WORLD_PADDING,

            worldBounds.minY - // Calculates where the cached image should begin vertically.
            WORLD_PADDING
        );
    } else {
        ctx.save(); // Saves the current canvas drawing settings.

        ctx.beginPath(); // Starts a new road path.

        for ( // Loops through every track point.
            let i = 0; // Starts at the first point.
            i < track.length; // Continues through all points.
            i++ // Moves to the next point.
        ) {
            const p = // Gets the current track point.
                track[i];

            if (i === 0) { // Checks whether this is the first point.
                ctx.moveTo( // Moves to the first point without drawing.
                    p.x, // First point X.
                    p.y // First point Y.
                );
            } else {
                ctx.lineTo( // Draws a line to the current point.
                    p.x, // Current point X.
                    p.y // Current point Y.
                );
            }
        }

        ctx.closePath(); // Connects the final point back to the first point.

        ctx.strokeStyle = // Sets the fallback road color.
            "#151a29"; // Uses the same dark road color as the cache.

        ctx.lineWidth = // Sets the fallback road width.
            TRACK_WIDTH;

        ctx.stroke(); // Draws the fallback road.

        ctx.restore(); // Restores the canvas drawing state.
    }

    drawFinishLine(); // Draws the checkered start/finish line over the road.
}

// ============================================================
// PROPER START / FINISH LANE
// ============================================================

function drawFinishLine() { // Draws the checkered finish line across the full road width.
    const roadHalfWidth = // Calculates half of the road width.
        TRACK_WIDTH / 2;

    const laneDepth = 46; // Sets how deep the finish-line rectangle is along the direction of travel.

    const halfDepth = // Calculates half of the finish-line depth.
        laneDepth / 2;

    const edge1X = // Calculates the X coordinate of one road edge at the finish point.
        finishPoint.x -
        finishNormalX *
        roadHalfWidth;

    const edge1Y = // Calculates the Y coordinate of one road edge at the finish point.
        finishPoint.y -
        finishNormalY *
        roadHalfWidth;

    const edge2X = // Calculates the X coordinate of the opposite road edge.
        finishPoint.x +
        finishNormalX *
        roadHalfWidth;

    const edge2Y = // Calculates the Y coordinate of the opposite road edge.
        finishPoint.y +
        finishNormalY *
        roadHalfWidth;

    const p1x = // Calculates the first corner of the finish rectangle.
        edge1X -
        finishDirX *
        halfDepth;

    const p1y = // Calculates the first corner's Y coordinate.
        edge1Y -
        finishDirY *
        halfDepth;

    const p2x = // Calculates the second corner's X coordinate.
        edge2X -
        finishDirX *
        halfDepth;

    const p2y = // Calculates the second corner's Y coordinate.
        edge2Y -
        finishDirY *
        halfDepth;

    const p3x = // Calculates the third corner's X coordinate.
        edge2X +
        finishDirX *
        halfDepth;

    const p3y = // Calculates the third corner's Y coordinate.
        edge2Y +
        finishDirY *
        halfDepth;

    const p4x = // Calculates the fourth corner's X coordinate.
        edge1X +
        finishDirX *
        halfDepth;

    const p4y = // Calculates the fourth corner's Y coordinate.
        edge1Y +
        finishDirY *
        halfDepth;

    ctx.save(); // Saves the current canvas drawing settings.

    ctx.shadowBlur = 18; // Adds a glow around the finish lane.

    ctx.shadowColor = // Sets the finish glow color.
        "#ff008c"; // Uses neon pink.

    ctx.strokeStyle = // Sets the finish lane outline color.
        "rgba(255,0,140,0.65)"; // Uses semi-transparent pink.

    ctx.lineWidth = 5; // Sets the finish lane outline thickness.

    ctx.beginPath(); // Starts the outline path.

    ctx.moveTo( // Moves to the first finish-line corner.
        p1x, // First corner X.
        p1y // First corner Y.
    );

    ctx.lineTo( // Draws to the second corner.
        p2x, // Second corner X.
        p2y // Second corner Y.
    );

    ctx.lineTo( // Draws to the third corner.
        p3x, // Third corner X.
        p3y // Third corner Y.
    );

    ctx.lineTo( // Draws to the fourth corner.
        p4x, // Fourth corner X.
        p4y // Fourth corner Y.
    );

    ctx.closePath(); // Connects the fourth corner back to the first.

    ctx.stroke(); // Draws the glowing finish-line outline.

    ctx.restore(); // Restores the previous canvas drawing settings.

    const checkerCount = 10; // Sets how many checkerboard sections span the road.

    const checkerWidth = // Calculates the width of each checker section.
        TRACK_WIDTH /
        checkerCount;

    for ( // Loops through every checkerboard section.
        let i = 0; // Starts at the first checker.
        i < checkerCount; // Continues through all checkers.
        i++ // Moves to the next checker.
    ) {
        const startOffset = // Calculates the starting sideways offset of this checker.
            -roadHalfWidth +
            i *
            checkerWidth;

        const endOffset = // Calculates the ending sideways offset of this checker.
            startOffset +
            checkerWidth;

        const aX = // Calculates the first point's X coordinate.
            finishPoint.x +
            finishNormalX *
            startOffset;

        const aY = // Calculates the first point's Y coordinate.
            finishPoint.y +
            finishNormalY *
            startOffset;

        const bX = // Calculates the second point's X coordinate.
            finishPoint.x +
            finishNormalX *
            endOffset;

        const bY = // Calculates the second point's Y coordinate.
            finishPoint.y +
            finishNormalY *
            endOffset;

        const aBackX = // Calculates the back-left corner of this checker.
            aX -
            finishDirX *
            halfDepth;

        const aBackY = // Calculates the back-left corner's Y coordinate.
            aY -
            finishDirY *
            halfDepth;

        const bBackX = // Calculates the back-right corner's X coordinate.
            bX -
            finishDirX *
            halfDepth;

        const bBackY = // Calculates the back-right corner's Y coordinate.
            bY -
            finishDirY *
            halfDepth;

        const bFrontX = // Calculates the front-right corner's X coordinate.
            bX +
            finishDirX *
            halfDepth;

        const bFrontY = // Calculates the front-right corner's Y coordinate.
            bY +
            finishDirY *
            halfDepth;

        const aFrontX = // Calculates the front-left corner's X coordinate.
            aX +
            finishDirX *
            halfDepth;

        const aFrontY = // Calculates the front-left corner's Y coordinate.
            aY +
            finishDirY *
            halfDepth;

        ctx.fillStyle = // Chooses the color for this checker.
            i % 2 === 0 // Checks whether the checker index is even.
                ? "#ffffff" // Uses white for even checkers.
                : "#ff008c"; // Uses pink for odd checkers.

        ctx.beginPath(); // Starts the checker polygon.

        ctx.moveTo( // Moves to the back-left corner.
            aBackX, // Back-left X.
            aBackY // Back-left Y.
        );

        ctx.lineTo( // Draws to the back-right corner.
            bBackX, // Back-right X.
            bBackY // Back-right Y.
        );

        ctx.lineTo( // Draws to the front-right corner.
            bFrontX, // Front-right X.
            bFrontY // Front-right Y.
        );

        ctx.lineTo( // Draws to the front-left corner.
            aFrontX, // Front-left X.
            aFrontY // Front-left Y.
        );

        ctx.closePath(); // Connects the final corner back to the first.

        ctx.fill(); // Fills the checker with its selected color.
    }

    ctx.save(); // Saves the canvas drawing state before drawing the cyan edge markers.

    ctx.strokeStyle = // Sets the edge marker color.
        "#00f6ff"; // Uses neon cyan.

    ctx.shadowBlur = 10; // Adds a small glow around the edge markers.

    ctx.shadowColor = // Sets the glow color.
        "#00f6ff"; // Uses the same cyan as the markers.

    ctx.lineWidth = 4; // Sets the edge marker thickness.

    ctx.beginPath(); // Starts the edge marker path.

    ctx.moveTo( // Moves to the first road edge.
        p1x, // First edge X.
        p1y // First edge Y.
    );

    ctx.lineTo( // Draws along the first edge of the finish lane.
        p4x, // Ending X.
        p4y // Ending Y.
    );

    ctx.moveTo( // Moves to the opposite road edge.
        p2x, // Second edge X.
        p2y // Second edge Y.
    );

    ctx.lineTo( // Draws along the second edge of the finish lane.
        p3x, // Ending X.
        p3y // Ending Y.
    );

    ctx.stroke(); // Draws both cyan edge markers.

    ctx.restore(); // Restores the previous canvas drawing state.
}

// ============================================================
// GRID
// ============================================================

function drawGrid( // Draws the background grid only in the area visible to the camera.
    viewLeft, // Left boundary of the visible world area.
    viewRight, // Right boundary of the visible world area.
    viewTop, // Top boundary of the visible world area.
    viewBottom // Bottom boundary of the visible world area.
) {
    const grid = 100; // Sets the spacing between grid lines.

    const left = // Calculates the first vertical grid line to draw.
        Math.floor( // Rounds down so the grid starts before the camera.
            viewLeft / grid // Finds which grid cell contains the left edge.
        ) * grid; // Converts the cell number back into a world coordinate.

    const right = // Calculates the final vertical grid line to draw.
        Math.ceil( // Rounds up so the grid extends past the camera.
            viewRight / grid // Finds which grid cell contains the right edge.
        ) * grid; // Converts the cell number back into a world coordinate.

    const top = // Calculates the first horizontal grid line.
        Math.floor( // Rounds down to cover the top edge.
            viewTop / grid // Finds the top grid cell.
        ) * grid; // Converts it back to a world coordinate.

    const bottom = // Calculates the final horizontal grid line.
        Math.ceil( // Rounds up to cover the bottom edge.
            viewBottom / grid // Finds the bottom grid cell.
        ) * grid; // Converts it back to a world coordinate.

    ctx.strokeStyle = // Sets the grid line color.
        "rgba(50,120,180,0.08)"; // Uses a very faint blue.

    ctx.lineWidth = 1; // Makes the grid lines one pixel wide.

    ctx.beginPath(); // Starts a new grid path.

    for ( // Loops through every vertical grid line that is visible.
        let x = left; // Starts at the calculated left grid position.
        x <= right; // Continues until the right edge is reached.
        x += grid // Moves one grid spacing at a time.
    ) {
        ctx.moveTo( // Moves to the top of the current vertical line.
            x, // Current grid X coordinate.
            top // Top visible Y coordinate.
        );

        ctx.lineTo( // Draws the vertical line downward.
            x, // Keeps the same X coordinate.
            bottom // Ends at the bottom visible Y coordinate.
        );
    }

    for ( // Loops through every horizontal grid line that is visible.
        let y = top; // Starts at the calculated top grid position.
        y <= bottom; // Continues until the bottom edge is reached.
        y += grid // Moves one grid spacing at a time.
    ) {
        ctx.moveTo( // Moves to the left side of the current horizontal line.
            left, // Left visible X coordinate.
            y // Current grid Y coordinate.
        );

        ctx.lineTo( // Draws the horizontal line across the screen.
            right, // Right visible X coordinate.
            y // Keeps the same Y coordinate.
        );
    }

    ctx.stroke(); // Draws all of the grid lines at once.
}

// ============================================================
// CAR
// ============================================================

function drawCar() { // Draws the player's car.
    ctx.save(); // Saves the canvas drawing state before transforming it.

    ctx.translate( // Moves the drawing origin to the car's position.
        player.x, // Car X position.
        player.y // Car Y position.
    );

    ctx.rotate( // Rotates the drawing so the car faces its current direction.
        player.angle // Uses the player's current angle.
    );

    ctx.fillStyle = // Sets the car shadow color.
        "rgba(0,0,0,0.35)"; // Uses a semi-transparent black.

    ctx.beginPath(); // Starts the shadow shape.

    ctx.ellipse( // Draws an oval underneath the car.
        5, // Shadow horizontal offset.
        7, // Shadow vertical offset.
        31, // Shadow horizontal radius.
        17, // Shadow vertical radius.
        0, // Shadow rotation.
        0, // Starting angle of the ellipse.
        Math.PI * 2 // Ends after a full circle.
    );

    ctx.fill(); // Fills the shadow shape.

    ctx.shadowBlur = 12; // Adds a glow around the car body.

    ctx.shadowColor = // Sets the car glow color.
        "#00eaff"; // Uses neon cyan.

    ctx.fillStyle = // Sets the car's main body color.
        "#00d9ff"; // Uses bright cyan.

    ctx.fillRect( // Draws the main rectangular car body.
        -25, // Body's left position relative to the car center.
        -13, // Body's top position.
        50, // Body width.
        26 // Body height.
    );

    ctx.shadowBlur = 0; // Removes the glow before drawing the windows.

    ctx.fillStyle = // Sets the window/interior color.
        "#111827"; // Uses dark blue-gray.

    ctx.fillRect( // Draws the central dark window/interior area.
        -20, // Left position.
        -10, // Top position.
        40, // Width.
        20 // Height.
    );

    ctx.fillStyle = // Sets the windshield/window highlight color.
        "#91f7ff"; // Uses a light cyan.

    ctx.fillRect( // Draws the highlighted window.
        -2, // Left position.
        -8, // Top position.
        14, // Width.
        16 // Height.
    );

    ctx.fillStyle = // Sets the headlight color.
        "#ffffff"; // Uses white.

    ctx.fillRect( // Draws the upper headlight.
        18, // Headlight X position.
        -7, // Headlight Y position.
        5, // Headlight width.
        5 // Headlight height.
    );

    ctx.fillRect( // Draws the lower headlight.
        18, // Headlight X position.
        2, // Headlight Y position.
        5, // Headlight height.
        5 // Headlight width.
    );

    if ( // Checks whether the car is currently boosting.
        player.boosting
    ) {
        ctx.fillStyle = // Sets the boost flame color.
            "#ffd83b"; // Uses bright yellow.

        ctx.beginPath(); // Starts the boost flame shape.

        ctx.moveTo( // Moves to the first point of the flame.
            -23, // Flame X position.
            -7 // Flame Y position.
        );

        ctx.lineTo( // Draws to the rear-middle point of the flame.
            -48, // Flame X position.
            0 // Flame Y position.
        );

        ctx.lineTo( // Draws to the lower flame point.
            -23, // Flame X position.
            7 // Flame Y position.
        );

        ctx.closePath(); // Closes the triangular flame shape.

        ctx.fill(); // Fills the boost flame.
    }

    ctx.restore(); // Restores the canvas state from before drawing the car.
}

// ============================================================
// RENDER
// ============================================================

function render() { // Draws one complete frame of the game.
    const width = // Gets the browser's current width.
        window.innerWidth;

    const height = // Gets the browser's current height.
        window.innerHeight;

    const halfWidth = // Calculates half the screen width.
        width / 2;

    const halfHeight = // Calculates half the screen height.
        height / 2;

    const viewLeft = // Calculates the left edge of the visible world.
        camera.x -
        halfWidth -
        100; // Adds extra space for objects near the screen edge.

    const viewRight = // Calculates the right edge of the visible world.
        camera.x +
        halfWidth +
        100; // Adds extra space for objects near the screen edge.

    const viewTop = // Calculates the top edge of the visible world.
        camera.y -
        halfHeight -
        100; // Adds extra space above the screen.

    const viewBottom = // Calculates the bottom edge of the visible world.
        camera.y +
        halfHeight +
        100; // Adds extra space below the screen.

    ctx.setTransform( // Resets the canvas transform before drawing the frame.
        DPR, // Horizontal scaling for device pixels.
        0, // Horizontal skew.
        0, // Vertical skew.
        DPR, // Vertical scaling for device pixels.
        0, // Horizontal translation.
        0 // Vertical translation.
    );

    ctx.fillStyle = // Sets the background color.
        "#050711"; // Uses a very dark blue-black.

    ctx.fillRect( // Clears/fills the entire visible canvas.
        0, // Starts at the left.
        0, // Starts at the top.
        width, // Fills the full width.
        height // Fills the full height.
    );

    let shakeX = 0; // Stores horizontal camera shake for this frame.
    let shakeY = 0; // Stores vertical camera shake for this frame.

    if ( // Checks whether camera shake is currently active.
        camera.shake > 0
    ) {
        const amount = // Calculates how much random movement the shake can produce.
            camera.shake * 7; // Converts shake strength into screen movement.

        shakeX = // Generates a random horizontal shake offset.
            random( // Uses the random helper.
                -amount, // Minimum shake offset.
                amount // Maximum shake offset.
            );

        shakeY = // Generates a random vertical shake offset.
            random( // Uses the random helper.
                -amount, // Minimum shake offset.
                amount // Maximum shake offset.
            );
    }

    ctx.save(); // Saves the canvas state before moving into world coordinates.

    ctx.translate( // Moves the world so the camera position appears in the center of the screen.
        width / 2 - // Starts at the horizontal center of the screen.
        camera.x + // Subtracts the camera's world X position.
        shakeX, // Adds the current camera shake.

        height / 2 - // Starts at the vertical center of the screen.
        camera.y + // Subtracts the camera's world Y position.
        shakeY // Adds the current camera shake.
    );

    drawGrid( // Draws the visible background grid.
        viewLeft, // Visible left world boundary.
        viewRight, // Visible right world boundary.
        viewTop, // Visible top world boundary.
        viewBottom // Visible bottom world boundary.
    );

    drawTrack(); // Draws the cached road and finish line.

    drawParticles( // Draws particles that are inside the camera's visible area.
        viewLeft, // Visible left boundary.
        viewRight, // Visible right boundary.
        viewTop, // Visible top boundary.
        viewBottom // Visible bottom boundary.
    );

    drawCar(); // Draws the player's car on top of the track and particles.

    ctx.restore(); // Restores the canvas state after rendering the world.
}

// ============================================================
// ADAPTIVE PERFORMANCE
// ============================================================

let fpsTimer = 0; // Tracks how much time has passed while measuring FPS.
let fpsFrames = 0; // Counts how many frames were rendered during the measurement period.

function updatePerformance( // Dynamically adjusts particle quality based on measured FPS.
    dt // Receives the time since the previous rendered frame.
) {
    fpsTimer += dt; // Adds the frame's elapsed time to the FPS measurement timer.
    fpsFrames++; // Counts this frame.

    if ( // Checks whether enough time has passed to calculate a new FPS value.
        fpsTimer < 0.75
    ) {
        return; // Waits until at least 0.75 seconds have been measured.
    }

    const fps = // Calculates the average frames per second.
        fpsFrames /
        fpsTimer;

    if ( // Checks whether performance is very low.
        fps < 38
    ) {
        particleQuality = // Reduces particles heavily.
            0.20;
    } else if ( // Checks whether performance is somewhat low.
        fps < 48
    ) {
        particleQuality = // Uses moderate particle reduction.
            0.45;
    } else if ( // Checks whether performance is slightly below the target.
        fps < 57
    ) {
        particleQuality = // Uses a smaller particle reduction.
            0.70;
    } else {
        particleQuality = // Restores full particle quality when performance is good.
            1;
    }

    fpsTimer = 0; // Resets the FPS measurement timer.
    fpsFrames = 0; // Resets the FPS frame counter.
}

// ============================================================
// FIXED PHYSICS
// ============================================================

const FIXED_DT = // Sets the physics timestep to a fixed 60Hz interval.
    1 / 60;

let previousTime = // Stores the timestamp of the previous animation frame.
    performance.now();

let accumulator = 0; // Stores time that still needs to be processed by fixed physics.

function gameLoop(now) { // Runs the game's main update-and-render loop.
    let frameTime = // Calculates how much real time passed since the previous frame.
        (
            now -
            previousTime
        ) / 1000; // Converts milliseconds into seconds.

    previousTime = now; // Saves this frame's timestamp for the next frame.

    frameTime = // Prevents extremely large time jumps from breaking the physics.
        Math.min(
            frameTime, // Current frame time.
            0.05 // Maximum amount of time one rendered frame can contribute.
        );

    if ( // Only updates gameplay when the race is actually running.
        gameStarted
    ) {
        accumulator += // Adds real elapsed time to the physics accumulator.
            frameTime;

        let steps = 0; // Counts how many physics updates have been performed this frame.

        while ( // Runs fixed physics updates until enough accumulated time has been processed.
            accumulator >= // Checks whether there is at least one physics timestep available.
            FIXED_DT &&
            steps < 3 // Prevents too many physics updates during a lag spike.
        ) {
            updatePlayer( // Updates the car physics and race logic.
                FIXED_DT // Always uses the same fixed timestep.
            );

            updateParticles( // Updates particle positions and lifetimes.
                FIXED_DT // Uses the same fixed timestep for particles.
            );

            updateCamera( // Updates the camera.
                FIXED_DT // Uses the fixed timestep for camera movement.
            );

            updateMessage( // Updates temporary UI messages.
                FIXED_DT // Uses the fixed timestep.
            );

            accumulator -= // Removes the physics time that was just simulated.
                FIXED_DT;

            steps++; // Counts this physics update.
        }

        if ( // Checks whether the loop hit the maximum allowed physics steps.
            steps >= 3
        ) {
            accumulator = 0; // Drops excess accumulated time to prevent a lag spiral.
        }
    }

    updateHUD(); // Refreshes the score, lap, speed, and boost UI.

    render(); // Draws the current game frame.

    updatePerformance( // Measures FPS and adjusts particle quality if needed.
        frameTime // Uses the actual rendered frame time.
    );

    requestAnimationFrame( // Asks the browser to call the game loop on the next animation frame.
        gameLoop // Passes the game loop function back to the browser.
    );
}

// ============================================================
// INITIAL UI
// ============================================================

if ( // Checks whether the finish screen exists.
    finishScreen
) {
    finishScreen.classList.add( // Makes sure the finish screen starts hidden.
        "hidden" // CSS class that hides the finish screen.
    );
}

if ( // Checks whether the start screen exists.
    startScreen
) {
    startScreen.style.display = // Makes the main menu visible when the page first loads.
        "flex";
}

updateHUD(); // Fills the HUD with its initial values before the race starts.

// ============================================================
// START LOOP
// ============================================================

requestAnimationFrame( // Starts the browser's animation loop.
    gameLoop // Gives the browser the function that should run every frame.
);