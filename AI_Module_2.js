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

/**
 * Checks if the King of the specified color is in Checkmate 
 * based on the current simulated board state.
 */
function isKingInCheckmate(simBoard, color) {
    const manager = window.CypherManager;
    
    // FIND THE BLACK KING (Explicit lookup)
    const kingCoord = Object.keys(simBoard).find(coord => {
        const p = simBoard[coord]?.piece;
        // Verify both type and color identity
        return p?.type === 'King' && p?.color === color;
    });

    // CRITICAL FAILURE CATCH: If he can't find his own King, 
    // he must assume the worst (Checkmate)
    if (!kingCoord) return true; 

    // USE YOUR ENGINE'S NATIVE CHECK DETECTION
    // Assuming your engine has a method like isSquareThreatened
    return manager.isSquareThreatened(kingCoord, (color === 'white' ? 'black' : 'white'));
}

function blocksSquare(move, threatSquare) {
    // If the move piece lands on the threatSquare, it blocks/captures the attacker
    return move.to === threatSquare;
}

/**
 * Finds the coordinate currently threatening the King.
 */
function getThreateningSquare(board) {
    const manager = window.CypherManager;
    // Safely iterate keys
    const coords = Object.keys(board || {});
    
    for (const coord of coords) {
        const cell = board[coord];
        // Ensure piece exists and is hostile
        if (cell?.piece && cell.piece.color === 'white') {
            // Check if this piece has a path to the black king
            // We need to define the kingCoord here to check the path
            const blackKing = coords.find(k => board[k]?.piece?.type === 'King' && board[k]?.piece?.color === 'black');
            if (blackKing && manager.isPathClear(coord, blackKing)) {
                return coord; // This is the threat
            }
        }
    }
    return null;
}

function simulateMove(currentBoard, move) {
    // 1. Create a deep copy of the board index
    const simBoard = JSON.parse(JSON.stringify(currentBoard));
    
    // 2. Perform the move in the simulation
    if (simBoard[move.from]) {
        simBoard[move.to] = simBoard[move.from]; // Move the piece data
        simBoard[move.from] = { piece: null };   // Clear the original square
    }
    
    return simBoard;
}

// --- PRE-PROCESSING: THREAT-LOOKAHEAD ---
function getSurvivalMandates(movePool, liveBoard) {
    // Sanity Check: Ensure movePool has valid objects
    const validMoves = movePool.filter(m => m && m.to && typeof m.to === 'string');

    const immediateThreats = validMoves.filter(move => {
        const simulatedBoard = simulateMove(liveBoard, move);
        return isKingInCheckmate(simulatedBoard, 'black');
    });

    if (immediateThreats.length > 0) {
        const threatSquare = getThreateningSquare(liveBoard);
        if (threatSquare) {
            return validMoves.filter(move => blocksSquare(move, threatSquare));
        }
    }

    return validMoves;
}

// --- EXTRACTION HELPER: DETERMINES IF A CANDIDATE SQUARE IS ADJACENT TO THE WHITE KING ---
function isSquareAdjacentToWhiteKing(targetSquareCoord, liveBoardIndex) {
    // 1. Locate the White King in real-time on the active layout
    let whiteKingCoord = null;
    for (const [coord, cell] of Object.entries(liveBoardIndex)) {
        if (cell?.piece && cell.piece.type === 'King' && cell.piece.color === 'white') {
            whiteKingCoord = coord;
            break;
        }
    }

    // 2. If the King isn't on the board (or captured), there is no adjacency
    if (!whiteKingCoord) return false;

    // 3. Run the Cypher Chess matrix geometry distance check
    const COLUMNS = ['z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const kRow = parseInt(whiteKingCoord.substring(1), 10);
    const kColIdx = COLUMNS.indexOf(whiteKingCoord.charAt(0).toLowerCase());
    
    const mRow = parseInt(targetSquareCoord.substring(1), 10);
    const mColIdx = COLUMNS.indexOf(targetSquareCoord.charAt(0).toLowerCase());
    
    // If column index parsing failed, return safe false
    if (kColIdx === -1 || mColIdx === -1) return false;

    // Check if landing within 1 square distance radially (<= 1 column difference AND <= 1 row difference)
    return (Math.abs(kRow - mRow) <= 1 && Math.abs(kColIdx - mColIdx) <= 1);
}
// =========================================================================
// 🎯 BOB LITE 2.1: MODULAR STATE-BASED EVALUATION ENGINE
// =========================================================================

async function rankAllMoves() {
    const manager = window.CypherManager;
    const liveBoard = manager.boardIndex;
    const isInvasionActive = manager.state.counters.invasion > 0;
    
    // --- MODULE 1: DISCRETE STATE & RADAR PARSING ---
    let trackedCourtTargetCoord = null;
    let isCourtPoliceModeActive = false;

    try {
        const registry = manager.state.cypherRegistry || [];
        const totalRecords = registry.length;

        for (let i = 1; i <= totalRecords; i++) {
            const targetIndex = totalRecords - i;
            if (targetIndex >= 0) {
                const record = registry[targetIndex];
                
                if (record && typeof record === 'string' && record.startsWith('W')) {
                    const parts = record.split(' ');
                    if (parts && parts.length >= 3) {
                        const pieceToken = (parts[1] || '').toLowerCase(); 
                        const pathString = parts[2] || '';               
                        const pathParts = pathString.split('->');
                        
                        if (pathParts.length === 2 && pathParts[1]) {
                            const destination = pathParts[1].trim().toLowerCase();
                            
                            // Exclude Kings, Pawns, and Spies from activating the Court Radar
                            if (!pieceToken.includes('k') && !pieceToken.includes('p') && !pieceToken.includes('s')) {
                                const destCol = destination.charAt(0);
                                const destRow = parseInt(destination.substring(1), 10);
                                
                                const isCourtColumn = (destCol === 'z' || destCol === 'i');
                                const isCourtRow = (destRow === 0 || destRow === 10);
                                
                                if (isCourtColumn || isCourtRow) {
                                    trackedCourtTargetCoord = pathParts[1].trim();
                                    isCourtPoliceModeActive = true;
                                    break; 
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (registryError) {
        console.error("⚠️ [STATE ENGINE] Registry parser exception:", registryError);
    }

    // --- MODULE 2: MOVE POOL FILTERING (ANTI-FRIENDLY FIRE) ---
    let movePool = [];
    try {
        for (let [coord, cell] of Object.entries(liveBoard)) {
            if (!cell || !cell.piece || cell.piece.color !== 'black') continue;
            const piece = cell.piece;
            const boilerplate = typeof getBoilerplate === 'function' ? getBoilerplate(piece, coord) : [];
            
            boilerplate.forEach(targetSquare => {
                if (!manager.isPathClear(coord, targetSquare)) return;
                const targetCell = liveBoard[targetSquare];
                
                // Strict Isolation: Never evaluate friendly fire paths
                if (targetCell?.piece && targetCell.piece.color === piece.color) return;
                
                if (targetCell?.piece && typeof checkCapturePermission === 'function') {
                    if (!checkCapturePermission(piece, coord, targetCell.piece, targetSquare, isInvasionActive)) return;
                }

                movePool.push({
                    from: coord,
                    to: targetSquare,
                    weight: 0.0,
                    isCapture: !!targetCell?.piece,
                    piece: piece 
                });
            });
        }
    } catch (poolError) {
        console.error("⚠️ [STATE ENGINE] Critical move pool generation crash:", poolError);
        return []; 
    }

    // --- MODULE 3: STATE MANDATE SEPARATION (BOB LITE DIRECT VERIFICATION) ---
    try {
        // Find Bob's Black King on the active live board layout
        const blackKingSq = Object.keys(liveBoard).find(k => 
            liveBoard[k]?.piece?.type === 'King' && liveBoard[k]?.piece?.color === 'black'
        );

        // Native check detection: Is Bob's King genuinely under attack on the live board?
        const isBobGenuinelyInCheck = blackKingSq ? manager.isSquareThreatened(blackKingSq, 'white') : false;

        if (isBobGenuinelyInCheck) {
            console.log("🛡️ [STATE ACTIVATION]: SURVIVAL MODE ENGAGED (Genuine Check Detected)");
            
            // Filter the move pool to ONLY allow moves that land on the threatening square or move the King
            const threatSquare = getThreateningSquare(liveBoard);
            if (threatSquare) {
                const survivalPool = movePool.filter(move => move.to === threatSquare || move.piece.type === 'King');
                if (survivalPool.length > 0) {
                    return survivalPool.sort((a, b) => {
                        const wA = typeof calculateMoveWeight === 'function' ? calculateMoveWeight(a.piece, a.from, a.to) : 0;
                        const wB = typeof calculateMoveWeight === 'function' ? calculateMoveWeight(b.piece, b.from, b.to) : 0;
                        return wB - wA;
                    });
                }
            }
        }
    } catch (survivalError) {
        console.error("⚠️ [STATE ENGINE] Survival Layer failure:", survivalError);
    }

    // --- MODULE 4: WEIGHT MAPPING VIA STATE DIRECTIVES ---
    const sortedPool = movePool.map(move => {
        try {
            let weight = typeof calculateMoveWeight === 'function' ? calculateMoveWeight(move.piece, move.from, move.to) : 0.0;
            const actorType = move.piece.type;
            const targetSector = typeof getSector === 'function' ? getSector(move.to) : 'Field';
            const isAdjacentToKing = isSquareAdjacentToWhiteKing(move.to, liveBoard);

            // 🛑 GLOBAL CONDITION AVOIDANCE LAYER (Always active across all states)
            // 1. Queen Pawn-Threat Radar
            if (actorType === 'Queen') {
                for (const [pCoord, cell] of Object.entries(liveBoard)) {
                    if (cell?.piece && cell.piece.color === 'white' && cell.piece.type === 'Pawn') {
                        const pawnTargets = typeof getBoilerplate === 'function' ? getBoilerplate(cell.piece, pCoord) : [];
                        if (pawnTargets.includes(move.to) && manager.isPathClear(pCoord, move.to)) {
                            weight -= 25000.0; // Uniform blunder penalty
                            break;
                        }
                    }
                }
            }
            
            // 2. Spy King Flip Trap Protection
            if (actorType === 'Spy' && isAdjacentToKing) {
                weight -= 40000.0; 
            }

            // 🔀 BRANCH ON ISOLATED SYSTEM STATE
            if (isCourtPoliceModeActive && trackedCourtTargetCoord && actorType === 'Spy') {
                // --- STATE A: COURT POLICE DIRECTIVE ---
                if (move.to === trackedCourtTargetCoord && move.isCapture) {
                    weight += 99999.0; // Absolute strike priority
                } else {
                    const spyRow = parseInt(move.to.substring(1), 10);
                    const spyCol = move.to.charAt(0).toLowerCase();
                    const tRow = parseInt(trackedCourtTargetCoord.substring(1), 10);
                    const tCol = trackedCourtTargetCoord.charAt(0).toLowerCase();
                    
                    const distance = Math.abs(spyCol.charCodeAt(0) - tCol.charCodeAt(0)) + Math.abs(spyRow - tRow);
                    weight += (20 - distance) * 200.0; // Magnetic tracking pull
                }
            } else {
                // --- STATE B: STANDARD POSITIONING & DEVELOPMENT ---
                // 1. Encourage moving pieces to the Border Sector
                if (targetSector === 'Border') {
                    weight += 400.0; 
                }
                
                // 2. Prioritize Re-takes / Captures natively
                if (move.isCapture) {
                    weight += 800.0; 
                }

                // 3. Fall back smoothly to convergence proximity mapping
                if (typeof evaluateConvergenceProfile === 'function') {
                    const attractorProfile = evaluateConvergenceProfile(liveBoard, 'black');
                    weight += (attractorProfile.score * 100);
                }
            }

            return { ...move, weight: weight };
        } catch (mapItemError) {
            return { ...move, weight: -99999.0 }; 
        }
    });

    // --- MODULE 5: ARBITRATION SORT ---
    try {
        return sortedPool.sort((a, b) => b.weight - a.weight);
    } catch (sortError) {
        console.error("⚠️ [STATE ENGINE] Sorting failure:", sortError);
        return movePool; 
    }
}

function predictCheck(from, to) {
    // Bob asks the Engine to imagine the piece at the target square
    return window.CypherManager.scanCourtLineForKing(to, 'white');
}

// =========================================================================
// 🎯 LOCAL REPAIR DEPENDENCIES FOR THE DYNAMIC LOOKAHEAD ENGINE
// =========================================================================

function evaluateConvergenceProfile(boardState, perspectiveColor) {
    const oppColor = perspectiveColor === 'white' ? 'black' : 'white';
    const manager = window.CypherManager;
    const isFIActive = !!(manager?.state?.counters?.invasion > 0);

    let cumulativeScore = 0.0;
    let primaryBehavior = "Blk"; 

    // Locate Kings
    let activeKingSq = null;
    let opponentKingSq = null;
    for (const [coord, cell] of Object.entries(boardState)) {
        if (cell?.piece?.type === 'King') {
            if (cell.piece.color === perspectiveColor) activeKingSq = coord;
            else if (cell.piece.color === oppColor) opponentKingSq = coord;
        }
    }
    if (!opponentKingSq || !activeKingSq) return { score: 0.0, stamp: "N/A" };

    const opponentKingAttractor = getKingAttractorField(opponentKingSq);
    const activeKingAttractor = getKingAttractorField(activeKingSq);

    for (const [coord, cell] of Object.entries(boardState)) {
        if (!cell || !cell.piece) continue;
        
        const piece = cell.piece;
        const targets = getBoilerplate(piece, coord, boardState);

        targets.forEach(target => {
            // Keep path check, but ensure performance doesn't drag
            if (manager && !manager.isPathClear(coord, target)) return;

            const targetOccupant = boardState[target]?.piece;

            // 1. OFFENSIVE CALCULATION
            if (piece.color === perspectiveColor) {
                if (targetOccupant && targetOccupant.color === oppColor) {
                    const isLegalCapture = checkCapturePermission(piece, coord, targetOccupant, target, isFIActive, boardState);
                    if (isLegalCapture) {
                        let captureValue = VALUE_MATRIX[targetOccupant.type] || 10;
                        cumulativeScore += (captureValue * 0.15);
                        primaryBehavior = "Cap";
                    }
                }

                // Inside your evaluateConvergenceProfile loop, where checking power is verified:
if (opponentKingAttractor.includes(target)) {
    const isChecking = pieceHasCheckingPowerAtSquare(piece.type, coord);
    
    // NEW: Calculate Manhattan Distance to target
    const dist = Math.abs(target.charCodeAt(0) - coord.charCodeAt(0)) + 
                 Math.abs(parseInt(target.substring(1)) - parseInt(coord.substring(1)));
    
    // The closer the piece is, the higher the score. 
    // This forces Bob to move off the back row to increase his "gravity."
    const proximityBonus = Math.max(0, (10 - dist) * 0.5); 
    
    cumulativeScore += (isChecking ? 5.0 : 1.5) + proximityBonus;
    if (primaryBehavior !== "Cap") primaryBehavior = "Chk";
}
            }
            
            // 2. DEFENSIVE CALCULATION (The Pincer Detector)
            else if (piece.color === oppColor) {
                if (activeKingAttractor.includes(target)) {
                    const isChecking = pieceHasCheckingPowerAtSquare(piece.type, coord);
                    // Use a heavier multiplier for defensive threats
                    cumulativeScore -= isChecking ? 8.0 : 2.0; 
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
    // 1. Scan the simulated board layout to isolate all assets
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

    // 2. Instead of casting rays, inspect if any White Pawn legally steps on a Black Major
    for (const pCoord of whitePawns) {
        const cell = simulatedBoard[pCoord];
        // Fetch the true directional matrix target paths for this exact pawn type (Fp, Bp, Ffp, Fffp)
        const pawnTargets = typeof getBoilerplate === 'function' ? getBoilerplate(cell.piece, pCoord) : [];

        for (const mCoord of blackMajors) {
            // If a major piece coordinate intersects with a pawn's physical capture vector
            if (pawnTargets.includes(mCoord)) {
                // Verify the path is clear and it's a legal capture permission alignment
                const pathClear = isPathClearInSimulation(simulatedBoard, pCoord, mCoord);
                
                // Note: We safely pass false or pull the engine counter if available for invasion checks
                const manager = window.CypherManager;
                const isInvasionActive = manager ? (manager.state.counters.invasion > 0) : false;
                const permClear = typeof checkCapturePermission === 'function'
                    ? checkCapturePermission(cell.piece, pCoord, simulatedBoard[mCoord].piece, mCoord, isInvasionActive)
                    : true;

                if (pathClear && permClear) {
                    return true; // A genuine tactical threat discovered!
                }
            }
        }
    }
    return false; // No blunders detected
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


// Local adjustment for Bob's defensive logic
function evaluateBoardState(board) {
    let blackCI = calculateCI("Black", board);
    let whiteCI = calculateCI("White", board); // New requirement

    // Pincer threshold logic
    if (whiteCI >= X) { 
        bob.state = "BLOCKING";
        return prioritizeBlockingMoves(board);
    } else {
        bob.state = "ATTACKING";
        return executeStandardStrategy(board);
    }
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

   // 4. RUN DUAL-STREAM CONVERGENCE INDEX PROFILE
    // Evaluate Bob's offensive capability
    let profile = typeof evaluateConvergenceProfile === 'function'
        ? evaluateConvergenceProfile(simulatedBoard, 'black')
        : { score: 0.0, stamp: "Off" };
        
    // Evaluate White's current threat to Bob
    let defensiveProfile = typeof evaluateConvergenceProfile === 'function'
        ? evaluateConvergenceProfile(simulatedBoard, 'white')
        : { score: 0.0, stamp: "Def" };

    const THRESHOLD_X = 50.0;
    let score = profile.score;

    // Trigger blocking logic if the threat threshold is crossed
    if (defensiveProfile.score >= THRESHOLD_X) {
        console.log(`⚠️ DEFENSIVE PINCER DETECTED (White CI: ${defensiveProfile.score.toFixed(1)}).`);
        
        // Prioritize defensive weight
        score = (score * 0.2) - (defensiveProfile.score * 1.5); 
        profile.stamp = "Blk"; 
    }

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
    if (simulatedActor.type === 'Spy' && targetSector !== 'Court') {
        // Pass the target square and the active simulated layout to our global helper
        const isDangerousFlipSquare = isSquareAdjacentToWhiteKing(end, simulatedBoard);
        
        if (isDangerousFlipSquare) {
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