
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const BOARD_SIZE = 16;

const BASE_GAME_SPEED = 260;
const MIN_GAME_SPEED = 140;
const LEVEL_SPEED_STEP = 15;

const BOMB_LIFETIME = 10000;
const BOMB_SPAWN_INTERVAL = 4500;
const MAX_BOMBS = 2;

type Position = {
  x: number;
  z: number;
};

type Direction = {
  x: number;
  z: number;
};

type Bomb = {
  id: number;
  position: Position;
  expiresAt: number;
};

type LeaderboardEntry = {
  id: number;
  highScore: number;
  user: {
    id: number;
    name: string;
    username: string;
  };
};

const INITIAL_SNAKE: Position[] = [
  { x: 8, z: 8 },
  { x: 7, z: 8 },
  { x: 6, z: 8 },
];

const INITIAL_DIRECTION: Direction = {
  x: 1,
  z: 0,
};

function getToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

function samePosition(a: Position, b: Position) {
  return a.x === b.x && a.z === b.z;
}

function createFreePosition(
  snake: Position[],
  food?: Position,
  bombs: Bomb[] = []
): Position {
  const available: Position[] = [];

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let z = 0; z < BOARD_SIZE; z++) {
      const position = { x, z };

      const occupiedBySnake = snake.some((segment) =>
        samePosition(segment, position)
      );

      const occupiedByFood =
        food && samePosition(food, position);

      const occupiedByBomb = bombs.some((bomb) =>
        samePosition(bomb.position, position)
      );

      if (
        !occupiedBySnake &&
        !occupiedByFood &&
        !occupiedByBomb
      ) {
        available.push(position);
      }
    }
  }

  if (available.length === 0) {
    return { x: 3, z: 5 };
  }

  return available[
    Math.floor(Math.random() * available.length)
  ];
}

function createFood(
  snake: Position[],
  bombs: Bomb[] = []
): Position {
  return createFreePosition(snake, undefined, bombs);
}

/* =========================================
   CAPYBARA MODEL
========================================= */

function CapybaraModel() {
  const { scene } = useGLTF("/models/Capybara.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.updateMatrixWorld(true);

    const originalBounds = new THREE.Box3().setFromObject(cloned);
    const originalSize = originalBounds.getSize(
      new THREE.Vector3()
    );

    if (originalSize.y > 0) {
      cloned.scale.setScalar(2.2 / originalSize.y);
    }

    cloned.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(cloned);
    const center = bounds.getCenter(new THREE.Vector3());

    cloned.position.set(
      -center.x,
      -bounds.min.y,
      -center.z
    );

    cloned.updateMatrixWorld(true);

    return cloned;
  }, [scene]);

  return <primitive object={model} />;
}


function AnimatedSnake({
  snake,
  direction,
  eatVersion,
  movementDuration,
}: {
  snake: Position[];
  direction: Direction;
  eatVersion: number;
  movementDuration: number;
}) {
  const headRef = useRef<THREE.Group>(null);
  const bodyRefs = useRef<(THREE.Group | null)[]>([]);

  const previousPositions = useRef<Position[]>(snake);
  const currentPositions = useRef<Position[]>(snake);

  const movementStarted = useRef(performance.now());

  const previousEatVersion = useRef(eatVersion);
  const eatingStarted = useRef(0);

  
  const MODEL_FORWARD_OFFSET = 0;

  const targetRotation = useRef(
    Math.atan2(direction.x, direction.z) + MODEL_FORWARD_OFFSET
  );

  const targetQuaternion = useRef(new THREE.Quaternion());

  useEffect(() => {
    previousPositions.current = currentPositions.current;
    currentPositions.current = snake;
    movementStarted.current = performance.now();
  }, [snake]);

  useEffect(() => {
    if (eatVersion !== previousEatVersion.current) {
      previousEatVersion.current = eatVersion;
      eatingStarted.current = performance.now();
    }
  }, [eatVersion]);

  useEffect(() => {
    targetRotation.current =
      Math.atan2(direction.x, direction.z) + MODEL_FORWARD_OFFSET;

    targetQuaternion.current.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      targetRotation.current
    );
  }, [direction]);

  useFrame(() => {
    const now = performance.now();

    const progress = Math.min(
      1,
      (now - movementStarted.current) / movementDuration
    );

    const previous = previousPositions.current;
    const current = currentPositions.current;

    current.forEach((position, index) => {
      const oldPosition = previous[index] || position;

      const x = THREE.MathUtils.lerp(
        oldPosition.x,
        position.x,
        progress
      );

      const z = THREE.MathUtils.lerp(
        oldPosition.z,
        position.z,
        progress
      );

      const worldX = x - BOARD_SIZE / 2 + 0.5;
      const worldZ = z - BOARD_SIZE / 2 + 0.5;

      if (index === 0 && headRef.current) {
        headRef.current.position.set(worldX, 0, worldZ);

        // Smoothly rotate instead of instantly snapping.
        headRef.current.quaternion.slerp(
          targetQuaternion.current,
          0.16
        );

        const elapsed = now - eatingStarted.current;

        const pulse =
          elapsed < 350
            ? Math.sin((elapsed / 350) * Math.PI) * 0.16
            : 0;

        headRef.current.scale.setScalar(
          0.52 * (1 + pulse)
        );
      } else {
        const body = bodyRefs.current[index - 1];

        if (body) {
          body.position.set(worldX, 0.42, worldZ);
        }
      }
    });
  });

  return (
    <>
      <group ref={headRef} scale={0.52}>
        <Suspense fallback={null}>
          <CapybaraModel />
        </Suspense>
      </group>

      {snake.slice(1).map((_, index) => (
        <group
          key={index}
          ref={(element) => {
            bodyRefs.current[index] = element;
          }}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.37, 24, 24]} />
            <meshStandardMaterial
              color={
                index % 2 === 0
                  ? "#b98a58"
                  : "#a97849"
              }
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}


function FoodObject({
  position,
}: {
  position: Position;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.position.y =
      0.42 + Math.sin(state.clock.elapsedTime * 3) * 0.07;

    groupRef.current.rotation.y =
      state.clock.elapsedTime * 1.3;
  });

  return (
    <group
      ref={groupRef}
      position={[
        position.x - BOARD_SIZE / 2 + 0.5,
        0.42,
        position.z - BOARD_SIZE / 2 + 0.5,
      ]}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshStandardMaterial
          color="#ff922e"
          roughness={0.45}
          emissive="#8b3b08"
          emissiveIntensity={0.15}
        />
      </mesh>

      <mesh position={[0, 0.23, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.15, 8]} />
        <meshStandardMaterial color="#568044" />
      </mesh>
    </group>
  );
}

/* =========================================
   TEMPORARY BOMBS
========================================= */

function BombObject({
  bomb,
}: {
  bomb: Bomb;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    const remaining = bomb.expiresAt - Date.now();
    const finalWarning = remaining <= 3000;

    const blink =
      Math.sin(state.clock.elapsedTime * 13) > 0;

    groupRef.current.visible =
      !finalWarning || blink;

    groupRef.current.rotation.y += 0.025;

    groupRef.current.position.y =
      0.48 + Math.sin(state.clock.elapsedTime * 4) * 0.06;

    groupRef.current.scale.setScalar(
      finalWarning
        ? 1 + Math.sin(state.clock.elapsedTime * 13) * 0.08
        : 1
    );

    if (lightRef.current) {
      lightRef.current.intensity =
        finalWarning
          ? blink ? 5 : 0.5
          : 1.5;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[
        bomb.position.x - BOARD_SIZE / 2 + 0.5,
        0.48,
        bomb.position.z - BOARD_SIZE / 2 + 0.5,
      ]}
    >
      <pointLight
        ref={lightRef}
        color="#ff3030"
        intensity={1.5}
        distance={2.5}
      />

      <mesh castShadow>
        <sphereGeometry args={[0.29, 24, 24]} />
        <meshStandardMaterial
          color="#25201e"
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      <mesh
        position={[0, 0.29, 0]}
        rotation={[0, 0, -0.35]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.2, 8]} />
        <meshStandardMaterial color="#c78a43" />
      </mesh>

      <mesh position={[0.08, 0.4, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial
          color="#ff5b28"
          emissive="#ff2600"
          emissiveIntensity={2}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.025, 8, 32]} />
        <meshStandardMaterial
          color="#a83e2b"
          emissive="#7b160d"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

/* =========================================
   GARDEN DECORATIONS
========================================= */

function GardenFlower({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.44, 8]} />
        <meshStandardMaterial color="#477d35" />
      </mesh>

      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, 0.49, 0.12]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#f6d77d" />
      </mesh>
    </group>
  );
}

function GardenFence() {
  return (
    <>
      {Array.from({ length: 17 }, (_, index) => (
        <group key={index}>
          <mesh position={[index - 8, 0.43, -8.35]} castShadow>
            <boxGeometry args={[0.13, 0.85, 0.13]} />
            <meshStandardMaterial color="#a7794d" />
          </mesh>

          <mesh position={[index - 8, 0.43, 8.35]} castShadow>
            <boxGeometry args={[0.13, 0.85, 0.13]} />
            <meshStandardMaterial color="#a7794d" />
          </mesh>

          <mesh position={[-8.35, 0.43, index - 8]} castShadow>
            <boxGeometry args={[0.13, 0.85, 0.13]} />
            <meshStandardMaterial color="#a7794d" />
          </mesh>

          <mesh position={[8.35, 0.43, index - 8]} castShadow>
            <boxGeometry args={[0.13, 0.85, 0.13]} />
            <meshStandardMaterial color="#a7794d" />
          </mesh>
        </group>
      ))}

      {[-8.35, 8.35].map((z) =>
        [0.25, 0.62].map((y) => (
          <mesh key={`${z}-${y}`} position={[0, y, z]}>
            <boxGeometry args={[16.5, 0.12, 0.12]} />
            <meshStandardMaterial color="#805333" />
          </mesh>
        ))
      )}

      {[-8.35, 8.35].map((x) =>
        [0.25, 0.62].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0]}>
            <boxGeometry args={[0.12, 0.12, 16.5]} />
            <meshStandardMaterial color="#805333" />
          </mesh>
        ))
      )}
    </>
  );
}

/* =========================================
   COMPLETE 3D GARDEN SCENE
========================================= */

function GameScene({
  snake,
  food,
  direction,
  bombs,
  eatVersion,
  movementDuration,
}: {
  snake: Position[];
  food: Position;
  direction: Direction;
  bombs: Bomb[];
  eatVersion: number;
  movementDuration: number;
}) {
  const flowers = useMemo(
    () => [
      { position: [-8.9, 0, -6] as [number, number, number], color: "#ffcf66" },
      { position: [-8.9, 0, -2] as [number, number, number], color: "#f08b9d" },
      { position: [-8.9, 0, 3] as [number, number, number], color: "#ffcf66" },
      { position: [8.9, 0, -5] as [number, number, number], color: "#f08b9d" },
      { position: [8.9, 0, 1] as [number, number, number], color: "#ffcf66" },
      { position: [8.9, 0, 6] as [number, number, number], color: "#f08b9d" },
    ],
    []
  );

  return (
    <>
      <color attach="background" args={["#a6d78c"]} />
      <fog attach="fog" args={["#a6d78c", 25, 45]} />

      <ambientLight intensity={1.4} />

      <hemisphereLight
        args={["#e8f7d7", "#547c3d", 1.2]}
      />

      <directionalLight
        position={[6, 12, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <directionalLight
        position={[-7, 6, -5]}
        intensity={0.8}
        color="#d4b58b"
      />

      {/* OUTER GARDEN */}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.3, 0]}
        receiveShadow
      >
        <planeGeometry args={[45, 45]} />
        <meshStandardMaterial color="#426d38" roughness={1} />
      </mesh>

      {/* MAIN LAWN */}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#5d9844" roughness={1} />
      </mesh>

      {/* CHECKERBOARD GRASS */}

      {Array.from({ length: 256 }, (_, index) => {
        const x = index % 16;
        const z = Math.floor(index / 16);

        const worldX = x - 7.5;
        const worldZ = z - 7.5;

        return (
          <mesh
            key={index}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[worldX, -0.065, worldZ]}
          >
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={
                (x + z) % 2 === 0
                  ? "#68a94d"
                  : "#5b9743"
              }
              roughness={1}
            />
          </mesh>
        );
      })}

      {/* LAWN GRID */}

      <gridHelper
        args={[BOARD_SIZE, BOARD_SIZE, "#a4c47a", "#78aa5d"]}
        position={[0, -0.045, 0]}
        material-opacity={0.18}
        material-transparent
      />

      {/* GARDEN FENCE */}

      <GardenFence />

      {/* FLOWERS */}

      {flowers.map((flower, index) => (
        <GardenFlower
          key={index}
          position={flower.position}
          color={flower.color}
        />
      ))}

      {/* SNAKE */}

      <AnimatedSnake
        snake={snake}
        direction={direction}
        eatVersion={eatVersion}
        movementDuration={movementDuration}
      />

      {/* FOOD */}

      <FoodObject position={food} />

      {/* BOMBS */}

      {bombs.map((bomb) => (
        <BombObject key={bomb.id} bomb={bomb} />
      ))}
    </>
  );
}

/* =========================================
   MAIN ARCADE PAGE
========================================= */

export default function ArcadePage() {
  const router = useRouter();

  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);

  const [food, setFood] = useState<Position>({
    x: 3,
    z: 5,
  });

  const [direction, setDirection] =
    useState<Direction>(INITIAL_DIRECTION);

  const [bombs, setBombs] = useState<Bomb[]>([]);

  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const [level, setLevel] = useState(1);
  const [levelFlash, setLevelFlash] = useState(false);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const [eatVersion, setEatVersion] = useState(0);

  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const directionRef = useRef(direction);
  const bombsRef = useRef<Bomb[]>([]);
  const scoreRef = useRef(0);

  const lastBombSpawnRef = useRef(0);
  const bombIdRef = useRef(0);

  const gameEndedRef = useRef(false);
  const levelFlashTimeoutRef = useRef<number | null>(null);

  const gameSpeed = Math.max(
    MIN_GAME_SPEED,
    BASE_GAME_SPEED - (level - 1) * LEVEL_SPEED_STEP
  );

  /* LEADERBOARD */

  const fetchLeaderboard = useCallback(async () => {
    const token = getToken();

    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/users/leaderboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      setLeaderboard(data);

      const ownRecord = data.find(
        (entry: LeaderboardEntry) =>
          entry.user?.username ===
          localStorage.getItem("username")
      );

      if (ownRecord) {
        setBestScore(ownRecord.highScore);
      }
    } catch {
      console.error("Unable to load leaderboard.");
    }
  }, []);

  /* SUBMIT SCORE */

  const submitScore = useCallback(
    async (finalScore: number) => {
      const token = getToken();

      if (!token) return;

      setSubmitting(true);

      try {
        const response = await fetch(
          `${API_URL}/users/leaderboard`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              score: finalScore,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Unable to submit score.");
        }

        const data = await response.json();

        setBestScore(data.highScore);
        await fetchLeaderboard();
      } catch {
        setError("Your score could not be submitted.");
      } finally {
        setSubmitting(false);
      }
    },
    [fetchLeaderboard]
  );

  /* AUTHENTICATION */

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.replace("/");
      return;
    }

    fetchLeaderboard();
  }, [router, fetchLeaderboard]);

  const changeDirection = useCallback(
  (nextDirection: Direction) => {
    if (!running || levelFlash) return;

    const current = directionRef.current;

    if (
      nextDirection.x === -current.x &&
      nextDirection.z === -current.z
    ) {
      return;
    }

    directionRef.current = nextDirection;
    setDirection(nextDirection);
  },
  [running, levelFlash]
);

  /* KEYBOARD CONTROLS */

  useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    const keys: Record<string, Direction> = {
      ArrowUp: { x: 0, z: -1 },
      w: { x: 0, z: -1 },
      ArrowDown: { x: 0, z: 1 },
      s: { x: 0, z: 1 },
      ArrowLeft: { x: -1, z: 0 },
      a: { x: -1, z: 0 },
      ArrowRight: { x: 1, z: 0 },
      d: { x: 1, z: 0 },
    };

    const key =
      event.key.length === 1
        ? event.key.toLowerCase()
        : event.key;

    const nextDirection = keys[key];

    if (!nextDirection) return;

    event.preventDefault();
    changeDirection(nextDirection);
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [changeDirection]);

  /* GAME LOOP */

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      if (gameEndedRef.current) return;

      const currentSnake = snakeRef.current;
      const currentDirection = directionRef.current;
      const now = Date.now();

      // Remove expired bombs.

      let activeBombs = bombsRef.current.filter(
        (bomb) => bomb.expiresAt > now
      );

      // Spawn temporary bombs.

      if (
        activeBombs.length < MAX_BOMBS &&
        now - lastBombSpawnRef.current >= BOMB_SPAWN_INTERVAL
      ) {
        const bombPosition = createFreePosition(
          currentSnake,
          foodRef.current,
          activeBombs
        );

        activeBombs = [
          ...activeBombs,
          {
            id: ++bombIdRef.current,
            position: bombPosition,
            expiresAt: now + BOMB_LIFETIME,
          },
        ];

        lastBombSpawnRef.current = now;
      }

      bombsRef.current = activeBombs;
      setBombs(activeBombs);

      const head = currentSnake[0];

      const nextHead = {
        x: head.x + currentDirection.x,
        z: head.z + currentDirection.z,
      };

      const eating = samePosition(
        nextHead,
        foodRef.current
      );

      const hitBomb = activeBombs.some((bomb) =>
        samePosition(bomb.position, nextHead)
      );

      const collisionBody = eating
        ? currentSnake
        : currentSnake.slice(0, -1);

      const hitWall =
        nextHead.x < 0 ||
        nextHead.x >= BOARD_SIZE ||
        nextHead.z < 0 ||
        nextHead.z >= BOARD_SIZE;

      const hitSelf = collisionBody.some((segment) =>
        samePosition(segment, nextHead)
      );

      if (hitWall || hitSelf || hitBomb) {
        gameEndedRef.current = true;

        setRunning(false);
        setGameOver(true);

        submitScore(scoreRef.current);
        return;
      }

      const nextSnake = [
        nextHead,
        ...currentSnake.slice(
          0,
          eating ? currentSnake.length : -1
        ),
      ];

      snakeRef.current = nextSnake;
      setSnake(nextSnake);

      if (eating) {
        const nextScore = scoreRef.current + 10;

        scoreRef.current = nextScore;

        setScore(nextScore);
        setEatVersion((value) => value + 1);

        const nextFood = createFood(
          nextSnake,
          activeBombs
        );

        foodRef.current = nextFood;
        setFood(nextFood);

        // LEVEL UP EVERY 10 ORANGES.

        if (nextScore % 100 === 0) {
          const nextLevel = Math.floor(nextScore / 100) + 1;

          setLevel(nextLevel);
          setRunning(false);
          setLevelFlash(true);

          if (levelFlashTimeoutRef.current !== null) {
            window.clearTimeout(levelFlashTimeoutRef.current);
          }

          levelFlashTimeoutRef.current =
            window.setTimeout(() => {
              setLevelFlash(false);

              levelFlashTimeoutRef.current = null;

              if (!gameEndedRef.current) {
                setRunning(true);
              }
            }, 1800);
        }
      }
    }, gameSpeed);

    return () => window.clearInterval(interval);
  }, [running, gameSpeed, submitScore]);

  /* RESET GAME */

  function startGame() {
    if (hasPlayed && !gameOver) {
      setRunning(true);
      return;
    }

    if (levelFlashTimeoutRef.current !== null) {
      window.clearTimeout(levelFlashTimeoutRef.current);
      levelFlashTimeoutRef.current = null;
    }

    const startingSnake = [...INITIAL_SNAKE];
    const startingBombs: Bomb[] = [];
    const startingFood = createFood(startingSnake);

    snakeRef.current = startingSnake;
    foodRef.current = startingFood;
    directionRef.current = INITIAL_DIRECTION;
    bombsRef.current = startingBombs;
    scoreRef.current = 0;

    lastBombSpawnRef.current = Date.now();
    gameEndedRef.current = false;

    setSnake(startingSnake);
    setFood(startingFood);
    setDirection(INITIAL_DIRECTION);
    setBombs(startingBombs);

    setScore(0);
    setLevel(1);
    setEatVersion(0);

    setLevelFlash(false);
    setGameOver(false);
    setHasPlayed(true);
    setError("");
    setRunning(true);
  }

  function goBack() {
    router.push("/dashboard");
  }

  /* CLEANUP */

  useEffect(() => {
    return () => {
      if (levelFlashTimeoutRef.current !== null) {
        window.clearTimeout(levelFlashTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main
      className="auth-page"
      style={{ minHeight: "100vh" }}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="geometry geometry-one" />
      <div className="geometry geometry-two" />

      {/* HEADER */}

      <header
        style={{
          maxWidth: "1100px",
          width: "100%",
          margin: "0 auto",
          padding: "25px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <img
          src="/images/CapyLogo.gif"
          alt="Capybara Logo"
          width={125}
          height={90}
          style={{ objectFit: "contain" }}
        />

        <button
          onClick={goBack}
          className="dashboard-action-button"
          style={{
            padding: "12px 22px",
            borderRadius: "25px",
            border: "1px solid rgba(238,229,216,0.3)",
            background: "rgba(255,255,255,0.1)",
            color: "#eee5d8",
            cursor: "pointer",
          }}
        >
          ← DASHBOARD
        </button>
      </header>

      <section
        style={{
          maxWidth: "1100px",
          width: "100%",
          margin: "0 auto",
          padding: "10px 25px 70px",
          boxSizing: "border-box",
          color: "#eee5d8",
        }}
      >
        {/* TITLE */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "25px",
          }}
        >
          <span className="eyebrow">CAPYBARA ARCADE</span>

          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 48px)",
              marginTop: "10px",
            }}
          >
            Capybara Snake 🍊
          </h1>

          <p
            style={{
              opacity: 0.65,
              fontSize: "13px",
              marginTop: "10px",
            }}
          >
            Welcome to the Capy Garden!
          </p>
        </div>

        {/* SCORE PANEL */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "15px",
            marginBottom: "18px",
          }}
        >
          <div
            className="dashboard-glass-card"
            style={{
              padding: "18px",
              borderRadius: "18px",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                opacity: 0.55,
                letterSpacing: "2px",
              }}
            >
              CURRENT SCORE
            </p>

            <h2 style={{ fontSize: "30px", marginTop: "5px" }}>
              {score}
            </h2>
          </div>

          <div
            className="dashboard-glass-card"
            style={{
              padding: "18px",
              borderRadius: "18px",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                opacity: 0.55,
                letterSpacing: "2px",
              }}
            >
              PERSONAL BEST
            </p>

            <h2 style={{ fontSize: "30px", marginTop: "5px" }}>
              {bestScore}
            </h2>
          </div>

          <div
            className="dashboard-glass-card"
            style={{
              padding: "18px",
              borderRadius: "18px",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                opacity: 0.55,
                letterSpacing: "2px",
              }}
            >
              CURRENT LEVEL
            </p>

            <h2 style={{ fontSize: "30px", marginTop: "5px" }}>
              {level}
            </h2>
          </div>
        </div>

        {/* GAME BOARD */}

        <div
          className="dashboard-glass-card"
          style={{
            padding: "12px",
            borderRadius: "24px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "min(65vw, 540px)",
              minHeight: "320px",
              position: "relative",
              borderRadius: "16px",
              overflow: "hidden",
              background: "#a6d78c",
            }}
          >
            <Canvas
              camera={{
                position: [0, 17, 17],
                fov: 38,
                near: 0.1,
                far: 100,
              }}
              shadows
              dpr={[1, 1.5]}
            >
              <GameScene
                snake={snake}
                food={food}
                direction={direction}
                bombs={bombs}
                eatVersion={eatVersion}
                movementDuration={gameSpeed}
              />
            </Canvas>

            {/* LEVEL FLASH */}

            {levelFlash && (
              <div className="arcade-level-flash">
                <div className="level-flash-content">
                  <span>🌟 GREAT JOB, CAPY!</span>

                  <h2>LEVEL {level}</h2>

                  <p>THE GARDEN IS GETTING FASTER!</p>               </div>
              </div>
            )}

            {/* START SCREEN */}

            {!running && !gameOver && !levelFlash && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  padding: "20px",
                  background: "rgba(30,55,27,0.62)",
                  backdropFilter: "blur(7px)",
                }}
              >
                <div style={{ fontSize: "55px" }}>🦫</div>

                <h2
                  style={{
                    fontSize: "28px",
                    marginTop: "10px",
                  }}
                >
                  {hasPlayed
                    ? "Take your time, Capy!"
                    : "Welcome to the Garden!"}
                </h2>

                <p
                  style={{
                    opacity: 0.85,
                    fontSize: "13px",
                    marginTop: "10px",
                    maxWidth: "330px",
                    lineHeight: 1.7,
                  }}
                >
                  Collect oranges, grow your capybara, and
                  watch out for the bombs!
                </p>

                <button
                  onClick={startGame}
                  className="dashboard-action-button"
                  style={{
                    marginTop: "22px",
                    padding: "14px 30px",
                    borderRadius: "25px",
                    border: "1px solid rgba(238,229,216,0.4)",
                    background: "rgba(203,187,166,0.25)",
                    color: "#eee5d8",
                    cursor: "pointer",
                    fontWeight: 700,
                    letterSpacing: "1px",
                  }}
                >
                  {hasPlayed
                    ? "RESUME GAME ↗"
                    : "START GAME ↗"}
                </button>
              </div>
            )}

            {/* GAME OVER */}

            {gameOver && (
              <div className="arcade-game-over">
                <div className="game-over-content">
                  <div className="game-over-icon">💥</div>

                  <span className="game-over-eyebrow">
                    END OF THE RUN
                  </span>

                  <h2>GAME OVER</h2>

                  <p className="game-over-description">
                    Your capybara had a little accident.
                  </p>

                  <div className="game-over-stats">
                    <div>
                      <span>FINAL SCORE</span>
                      <strong>{score}</strong>
                    </div>

                    <div>
                      <span>PERSONAL BEST</span>
                      <strong>
                        {Math.max(score, bestScore)}
                      </strong>
                    </div>

                    <div>
                      <span>LEVEL REACHED</span>
                      <strong>{level}</strong>
                    </div>
                  </div>

                  <p className="game-over-oranges">
                    🍊 {score / 10} oranges collected
                  </p>

                  {submitting && (
                    <p className="game-over-saving">
                      SAVING YOUR SCORE...
                    </p>
                  )}

                  <div className="game-over-actions">
                    <button
                      onClick={startGame}
                      className="dashboard-action-button"
                    >
                      PLAY AGAIN ↻
                    </button>

                    <button
                      onClick={goBack}
                      className="dashboard-action-button"
                    >
                      DASHBOARD
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GAME CONTROLS */}

        <div
          className="dashboard-glass-card"
          style={{
            marginTop: "18px",
            padding: "22px",
            borderRadius: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "11px",
                letterSpacing: "2px",
                opacity: 0.55,
              }}
            >
              HOW TO PLAY
            </p>

            <p style={{ fontSize: "13px", marginTop: "8px" }}>
              Use <strong>WASD</strong> or{" "}
              <strong>Arrow Keys</strong> to move.
            </p>

            <p
              style={{
                fontSize: "11px",
                opacity: 0.55,
                marginTop: "5px",
              }}
            >
              🍊 Each orange gives you 10 points.
            </p>

            <p
              style={{
                fontSize: "11px",
                opacity: 0.55,
                marginTop: "5px",
              }}
            >
              🌟 Every 10 oranges unlocks a new level.
            </p>

            <p
              style={{
                fontSize: "11px",
                opacity: 0.55,
                marginTop: "5px",
              }}
            >
              💣 Bombs disappear after 10 seconds.
            </p>
          </div>

          {running && (
            <button
              onClick={() => setRunning(false)}
              className="dashboard-action-button"
              style={{
                padding: "12px 22px",
                borderRadius: "25px",
                border: "1px solid rgba(238,229,216,0.3)",
                background: "rgba(255,255,255,0.1)",
                color: "#eee5d8",
                cursor: "pointer",
              }}
            >
              PAUSE GAME
            </button>
          )}
        </div>

        {error && (
          <p
            style={{
              color: "#ffaaaa",
              fontSize: "12px",
              marginTop: "12px",
            }}
          >
            {error}
          </p>
        )}

        {/* LEADERBOARD */}

        <div
          className="dashboard-glass-card"
          style={{
            marginTop: "24px",
            padding: "28px",
            borderRadius: "24px",
          }}
        >
          <span className="eyebrow">THE CAPY CLUB</span>

          <h2
            style={{
              fontSize: "25px",
              marginTop: "10px",
            }}
          >
            Global Leaderboard 🏆
          </h2>

          <p
            style={{
              fontSize: "12px",
              opacity: 0.6,
              marginTop: "7px",
            }}
          >
            The top 10 capybara champions.
          </p>

          <div style={{ marginTop: "22px" }}>
            {leaderboard.length === 0 ? (
              <p style={{ fontSize: "13px", opacity: 0.6 }}>
                No scores yet. Be the first champion!
              </p>
            ) : (
              leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "15px 12px",
                    borderBottom:
                      index === leaderboard.length - 1
                        ? "none"
                        : "1px solid rgba(238,229,216,0.1)",
                    background:
                      index === 0
                        ? "rgba(203,187,166,0.1)"
                        : "transparent",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "13px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "17px",
                        width: "25px",
                      }}
                    >
                      {["🥇", "🥈", "🥉"][index] ||
                        `#${index + 1}`}
                    </span>

                    <div>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        {entry.user?.name ||
                          entry.user?.username ||
                          "Player"}
                      </p>

                      <p
                        style={{
                          fontSize: "10px",
                          opacity: 0.5,
                        }}
                      >
                        @{entry.user?.username}
                      </p>
                    </div>
                  </div>

                  <strong style={{ fontSize: "16px" }}>
                    {entry.highScore} pts
                  </strong>
                </div>
              ))
            )}
          </div>

          <button
            onClick={fetchLeaderboard}
            className="dashboard-action-button"
            style={{
              marginTop: "20px",
              padding: "11px 20px",
              borderRadius: "25px",
              border: "1px solid rgba(238,229,216,0.3)",
              background: "rgba(255,255,255,0.08)",
              color: "#eee5d8",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            REFRESH LEADERBOARD ↻
          </button>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: "10px",
            opacity: 0.4,
            letterSpacing: "2px",
            marginTop: "30px",
          }}
        >
          STAY CHILL. STAY CAPY. 🧡
        </p>
      </section>
    </main>
  );
}

useGLTF.preload("/models/Capybara.glb");
