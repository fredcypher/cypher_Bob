window.getTargetValue = function(targetPiece, actorPiece, isInvasionActive) {
    let baseValue = VALUE_MATRIX[targetPiece.type] || 0;
    
    if (isInvasionActive && 
        FAMILIES.MajorFieldPieces.includes(actorPiece.type) && 
        FAMILIES.MajorFieldPieces.includes(targetPiece.type)) {
        return baseValue * 2; 
    }
    return baseValue;
};

// --- LOCAL AREA: TOP OF AI_MODULE_2.JS ---
const VALUE_MATRIX = {
    'King': 1000,
    'Queen': 90,
    'Rook': 50,
    'Bishop': 30,
    'Knight': 30,
    'Spy': 10, // 🕵️ UPGRADED VALUE: Tells Bob this unit is a high-priority asset
    'Pawn': 10
};

const FAMILIES = {
    MajorCourtPieces:  ["Queen", "Bishop", "Knight", "Rook"], 
    MajorBorderPieces: ["Queen", "Bishop", "Knight", "Rook"], 
    MajorFieldPieces:  ["Queen", "Bishop", "Knight", "Rook"],
    SpecialPieces:     ["Spy", "King"],
    // Bob now looks for these identities
    Pawns:             ["Fp", "Bp", "Ffp", "Fffp"]
};

// --- GEOGRAPHY HELPERS ---
function getSector(coord) {
    const cell = window.CypherManager.boardIndex[coord];
    if (!cell) return null;
    
    const tag = cell.sectorTag; // This is "F", "B", or "C" from your engine

    // TRANSLATION LAYER: Map engine tags to JSON keys
    const tagMap = {
        'C': 'Court',
        'B': 'Border',
        'F': 'Field'
    };

    return tagMap[tag] || tag; 
}

const getPieceIdentity = (piece, coord) => {
    const cell = window.CypherManager.boardIndex[coord];
    const sectorTag = cell ? cell.sectorTag : 'F'; // 'C', 'B', or 'F'
    
    if (piece.type !== 'Pawn') {
        const typeMap = { 'King':'k', 'Queen':'q', 'Rook':'r', 'Bishop':'b', 'Knight':'n', 'Spy':'s' };
        const shortType = typeMap[piece.type] || piece.type.charAt(0).toLowerCase();
        return `${sectorTag}${shortType}:${coord}`;
    }
    
    // 🐾 FINALIZED DIRECTIONAL PAWN MATRIX
    const row = parseInt(coord.substring(1));
    let rankSuffix = 'Fp'; 
    
    if (sectorTag === 'B') {
        rankSuffix = 'Bp';
    } else if (sectorTag === 'C') {
        rankSuffix = 'Cp';
    } else {
        // 1. Extreme Deep Edge Promotion Zones
        if (row === 9 || row === 1) {
            rankSuffix = 'Fffp';
        } 
        // 2. White Pawns (Moving Up)
        else if (piece.color === 'white') {
            // Mapped in JSON: Rows 3, 4, 6 are standard FpW | Rows 7, 8 are FfpW
            if (row === 7 || row === 8) rankSuffix = 'Ffp';
            else rankSuffix = 'Fp';
        } 
        // 3. Black Pawns (Moving Down)
        else {
            // Mapped in JSON: Rows 4, 6, 7 are standard FpB | Rows 2, 3 are FfpB
            if (row === 2 || row === 3) rankSuffix = 'Ffp';
            else rankSuffix = 'Fp';
        }
    }
    
    const colorTag = (piece.color === 'white') ? 'W' : 'B';
    return `${rankSuffix}${colorTag}:${coord}`;
};

function getBoilerplate(piece, coord) {
    const cell = window.CypherManager.boardIndex[coord];
    if (!cell) return [];

    const manager = window.CypherManager;
    let sectorName = 'Field';

    // 🚪 THE CE GATEWAY LOCK: If a Court Entry substate is structurally active,
    // we force Bob to look up his piece options via the Court blueprint matrices
    if (manager.state.status === 'CE' || manager.state.mode === 'CourtEntry') {
        sectorName = 'Court';
    } else {
        const sectorMap = { 'C': 'Court', 'B': 'Border', 'F': 'Field' };
        sectorName = sectorMap[cell.sectorTag] || 'Field';
    }

    // 🪣 RE-ANCHOR THE BUCKET: This line is required to read your global matrix data!
    const sectorBucket = window.cypherMoves?.[sectorName];
    if (!sectorBucket) {
        console.warn(`⚠️ Bob's brain is missing local cypherMoves sector data for: ${sectorName}`);
        return [];
    }

    // 1. Fetch Bob's custom blueprint identity key string (e.g. "FfpB:a7" or "Fb:c8")
    let lookupKey = getPieceIdentity(piece, coord);
    let moveData = sectorBucket[lookupKey];

    if (!moveData) {
        // Fallback 1: Try case-insensitive matching
        const actualKey = Object.keys(sectorBucket).find(k => k.toLowerCase() === lookupKey.toLowerCase());
        if (actualKey) {
            moveData = sectorBucket[actualKey];
        } else if (piece.type === 'Pawn') {
            // Fallback 2: Deep rank recovery logic (e.g., if FffpB fails on edge ranks, match standard FpB)
            const colorTag = (piece.color === 'white') ? 'W' : 'B';
            const emergencyKey = `Fp${colorTag}:${coord}`;
            const finalTryKey = Object.keys(sectorBucket).find(k => k.toLowerCase() === emergencyKey.toLowerCase());
            if (finalTryKey) moveData = sectorBucket[finalTryKey];
        }
    }
    
    // 2. Combine the physical targets cleanly regardless of structural data layout
    let totalPhysicalTargets = [];
    if (moveData) {
        if (Array.isArray(moveData)) {
            // Flat configuration style (used by all Major/Minor pieces: King, Queen, etc.)
            totalPhysicalTargets.push(...moveData);
        } else {
            // Nested object configuration style (used explicitly by Pawns)
            if (Array.isArray(moveData.m)) totalPhysicalTargets.push(...moveData.m);
            if (Array.isArray(moveData.c)) totalPhysicalTargets.push(...moveData.c);
        }
    }

    // 🕵️ EXTRACTION DIAGNOSTIC LOG
    if (totalPhysicalTargets.length > 0) {
        console.log(`🐾 BOB TRACKING: Found ${totalPhysicalTargets.length} physical vector paths for [${lookupKey}] via cypherMoves.`);
    }

    return totalPhysicalTargets;
}
// 💡 The file's original 'const CapturePermissions = {' block immediately continues right below here!

// --- CAPTURE AXIOMS (Synced with terminology) ---
// --- 3. CAPTURE AXIOMS (Synced with terminology) ---
const CapturePermissions = {
    MajorCourtPieces: (target) => true, 
    MajorBorderPieces: (target) => getSector(target.coord) !== "Court",
    MajorFieldPieces: (target) => getPieceIdentity(target, target.coord) === "Fp",
    
    // Axiom E logic
    FieldSpy: (target) => getSector(target.coord) === "Court",
    FieldKing: (target) => getSector(target.coord) === "Court",
    
    // Terminology-based Pawn Axioms matching MasterRules layout exactly
    "Fp": (target) => true,
    "Ffp": (target) => true,
    "Fffp": (target) => target.type === "King",
    "Bp": (target) => ["Queen", "Bishop", "Knight", "Rook", "Pawn", "King"].includes(target.type)
};

let isFieldInvasionActive = false;

function isThisAFieldInvasion(actor, start, end, target) {
    if (!target) return false;
    if (actor.color !== 'white') return false;

    const startSector = getSector(start);
    const targetId = getPieceIdentity(target, end);

    // Invasion: White moves from Court/Border and takes a Black Major Field piece
    const isWhiteInvader = (startSector === 'Court' || startSector === 'Border');
    const isBlackMajorField = FAMILIES.MajorFieldPieces.includes(targetId);

    return isWhiteInvader && isBlackMajorField;
}

function checkCapturePermission(actor, actorCoord, target, targetCoord, isInvasionActive) {
    // 1. Resolve short tokens for sector-specific identification (e.g., "Fq", "Fr")
    const actorToken = getPieceIdentity(actor, actorCoord).split(':')[0]; 
    const targetToken = getPieceIdentity(target, targetCoord).split(':')[0];

    // Identify if both assets are fundamentally Major Field occupants
    const isAttackerMajorField = ["Fq", "Fr", "Fb", "Fn"].includes(actorToken);
    const isTargetMajorField = ["Fq", "Fr", "Fb", "Fn"].includes(targetToken);

    // 🛑 THE STRUCTURAL PERMISSION GATE
    if (isAttackerMajorField && isTargetMajorField) {
        // If Field Invasion is NOT active, Field-to-Field major combat is strictly illegal!
        if (!isInvasionActive) {
            console.warn(`🛑 BARS ACCESS: Field-to-Field combat blocked between ${actorToken} and ${targetToken}.`);
            return false; 
        }
    }

    // 2. Field Invasion Recompense (Using explicit string types matching FAMILIES array)
    if (isInvasionActive && FAMILIES.MajorFieldPieces.includes(actor.type)) {
        if (FAMILIES.MajorFieldPieces.includes(target.type)) return true;
    }

    // 3. Direct Axiom Lookup via short token (e.g., "Fffp")
    if (CapturePermissions[actorToken]) {
        const targetObj = { ...target, coord: targetCoord };
        return CapturePermissions[actorToken](targetObj, actorCoord);
    }

    // 4. Fallback to Native Family Checks (Using standard piece type strings)
    if (FAMILIES.MajorCourtPieces.includes(actor.type)) return CapturePermissions.MajorCourtPieces(target);
    if (FAMILIES.MajorBorderPieces.includes(actor.type)) return CapturePermissions.MajorBorderPieces(target);
    
    // Default fallback if no rules restrict the interaction
    return true; 
}

let recompenseWindowActive = false;

function updateInvasionState(lastMove) {
    const counters = window.CypherManager.state.counters;

    // Check if the move that just happened was an invasion
    if (lastMove && lastMove.isFieldInvasion) {
        // Set the counter to 1 (Bob has one turn to respond)
        counters.invasion = 1; 
        console.log("%c ⚠️ PROTOCOL: Field Invasion Detected. Recompense Window: OPEN.", "color: yellow; background: black; font-weight: bold;");
    } else {
        // If the window was open but not used, or if it was a normal move, decrement
        if (counters.invasion > 0) {
            counters.invasion--;
            if (counters.invasion === 0) {
                console.log("🛡️ PROTOCOL: Recompense Window: CLOSED.");
            }
        }
    }
}

// This function runs every time White makes a move
async function rankAllMoves() {
    const manager = window.CypherManager;
    const liveBoard = manager.boardIndex;
    const isInvasionActive = manager.state.counters.invasion > 0;
    let movePool = [];

    // --- STAGE 1: THE OPEN PATH SCAN ---
    for (let [coord, cell] of Object.entries(liveBoard)) {
        // Strict Validation: Ensure cell exists, piece exists, and it's Black
        if (!cell || !cell.piece || cell.piece.color !== 'black') continue;
        
        const piece = cell.piece;

        // --- STAGE 2: COMPILE LOOK-UPS (JSON Filtering) ---
        // Passed cleanly now that we know 'piece' is a physical unit on 'coord'
        const boilerplate = getBoilerplate(piece, coord);

        // PAWN DIAGNOSTIC: Check if the AI even sees moves for this pawn
        if (piece.type === 'Pawn' && boilerplate.length === 0) {
            console.warn(`🕵️ AI BLINDSPOT: Pawn at ${coord} has 0 moves in JSON. Check getBoilerplate key!`);
        }

        boilerplate.forEach(targetSquare => {
            const targetCell = liveBoard[targetSquare];
            const targetPiece = targetCell ? targetCell.piece : null;

            // Step-by-step logic check for Pawns
            if (piece.type === 'Pawn') {
                const pathClear = manager.isPathClear(coord, targetSquare);
                const protoAllowed = targetPiece ? 
                    checkCapturePermission(piece, coord, targetPiece, targetSquare, isInvasionActive) : true;
                
                console.log(`🐾 PAWN EVAL [${coord}->${targetSquare}]: PathClear: ${pathClear} | Protocol: ${protoAllowed}`);
            }
            
            // PRE-CHECK: Collision & Friendly Fire
            if (!manager.isPathClear(coord, targetSquare)) return;
            if (targetPiece && targetPiece.color === 'black') return;

            // --- STAGE 3: MATCH WITH PROTOCOL AXIOMS ---
            if (targetPiece && !checkCapturePermission(piece, coord, targetPiece, targetSquare, isInvasionActive)) {
                return;
            }

            // --- STAGE 4: CALCULATE PRIORITY ---
            let weight = calculateMoveWeight(piece, coord, targetSquare);

            // THE KING-VALUE CHECK: 
            if (predictCheck(coord, targetSquare)) {
                weight += 500; 
                console.log(`👑 SIGNAL: Move ${coord}->${targetSquare} generates a Check.`);
            }

            // --- PAWN LOGIC GATE ---
            if (piece.type === 'Pawn' && targetPiece) {
                weight += 350;
                console.log(`🐾 PAW-PRESSURE: Bob is eyeing a capture at ${targetSquare}`);
            }
            
            movePool.push({
                from: coord,
                to: targetSquare,
                weight: weight,
                isCapture: !!targetPiece,
                piece: piece 
            });
        }); 
    } 
    return movePool.sort((a, b) => b.weight - a.weight);
}

function evaluateSafetyRatio(move, board) {
    const manager = window.CypherManager;
    
    if (manager.isSquareThreatened(move.to, 'white')) {
        const pieceValue = VALUE_MATRIX[move.piece.type] || 10;
        const threatValue = manager.getLowestThreateningValue(move.to, 'white');
        
        // LEVEL 1 ADJUSTMENT: Linear penalty instead of Exponential
        // This prevents Bob from being paralyzed by "scary" threats.
        if (threatValue > 0) {
            let penalty = (pieceValue - threatValue) * 10;
            
            // Cap the penalty so it never outweighs a major capture or King move
            return Math.max(0, Math.min(penalty, 400));
        }
    }
    return 0;
}

function predictCheck(from, to) {
    // Bob asks the Engine to imagine the piece at the target square
    return window.CypherManager.scanCourtLineForKing(to, 'white');
}
function calculateMoveWeight(actor, actorCoord, targetSquare) {
    let score = 0;
    const manager = window.CypherManager;
    const targetCell = manager.boardIndex[targetSquare];
    const targetPiece = targetCell ? targetCell.piece : null;
    const identity = getPieceIdentity(actor, actorCoord); 

    // ----------------------------------------------------
    // 1. HARD COORDINATE ANTI-SHUFFLE LOCK
    // ----------------------------------------------------
    const globalHistory = manager.state.counters.moveHistory || [];
    if (globalHistory.length >= 2) {
        const lastMove = globalHistory[globalHistory.length - 2]; 
        if (actor.type !== 'Spy' && lastMove && lastMove.pieceType === actor.type && lastMove.from === targetSquare) {
            score -= 300; 
        }
    }

    // ----------------------------------------------------
    // 2. MATERIAL CAPTURE INCENTIVE
    // ----------------------------------------------------
    if (targetPiece) {
        const isInvasion = manager.state.counters.invasion > 0;
        const targetVal = window.getTargetValue(targetPiece, actor, isInvasion);
        score += (targetVal * 50); 

        if (actor.type === 'Pawn') {
            score += 500; 
        }
    }

    // ----------------------------------------------------
    // 3. CYPHER CHESS FLIP MECHANICS
    // ----------------------------------------------------
    if (targetPiece) {
        const targetSector = getSector(targetSquare);
        const isCourtFlip = (targetSector === 'Court' && actor.type === 'Spy' && targetPiece.type === 'King');
        const isBorderFlip = (targetSector === 'Border' && actor.type === 'King' && targetPiece.type === 'Spy');

        if (isCourtFlip || isBorderFlip) {
            score += 2000; 
        }
    }

    // ----------------------------------------------------
    // 4. GEOGRAPHIC GEOMETRIC MINIMAX SYSTEM
    // ----------------------------------------------------
    const targetSector = getSector(targetSquare);
    const targetFile = targetSquare.charAt(0).toLowerCase();
    const targetRow = parseInt(targetSquare.substring(1), 10);

    // Rule B1: 100 points for Border and Court squares
    if (targetSector === 'Border' || targetSector === 'Court') {
        score += 100;
    }

    // Rule B2 & B3: Pawn Runway Computations (Black pushes downwards from their side to Row 3)
    if (actor.type === 'Pawn') {
        const actorFile = actorCoord.charAt(0).toLowerCase();
        const actorRow = parseInt(actorCoord.substring(1), 10);

        // If this specific pawn is moving forward down its own file towards row 3
        if (targetFile === actorFile && targetRow < actorRow && targetRow >= 3) {
            const centralFiles = ['c', 'd', 'e', 'f'];
            const flankFiles = ['a', 'b', 'g', 'h'];

            if (centralFiles.includes(targetFile)) {
                score += 300; // High incentive to march central runways
            } else if (flankFiles.includes(targetFile)) {
                score += 80;  // Solid incentive to march flank runways
            }
        }
    }

    // Secondary runway layer: Other pieces supporting open avenues ahead of extant pawns
    for (let [coord, cell] of Object.entries(manager.boardIndex)) {
        if (cell && cell.piece && cell.piece.type === 'Pawn' && cell.piece.color === 'black') {
            const pawnFile = coord.charAt(0).toLowerCase();
            const pawnRow = parseInt(coord.substring(1), 10);

            if (targetFile === pawnFile && targetRow < pawnRow && targetRow >= 3) {
                if (['c', 'd', 'e', 'f'].includes(targetFile)) {
                    score += 100;
                } else {
                    score += 20;
                }
            }
        }
    }

    // Rule B4: 250 points for Border/Court square with open path to White King
    if (targetSector === 'Border' || targetSector === 'Court') {
        const whiteKingCoord = manager.state.whiteKingCoord || Object.keys(manager.boardIndex).find(coord => {
            const p = manager.boardIndex[coord]?.piece;
            return p && p.type === 'King' && p.color === 'white';
        });

        if (whiteKingCoord) {
            if (typeof manager.isPathClear === 'function' && manager.isPathClear(targetSquare, whiteKingCoord)) {
                score += 250;
            }
        }
    }

// ====================================================
    // STABILIZED KING COURT BANISHMENT & SURVIVAL SYSTEM
    // ====================================================
    if (actor.type === 'King') {
        const globalCheck = (typeof manager.isKingInCheck === 'function') 
            ? manager.isKingInCheck('black') 
            : false;

        const isTargetThreatened = (typeof manager.isSquareThreatened === 'function') 
            ? manager.isSquareThreatened(targetSquare, 'white') 
            : false;

        if (!isTargetThreatened) {
            let escapeBonus = 0;

            if (globalCheck) {
                escapeBonus += 800; // Force immediate flight from verified check
            } else {
                escapeBonus += 10;  // Standard passive positional weight
            }

            // 🚫 COURT BANISHMENT LOCK: Prevent King from wandering into the Flip-Zone
            if (targetSector === 'Court') {
                escapeBonus -= 900; // Drowns out the check escape bonus and Rule B1 completely!
            }

            score += escapeBonus;
        }
    }

    // ----------------------------------------------------
    // 5. THE EMBEDDED THREAT (Fffp)
    // ----------------------------------------------------
    if (identity && identity.includes('Fffp')) {
        if (predictCheck(actorCoord, actorCoord)) {
            score += 1000;
        }
    }

    return score;
}

async function playBobMove() {
    const manager = window.CypherManager;
    
    const isEngineTerminated = manager.state.isGameOver || manager.state.gameOver || manager.state.status === 'checkmate';
    if (isEngineTerminated) return;

    if (!manager.state.cypherRegistry) {
        manager.state.cypherRegistry = [];
    }

    const initialMR = manager.state.counters.moveRecord;
    const movePool = await rankAllMoves();

    if (!movePool || movePool.length === 0) {
        console.log("💤 Bob analyzed the board but found 0 valid targets.");
        return;
    }

    // ====================================================
    // REFINED BORDER VANGUARD & MARCH INTERCEPTOR
    // ====================================================
    if (movePool.length > 0) {
        movePool.forEach(mv => {
            // 🚨 CRITICAL SURVIVAL FILTER: Protect major pieces (like the Queen) from ignoring threats
            if (mv.piece.type === 'Queen' || mv.piece.type === 'King') {
                return; // Do not warp Queen/King weights with abstract geographic padding
            }

            const row = parseInt(mv.to.substring(1), 10);
            
            if (mv.piece.type === 'Pawn') {
                // Pawns should never park on the Border! Reward them for breaching down towards Row 3
                if (row <= 5 && row >= 3) {
                    mv.weight += 600; // Push motivation past the equator track
                }
            } else {
                // Non-pawn field assets still orient around anchoring near the Equator
                const dist = Math.abs(row - 5);
                if (dist === 0) {
                    mv.weight += 400; 
                }
            }
        });

        // Re-sort pool with clean structural weights applied
        movePool.sort((a, b) => b.weight - a.weight);
    }

    // ====================================================
    // LIVE MOVE POOL VERIFICATION ENGINE LOOP
    // ====================================================
    let executedSuccessfully = false;

    for (const move of movePool) {
        if (!move.from || !move.to) continue;
        
        const startCell = manager.boardIndex[move.from];
        const targetCell = manager.boardIndex[move.to];
        if (!startCell || !startCell.piece || !targetCell) continue;

        await executeBobMove(move);
        await new Promise(r => setTimeout(r, 150));

        if (manager.state.counters.moveRecord > initialMR) {
            console.log(`🚀 VANGUARD SUCCESS: Engine validated ${move.piece.type}: ${move.from} -> ${move.to} (Priority: ${move.weight})`);

            const turnNum = String(manager.state.counters.moveRecord).padStart(3, '0');
            const colorPrefix = move.piece.color === 'white' ? 'W' : 'B';

            const sourceIdentity = getPieceIdentity(move.piece, move.from);
            const normalizedPieceToken = sourceIdentity.split(':')[0]; 

            const registryEntry = `${colorPrefix}${turnNum} ${normalizedPieceToken} ${move.from}->${move.to}`;
            manager.state.cypherRegistry.push(registryEntry);
            
            console.log(`📜 REGISTRY ANCHOR SECURED: [${registryEntry}]`);

            manager.state.selectedPiece = null;
            executedSuccessfully = true;
            return; 
        }
        
        console.warn(`⚠️ Engine rejected candidate ${move.from}->${move.to} via internal counters. Advancing...`);
    }

    if (!executedSuccessfully) {
        console.log("%c 🚨 VALIDATION EXHAUSTION CIRCUIT TRIPPED. FORCING MATCH TERMINATION.", "color: white; background: #800000; font-weight: bold;");
        
        const turnNum = String((manager.state.counters.moveRecord || 0) + 1).padStart(3, '0');
        const terminalEntry = `B${turnNum} # CM_W`;
        
        if (manager.state.cypherRegistry) {
            manager.state.cypherRegistry.push(terminalEntry);
        }

        manager.state.isGameOver = true;
        manager.state.status = 'checkmate';
        
        declareCheckmateWindow("White");
    }
}

function declareCheckmateWindow(winnerColor) {
    if (document.getElementById("cypher-mate-overlay")) return;

    // 1. Create pure pitch-black blurred background overlay
    const overlay = document.createElement("div");
    overlay.id = "cypher-mate-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(5, 5, 5, 0.92)"; // Darker, heavy terminal shade
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "99999";
    overlay.style.backdropFilter = "blur(8px)";

    // 2. Build the stark cryptographic terminal announcement card
    const modal = document.createElement("div");
    modal.style.backgroundColor = "#0a0a0c"; // Deep tactical carbon background
    modal.style.color = "#39ff14"; // Classic high-monochrome CRT Phosphor Green
    modal.style.padding = "40px 50px";
    modal.style.borderRadius = "0px"; // Sharper, rugged non-rounded command-line edges
    modal.style.border = "1px solid #39ff14"; // Green phosphor accent wireline
    modal.style.boxShadow = "0px 0px 25px rgba(57, 255, 20, 0.15)";
    modal.style.textAlign = "center";
    
    // Explicitly fallback to generic monospace if 'PT Mono' isn't cached locally
    modal.style.fontFamily = "'PT Mono', 'Courier New', Courier, monospace";

    modal.innerHTML = `
        <h1 style="color: #39ff14; margin-top: 0; font-size: 2.0rem; letter-spacing: 4px; font-weight: bold; border-bottom: 1px dashed #39ff14; padding-bottom: 15px;">
            [!] CYPHER CHECKMATE
        </h1>
        <p style="font-size: 1.0rem; margin: 25px 0 15px 0; color: #88c888; letter-spacing: 2px;">
            THE OPPOSING KING MATRIX HAS BEEN TERMINATED
        </p>
        <p style="font-size: 1.4rem; font-weight: bold; color: #39ff14; letter-spacing: 2px; margin-bottom: 35px;">
            STATUS: ${winnerColor.toUpperCase()} VICTORIOUS
        </p>
        <button id="close-mate-btn" style="padding: 10px 24px; background-color: transparent; color: #39ff14; border: 1px solid #39ff14; border-radius: 0px; font-family: inherit; font-weight: bold; cursor: pointer; font-size: 0.9rem; letter-spacing: 2px; transition: background 0.2s;">
            > DISMISS_AND_REVIEW
        </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Subtle interactive terminal glow effect on button hover
    const btn = document.getElementById("close-mate-btn");
    btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "rgba(57, 255, 20, 0.15)";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = "transparent";
    });

    // Dismiss overlay to let players inspect final coordinates
    btn.addEventListener("click", () => {
        overlay.remove();
    });
}

function executeBobMove(move) {
    return new Promise((resolve) => {
        const startTile = document.getElementById(move.from);
        const targetTile = document.getElementById(move.to);

        if (startTile && targetTile) {
            startTile.click();
            
            setTimeout(() => {
                targetTile.click();
                
                // Handle Court Entry (Phase 2)
                if (move.isCE && move.secondaryFrom) {
                    setTimeout(() => {
                        const mStart = document.getElementById(move.secondaryFrom);
                        const mEnd = document.getElementById(move.secondaryTo);
                        if (mStart && mEnd) {
                            mStart.click();
                            setTimeout(() => {
                                mEnd.click();
                                resolve();
                            }, 200);
                        } else { resolve(); }
                    }, 800);
                } else {
                    resolve();
                }
            }, 400);
        } else {
            resolve();
        }
    });
}

console.log("✅ Bob's brain (AI_Module_2) and Map are successfully linked!");