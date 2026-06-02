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

    // 🕵️ EXTRACTION DIAGNOSTIC LOG (Silenced cleanly without breaking the return)
    // if (totalPhysicalTargets.length > 0) {
    //     console.log(`🐾 BOB TRACKING: Found ${totalPhysicalTargets.length} physical vector paths for [${lookupKey}] via cypherMoves.`);
    // }

    return totalPhysicalTargets;
}
// 💡 The file's original 'const CapturePermissions = {' block immediately continues right below here!



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

// =============================================================================
// 🧠 TWO-STAGE DEPLOYMENT ENGINE (With Stage-1 Stagnation Relief Valve)
// =============================================================================
function applyTacticalMandates(movePool, liveBoard, isInvasionActive) {
    const manager = window.CypherManager;
    if (!manager) return movePool;

    const globalHistory = manager.state.counters?.moveHistory || [];
    const lastWhiteMove = globalHistory.length > 0 ? globalHistory[globalHistory.length - 1] : null;

    // =====================================================================
    // 📊 STAGE DETERMINATION & STAGNATION RADAR
    // =====================================================================
    let pawnsPastBorder = 0;
    for (const coord in liveBoard) {
        const cell = liveBoard[coord];
        if (cell && cell.piece && cell.piece.color === 'black' && cell.piece.type === 'Pawn') {
            const row = parseInt(coord.substring(1), 10);
            if (row < 5) pawnsPastBorder++;
        }
    }
    
    // Core Stage Rule
    let currentStage = pawnsPastBorder >= 2 ? 2 : 1;

    // STAGNATION RADAR: Check if Bob has ANY legal pawn moves left in the active pool
    const hasLegalPawnMoves = movePool.some(move => move.piece && move.piece.type === 'Pawn');
    
    if (currentStage === 1 && !hasLegalPawnMoves) {
        console.log("⚠️ STAGNATION RELIEF VALVE ACTIVATED: Bob has 0 legal pawn moves. Relaxing back-row restrictions early!");
    } else {
        console.log(`📡 AI DEPLOYMENT RADAR: Pawns Past Border: ${pawnsPastBorder} | Active Phase: STAGE ${currentStage}`);
    }

    // Locate the real White King
    let realKingCoord = null;
    for (const coord in liveBoard) {
        if (liveBoard[coord]?.piece?.type === 'King' && liveBoard[coord]?.piece?.color === 'white') {
            realKingCoord = coord;
            break;
        }
    }

    // --- HELPER: Simulated Pawn Threat Scanner ---
    function isExposedToPawnInSimulation(simulatedBoard, targetCoord) {
        const COLUMNS = ['z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
        const tFile = targetCoord.charAt(0).toLowerCase();
        const tFileIdx = COLUMNS.indexOf(tFile);
        const tRow = parseInt(targetCoord.substring(1), 10);

        const threatRow = tRow - 1;
        if (threatRow < 0 || threatRow > 10) return false;

        const leftThreatSquare = `${COLUMNS[tFileIdx - 1]}${threatRow}`;
        const rightThreatSquare = `${COLUMNS[tFileIdx + 1]}${threatRow}`;

        const checkSquares = [leftThreatSquare, rightThreatSquare];
        for (const scratchSquare of checkSquares) {
            const cell = simulatedBoard[scratchSquare];
            if (cell && cell.piece && cell.piece.type === 'Pawn' && cell.piece.color === 'white') {
                return true; 
            }
        }
        return false;
    }

    return movePool.map(move => {
        let dynamicWeight = move.weight;
        const actorType = move.piece.type;
        const targetCell = liveBoard[move.to];
        const targetPiece = targetCell ? targetCell.piece : null;

        // =====================================================================
        // 🔮 GENERATE SIMULATED FUTURE MATRIX STATE
        // =====================================================================
        const simulatedBoard = JSON.parse(JSON.stringify(liveBoard));
        if (simulatedBoard[move.from]) {
            simulatedBoard[move.to].piece = simulatedBoard[move.from].piece;
            simulatedBoard[move.from].piece = null;
        }

        // =====================================================================
        // 🛑 UNIVERSAL MANDATE 1: ANTI-SUICIDE (Simulation Verified)
        // =====================================================================
        if (["Queen", "Rook", "Bishop", "Knight", "Spy"].includes(actorType)) {
            const isDestinationSuicidal = manager.isSquareThreatened ? manager.isSquareThreatened(move.to, 'white') : false;
            
            if (isDestinationSuicidal) {
                const isDestinationDefended = manager.isSquareThreatened ? manager.isSquareThreatened(move.to, 'black') : false;
                
                if (!isDestinationDefended) {
                    return { ...move, weight: -5000.0 }; 
                } else {
                    if (actorType === 'Queen' || actorType === 'King') {
                        dynamicWeight -= 1500.0;
                    } else {
                        dynamicWeight -= 300.0; 
                    }
                }
            }
        }

        // =====================================================================
        // 🛑 UNIVERSAL MANDATE 2: THE SIMULATED PAWN SHIELD
        // =====================================================================
        if (["Queen", "Rook", "Bishop", "Knight"].includes(actorType)) {
            if (isExposedToPawnInSimulation(simulatedBoard, move.to)) {
                return { ...move, weight: -6000.0 }; 
            }
        }

        // =====================================================================
        // ⚔️ UNIVERSAL MANDATE 3: RECAPTURE ENFORCEMENT
        // =====================================================================
        if (lastWhiteMove && lastWhiteMove.isCapture && move.to === lastWhiteMove.to) {
            if (targetPiece) {
                dynamicWeight += (actorType === 'Pawn') ? 2500.0 : 2000.0;
            }
        }

        // =====================================================================
        // ♟️ PHASE-SHIFTING STRATEGIC BEHAVIORS
        // =====================================================================
        if (currentStage === 1) {
            // If pawns can move, enforce the lock. If they are paralyzed, release the valve!
            if (["Queen", "Rook", "Bishop", "Knight"].includes(actorType)) {
                if (hasLegalPawnMoves) {
                    dynamicWeight -= 1000.0; // Restrict major pieces while phalanx moves
                } else {
                    dynamicWeight += 100.0;  // Allow development if phalanx is stuck
                }
            } else if (actorType === 'Pawn') {
                const pRow = parseInt(move.to.substring(1), 10);
                dynamicWeight += (9 - pRow) * 200.0;

                if (realKingCoord) {
                    const pFile = move.to.charCodeAt(0);
                    const kFile = realKingCoord.charCodeAt(0);
                    const kRow = parseInt(realKingCoord.substring(1), 10);
                    const distToKing = Math.max(Math.abs(pFile - kFile), Math.abs(pRow - kRow));
                    
                    if (distToKing <= 4) {
                        dynamicWeight += (5 - distToKing) * 150.0;
                    }
                }
            }
        } else if (currentStage === 2) {
            if (["Queen", "Rook", "Bishop", "Knight"].includes(actorType)) {
                dynamicWeight += 300.0;
            }
        }

        return {
            ...move,
            weight: dynamicWeight
        };
    });
}

// This function runs every time White makes a move
async function rankAllMoves() {
    const manager = window.CypherManager;
    const liveBoard = manager.boardIndex;
    const isInvasionActive = manager.state.counters.invasion > 0;
    let movePool = [];

    // --- STAGE 1: THE OPEN PATH SCAN ---
    for (let [coord, cell] of Object.entries(liveBoard)) {
        if (!cell || !cell.piece || cell.piece.color !== 'black') continue;
        
        const piece = cell.piece;
        const boilerplate = getBoilerplate(piece, coord);

        if (piece.type === 'Pawn' && boilerplate.length === 0) {
            console.warn(`🕵️ AI BLINDSPOT: Pawn at ${coord} has 0 moves in JSON. Check getBoilerplate key!`);
        }

        boilerplate.forEach(targetSquare => {
            const targetCell = liveBoard[targetSquare];
            const targetPiece = targetCell ? targetCell.piece : null;
            
            // Pre-validation: Path Clear & Friendly Fire Check
            if (!manager.isPathClear(coord, targetSquare)) return;
            if (targetPiece && targetPiece.color === 'black') return;

            // --- STAGE 2: MATCH WITH PROTOCOL AXIOMS ---
            if (targetPiece && !checkCapturePermission(piece, coord, targetPiece, targetSquare, isInvasionActive)) {
                return;
            }

            // --- STAGE 3: CALCULATE CONVERGENCE PROFILE BASELINE ---
            let weight = calculateMoveWeight(piece, coord, targetSquare);
            
            movePool.push({
                from: coord,
                to: targetSquare,
                weight: weight,
                isCapture: !!targetPiece,
                piece: piece 
            });
        }); 
    } 

    // --- STAGE 4: TACTICAL INTERCEPT MATRIX ---
    // The pool is passed through the Virtual Check Field and Anti-Suicide vectors here
    const mandatedPool = applyTacticalMandates(movePool, liveBoard, isInvasionActive);

    // --- STAGE 5: RE-ORDER VIA REWRITTEN WEIGHT VALUES ---
    return mandatedPool.sort((a, b) => b.weight - a.weight);
}

function predictCheck(from, to) {
    // Bob asks the Engine to imagine the piece at the target square
    return window.CypherManager.scanCourtLineForKing(to, 'white');
}

// =========================================================================
// 🎯 LOCAL REPAIR DEPENDENCIES FOR THE DYNAMIC LOOKAHEAD ENGINE
// =========================================================================


// --- FEATURE 1 & 4: CONVERGENCE INDEX (CI) EVALUATOR (REPAIR) ---
function evaluateConvergenceProfile(boardState, perspectiveColor) {
    const oppColor = perspectiveColor === 'white' ? 'black' : 'white';
    const manager = window.CypherManager;
    const isFIActive = !!(manager?.state?.counters?.invasion > 0);

    let cumulativeScore = 0.0;
    let primaryBehavior = "Blk"; 

    // 🎯 FIX: Locate the active and opponent King coordinates dynamically from the simulated state
    let activeKingSq = null;
    let opponentKingSq = null;

    for (const [coord, cell] of Object.entries(boardState)) {
        if (cell?.piece?.type === 'King') {
            if (cell.piece.color === perspectiveColor) {
                activeKingSq = coord;
            } else if (cell.piece.color === oppColor) {
                opponentKingSq = coord;
            }
        }
    }

    // Safe fallback if kings are missing during initialization transitions
    if (!opponentKingSq || !activeKingSq) return { score: 0.0, stamp: "N/A" };

    const activeKingAttractor = getKingAttractorField(activeKingSq);
    const opponentKingAttractor = getKingAttractorField(opponentKingSq);

    for (const [coord, cell] of Object.entries(boardState)) {
        if (!cell || !cell.piece) continue;
        
        const piece = cell.piece;
        const targets = getBoilerplate(piece, coord, boardState);

        targets.forEach(target => {
            if (manager && !manager.isPathClear(coord, target)) return;

            const targetOccupant = boardState[target]?.piece;

            if (piece.color === perspectiveColor) {
                if (targetOccupant && targetOccupant.color === oppColor) {
                    const isLegalCapture = checkCapturePermission(piece, coord, targetOccupant, target, isFIActive, boardState);
                    if (isLegalCapture) {
                        let captureValue = VALUE_MATRIX[targetOccupant.type] || 10;
                        if (isFIActive && FAMILIES.MajorFieldPieces.includes(piece.type) && FAMILIES.MajorFieldPieces.includes(targetOccupant.type)) {
                            captureValue *= 2; 
                        }
                        cumulativeScore += (captureValue * 0.15);
                        primaryBehavior = "Cap";
                    }
                }

                if (opponentKingAttractor.includes(target)) {
                    if (pieceHasCheckingPowerAtSquare(piece.type, coord)) {
                        cumulativeScore += 2.5;
                        if (primaryBehavior !== "Cap") primaryBehavior = "Chk";
                    } else {
                        cumulativeScore += 0.5;
                        if (primaryBehavior !== "Cap" && primaryBehavior !== "Chk") primaryBehavior = "Blk";
                    }
                }
            }
            else if (piece.color === oppColor) {
                if (activeKingAttractor.includes(target)) {
                    const oppHasCheckingPower = pieceHasCheckingPowerAtSquare(piece.type, coord);
                    cumulativeScore -= oppHasCheckingPower ? 3.5 : 0.8;
                }
            }
        });
    }

    return {
        score: parseFloat(cumulativeScore.toFixed(2)),
        stamp: primaryBehavior
    };
}

// --- FEATURE 8: MOVE-REGISTRY PIECE SKIPPER ---
function validatePieceSkipperLine(boardState, from, to, perspectiveColor) {
    const oppColor = perspectiveColor === 'white' ? 'black' : 'white';
    const manager = window.CypherManager;
    if (!manager) return true;

    const enemyKingSq = Object.keys(boardState).find(k => boardState[k]?.piece?.type === 'King' && boardState[k]?.piece?.color === oppColor);
    if (!enemyKingSq) return true;

    let activeCheckingVectors = [];

    for (const [coord, cell] of Object.entries(boardState)) {
        if (!cell || !cell.piece || cell.piece.color !== perspectiveColor || coord === from) continue;

        const piece = cell.piece;
        const targets = getBoilerplate(piece, coord, boardState);

        if (targets.includes(enemyKingSq) && pieceHasCheckingPowerAtSquare(piece.type, coord)) {
            if (manager.isPathClear(coord, enemyKingSq)) {
                activeCheckingVectors.push({ source: coord, pieceType: piece.type });
            }
        }
    }

    if (activeCheckingVectors.length === 0) return true;

    for (const vector of activeCheckingVectors) {
        if (physicalPathIntersects(vector.source, enemyKingSq, to)) {
            const movingPieceType = boardState[from]?.piece?.type;
            const targetOccupant = boardState[to]?.piece;

            if (targetOccupant && ['Queen', 'King', 'Rook'].includes(targetOccupant.type)) return true;
            if (pieceHasCheckingPowerAtSquare(movingPieceType, to)) return true;

            return false; 
        }
    }

    return true;
}

function physicalPathIntersects(source, target, intercept) {
    const COLUMNS = ['z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const x1 = COLUMNS.indexOf(source.charAt(0).toLowerCase());
    const y1 = parseInt(source.substring(1), 10);
    const x2 = COLUMNS.indexOf(target.charAt(0).toLowerCase());
    const y2 = parseInt(target.substring(1), 10);
    const xi = COLUMNS.indexOf(intercept.charAt(0).toLowerCase());
    const yi = parseInt(intercept.substring(1), 10);

    if ((yi - y1) * (x2 - x1) !== (y2 - y1) * (xi - x1)) return false;
    return Math.min(x1, x2) <= xi && xi <= Math.max(x1, x2) && Math.min(y1, y2) <= yi && yi <= Math.max(y1, y2);
}

// --- CRITERION: PREVENT EXPOSING MAJOR PIECES TO PAWNS ---
function doesMoveExposeMajorPieceToPawn(simulatedBoard, perspectiveColor) {
    const COLUMNS = ['z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    
    // 1. Gather positions of all White Pawns and Black Major Pieces on the simulated board
    const whitePawns = [];
    const blackMajors = [];

    for (const [coord, cell] of Object.entries(simulatedBoard)) {
        if (!cell || !cell.piece) continue;
        
        if (cell.piece.color === 'white' && cell.piece.type === 'Pawn') {
            whitePawns.push(coord);
        } else if (cell.piece.color === 'black' && ["Queen", "Rook", "Bishop", "Knight"].includes(cell.piece.type)) {
            blackMajors.push(coord);
        }
    }

    // 2. Check if an open ray exists between any White Pawn and any Black Major Piece
    for (const pCoord of whitePawns) {
        const pFileIdx = COLUMNS.indexOf(pCoord.charAt(0).toLowerCase());
        const pRow = parseInt(pCoord.substring(1), 10);

        for (const mCoord of blackMajors) {
            const mFileIdx = COLUMNS.indexOf(mCoord.charAt(0).toLowerCase());
            const mRow = parseInt(mCoord.substring(1), 10);

            const fileDiff = Math.abs(pFileIdx - mFileIdx);
            const rowDiff = Math.abs(pRow - mRow);

            // Check if they share a row, column, or diagonal line
            const isOrthogonal = (pFileIdx === mFileIdx || pRow === mRow);
            const isDiagonal = (fileDiff === rowDiff);

            if (isOrthogonal || isDiagonal) {
                // Verify if the path between them is completely unobstructed
                if (isPathClearInSimulation(simulatedBoard, pCoord, mCoord)) {
                    return true; // A dangerous open path was discovered!
                }
            }
        }
    }
    return false;
}

// A local path-clear inspector that runs strictly against the simulated lookahead layout
function isPathClearInSimulation(board, from, to) {
    const COLUMNS = ['z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const fX = COLUMNS.indexOf(from.charAt(0).toLowerCase());
    const fY = parseInt(from.substring(1), 10);
    const tX = COLUMNS.indexOf(to.charAt(0).toLowerCase());
    const tY = parseInt(to.substring(1), 10);

    const dX = Math.sign(tX - fX);
    const dY = Math.sign(tY - fY);

    let curX = fX + dX;
    let curY = fY + dY;

    while (curX !== tX || curY !== tY) {
        const checkCoord = `${COLUMNS[curX]}${curY}`;
        if (board[checkCoord] && board[checkCoord].piece) {
            return false; // Path is blocked by another piece
        }
        curX += dX;
        curY += dY;
    }
    return true;
}

// =========================================================================
// 🌐 UNIFIED CONVERGENCE INDEX EVALUATOR WITH MOVE-REGISTRY PIECE SKIPPER
// =========================================================================
function calculateMoveWeight(actor, actorCoord, targetSquare) {
    const manager = window.CypherManager;
    if (!manager || !manager.boardIndex) return 0.0;

    const start = actorCoord;
    const end = targetSquare;

    // 1. HARD COORDINATE ANTI-SHUFFLE LOCK
    const globalHistory = manager.state.counters?.moveHistory || [];
    if (globalHistory.length >= 2) {
        const lastMove = globalHistory[globalHistory.length - 2]; 
        if (actor.type !== 'Spy' && lastMove && lastMove.pieceType === actor.type && lastMove.from === end) {
            return -500.0; // Absolute break to stop repeating shuffle loops immediately
        }
    }

    // 2. SIMULATE FUTURE LAYOUT STATE
    const simulatedBoard = JSON.parse(JSON.stringify(manager.boardIndex));
    if (!simulatedBoard[start] || !simulatedBoard[start].piece) return -999.0;
    
    const simulatedActor = simulatedBoard[start].piece;
    const targetCell = simulatedBoard[end];
    const targetPiece = targetCell ? targetCell.piece : null;

    simulatedBoard[end].piece = simulatedActor;
    simulatedBoard[start].piece = null;

    // 3. 🛡️ VETO GATEKEEPER CRITERIA
    if (simulatedActor.color === 'black') {
        // Find Bob's King to check if he is currently under threat
        const blackKingSq = Object.keys(manager.boardIndex).find(k => 
            manager.boardIndex[k]?.piece?.type === 'King' && manager.boardIndex[k]?.piece?.color === 'black'
        );
        const isBobInCheck = blackKingSq ? manager.isSquareThreatened(blackKingSq, 'white') : false;

        // CRITERION: Unless escaping check, forbid moves that expose major pieces to white pawns
        if (!isBobInCheck && doesMoveExposeMajorPieceToPawn(simulatedBoard, 'black')) {
            return -2500.0; // Hard filter veto: instantly disqualifies the move
        }

        // Preserve your existing Piece Skipper line check
        const pathIsValid = typeof validatePieceSkipperLine === 'function' 
            ? validatePieceSkipperLine(simulatedBoard, start, end, 'black')
            : true;
            
        if (!pathIsValid) {
            return -2000.0; 
        }
    }

    // 4. RUN CLEAN CONVERGENCE INDEX PROFILE (GA Base Float Score)
    const profile = typeof evaluateConvergenceProfile === 'function'
        ? evaluateConvergenceProfile(simulatedBoard, simulatedActor.color)
        : { score: 0.0, stamp: "Blk" };
        
    let score = profile.score;

    // 5. PRESERVE CYPHER CHESS SYSTEM OVERRIDES
    const targetSector = typeof getSector === 'function' ? getSector(end) : 'Field';
    const targetFile = end.charAt(0).toLowerCase();
    const targetRow = parseInt(end.substring(1), 10);

    if (targetPiece) {
        const isCourtFlip = (targetSector === 'Court' && simulatedActor.type === 'Spy' && targetPiece.type === 'King');
        const isBorderFlip = (targetSector === 'Border' && simulatedActor.type === 'King' && targetPiece.type === 'Spy');

        if (isCourtFlip || isBorderFlip) {
            score += 35.0; // Scaled to cleanly push the float baseline domain to maximum priority
        }
    }

    // 6. 🕵️ SPY NO-FLY ZONE PRESERVATION
    const whiteKingCoord = manager.state.whiteKingCoord || Object.keys(manager.boardIndex).find(coord => {
        const p = manager.boardIndex[coord]?.piece;
        return p && p.type === 'King' && p.color === 'white';
    });

    if (simulatedActor.type === 'Spy' && targetSector !== 'Court' && whiteKingCoord) {
        const wkFileCode = whiteKingCoord.charAt(0).toLowerCase().charCodeAt(0);
        const wkRow = parseInt(whiteKingCoord.substring(1), 10);

        const fileDist = Math.abs(targetFile.charCodeAt(0) - wkFileCode);
        const rowDist = Math.abs(targetRow - wkRow);

        if (fileDist <= 2 && rowDist <= 2) {
            return -2500.0; // Absolute veto to prevent suicidal flips outside Court
        }
    }

    // 7. 👑 COURT FLIP PROJECTED SHADOW PRESERVATION
    if (simulatedActor.type === 'King' && targetSector === 'Court') {
        const vulnerableCourtSquares = [];

        for (let [spyCoord, cell] of Object.entries(manager.boardIndex)) {
            if (cell && cell.piece && cell.piece.type === 'Spy' && cell.piece.color === 'white') {
                if (typeof manager.isPathClear === 'function') {
                    for (let targetCoord of Object.keys(manager.boardIndex)) {
                        if ((typeof getSector === 'function' ? getSector(targetCoord) : '') === 'Court') {
                            if (manager.isPathClear(spyCoord, targetCoord)) {
                                vulnerableCourtSquares.push(targetCoord);
                            }
                        }
                    }
                }
            }
        }

        if (vulnerableCourtSquares.includes(end)) {
            return -3000.0; // Hard veto penalty overriding all positional desires
        }
    }

    // 8. ATTACH THE TELEMETRY PASS-THROUGHS TO THE ACTIVE CONTAINER
    if (typeof this === 'object' && this !== null) {
        this.stamp = profile.stamp;
        this.score = parseFloat(score.toFixed(2));
    }

    return parseFloat(score.toFixed(2));
}

async function playBobMove() {
    const manager = window.CypherManager;
    
    const isEngineTerminated = manager.state.isGameOver || manager.state.gameOver || manager.state.status === 'checkmate';
    if (isEngineTerminated) return;

    if (!manager.state.cypherRegistry) {
        manager.state.cypherRegistry = [];
    }

    const initialMR = manager.state.counters.moveRecord;
    
    // Balanced weight values now process natively via rankAllMoves
    const movePool = await rankAllMoves();

    if (!movePool || movePool.length === 0) {
        console.log("💤 Bob analyzed the board but found 0 valid targets.");
        return;
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

        // Run lookahead weight to calculate the true gradient priority before selection
        const calculatedPriority = calculateMoveWeight(startCell.piece, move.from, move.to);

        await executeBobMove(move);
        await new Promise(r => setTimeout(r, 150));

        if (manager.state.counters.moveRecord > initialMR) {
            
            // 🎯 ALIGNED LOG: Pulls the true dynamic float score instead of a flat fallback value
            console.log(`🚀 VANGUARD SUCCESS: Engine validated ${move.piece.type}: ${move.from} -> ${move.to} (Priority: ${calculatedPriority})`);

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

// --- SECTOR CHECKING ELIGIBILITY HELPER (Restored for Convergence Profiling) ---
function pieceHasCheckingPowerAtSquare(pieceType, square) {
    const row = parseInt(square.substring(1), 10);
    const file = square.charAt(0).toLowerCase();
    const isCourtSector = (file === 'z' || file === 'i' || row === 0 || row === 10);
    const isBorderSector = (row === 5 && !['z', 'i'].includes(file));
    const isFieldInterior = (!isCourtSector && !isBorderSector);

    if (pieceType === 'Pawn') return true;

    // Major pieces and Spies can only declare a legal check from the Border or Court
    if (["Queen", "Rook", "Bishop", "Knight", "Spy", "King"].includes(pieceType)) {
        if (isFieldInterior) return false; 
    }

    return true; 
}

// --- GEOMETRIC RADIATION HELPERS (Restored for Convergence Profiling) ---
function getKingAttractorField(kingCoord) {
    const COLUMNS = ['z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const cIdx = COLUMNS.indexOf(kingCoord.charAt(0).toLowerCase());
    const r = parseInt(kingCoord.substring(1), 10);
    
    let fieldSquares = [kingCoord]; // Core Target Attractor
    for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
            if (dc === 0 && dr === 0) continue;
            let nc = COLUMNS[cIdx + dc];
            let nr = r + dr;
            if (nc && !isNaN(nr) && nr >= 0 && nr <= 10) {
                fieldSquares.push(`${nc}${nr}`);
            }
        }
    }
    return fieldSquares; 
}

// =============================================================================
// 🌐 GLOBAL EXPOSURE LAYER
// =============================================================================
window.getPieceIdentity = getPieceIdentity;
window.rankAllMoves = rankAllMoves;
window.playBobMove = playBobMove; 

console.log("✅ Bob's brain (AI_Module_2) compiled cleanly with global hooks attached!");
console.log("✅ Bob's brain (AI_Module_2) and Map are successfully linked!");