
"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const BIRD_X = -3.5;
const PIPE_SPEED = 4.5;
const PIPE_GAP = 3.0;
const PIPE_HEIGHT = 7;

const PIPE_STARTS = [7, 14, 21];
const PIPE_GAPS = [0.2, -0.5, 0.5];

type LeaderboardEntry = {
  id: number;
  highScore: number;
  updatedAt?: string;
  user?: {
    id: number;
    name: string;
    username: string;
  };
};

function getToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

function Capybara() {
  const { scene } = useGLTF("/models/Capybara.glb");

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = bounds.getSize(new THREE.Vector3());

    if (size.y > 0) {
      cloned.scale.setScalar(1.8 / size.y);
    }

    cloned.updateMatrixWorld(true);

    const centeredBounds = new THREE.Box3().setFromObject(cloned);
    const center = centeredBounds.getCenter(new THREE.Vector3());

    cloned.position.set(-center.x, -center.y, -center.z);

    return cloned;
  }, [scene]);

  const frontWing = useRef<THREE.Group>(null);
  const backWing = useRef<THREE.Group>(null);

  useFrame((state) => {
    const flap = Math.sin(state.clock.elapsedTime * 13) * 0.65;

    if (frontWing.current) {
      frontWing.current.rotation.x = flap;
    }

    if (backWing.current) {
      backWing.current.rotation.x = -flap;
    }
  });

  return (
    <group>
      <primitive
        object={model}
        rotation={[0, Math.PI / 2, 0]}
      />

      <group ref={frontWing} position={[0, 0.35, 0.75]}>
        <mesh>
          <sphereGeometry args={[0.42, 16, 12]} />
          <meshStandardMaterial color="#f5ead6" />
        </mesh>

        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[0, -0.15 - i * 0.12, 0.02]}
            rotation={[0, 0, -0.25]}
            scale={[0.22, 0.4, 0.12]}
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#fff8e9" />
          </mesh>
        ))}
      </group>

      <group ref={backWing} position={[0, 0.35, -0.65]}>
        <mesh scale={[0.9, 1, 0.8]}>
          <sphereGeometry args={[0.4, 16, 12]} />
          <meshStandardMaterial color="#e5d4b9" />
        </mesh>
      </group>
    </group>
  );
}

function Cloud({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      <mesh position={[0.65, 0.1, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      <mesh position={[-0.6, 0.05, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      <mesh position={[0.1, 0.4, 0]}>
        <sphereGeometry args={[0.48, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function Mountain({
  position,
  scale,
  color,
}: {
  position: [number, number, number];
  scale: number;
  color: string;
}) {
  return (
    <mesh
      position={position}
      scale={[scale, scale, scale]}
    >
      <coneGeometry args={[2.5, 5, 5]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}

function House({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.3, 1.1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh
        position={[0, 1.35, 0]}
        rotation={[0, Math.PI / 4, 0]}
      >
        <coneGeometry args={[1, 0.9, 4]} />
        <meshStandardMaterial color="#a94e37" />
      </mesh>

      <mesh position={[0, 0.35, 0.51]}>
        <boxGeometry args={[0.3, 0.65, 0.06]} />
        <meshStandardMaterial color="#70452d" />
      </mesh>

      <mesh position={[0.4, 0.75, 0.52]}>
        <boxGeometry args={[0.25, 0.25, 0.05]} />
        <meshStandardMaterial color="#b9e4ed" />
      </mesh>
    </group>
  );
}

function Tree({
  position,
}: {
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1, 8]} />
        <meshStandardMaterial color="#80512e" />
      </mesh>

      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.65, 12, 12]} />
        <meshStandardMaterial color="#438c48" />
      </mesh>
    </group>
  );
}

type GameWorldProps = {
  running: boolean;
  flapSignal: number;
  onScore: () => void;
  onGameOver: () => void;
};

function GameWorld({
  running,
  flapSignal,
  onScore,
  onGameOver,
}: GameWorldProps) {
  const birdRef = useRef<THREE.Group>(null);
  const pipeRefs = useRef<(THREE.Group | null)[]>([]);
  const velocity = useRef(0);
  const lastFlap = useRef(flapSignal);
  const scored = useRef([false, false, false]);
  const gameOver = useRef(false);

  useFrame((_, delta) => {
    if (!running || gameOver.current || !birdRef.current) return;

    const dt = Math.min(delta, 0.05);

    if (flapSignal !== lastFlap.current) {
      velocity.current = 6.5;
      lastFlap.current = flapSignal;
    }

    velocity.current -= 14 * dt;
    birdRef.current.position.y += velocity.current * dt;

    birdRef.current.rotation.z = THREE.MathUtils.lerp(
      birdRef.current.rotation.z,
      THREE.MathUtils.clamp(velocity.current * 0.06, -0.5, 0.5),
      5 * dt
    );

    const birdY = birdRef.current.position.y;

    if (birdY < -3.8 || birdY > 4.8) {
      gameOver.current = true;
      onGameOver();
      return;
    }

    pipeRefs.current.forEach((pipe, index) => {
      if (!pipe) return;

      pipe.position.x -= PIPE_SPEED * dt;

      if (pipe.position.x < -10) {
        pipe.position.x += 21;
        scored.current[index] = false;
      }

      const distanceX = Math.abs(pipe.position.x - BIRD_X);
      const gapCenter = PIPE_GAPS[index];

      if (
        distanceX < 1.15 &&
        (birdY > gapCenter + PIPE_GAP / 2 - 0.55 ||
          birdY < gapCenter - PIPE_GAP / 2 + 0.55)
      ) {
        gameOver.current = true;
        onGameOver();
        return;
      }

      if (!scored.current[index] && pipe.position.x < BIRD_X - 1) {
        scored.current[index] = true;
        onScore();
      }
    });
  });

  return (
    <>
      <color attach="background" args={["#9ed5ed"]} />
      <fog attach="fog" args={["#9ed5ed", 18, 40]} />

      <ambientLight intensity={1.5} />

      <directionalLight
        position={[5, 10, 8]}
        intensity={2}
        castShadow
      />

      <Mountain position={[-9, -3.5, -9]} scale={1.8} color="#7baf91" />
      <Mountain position={[-4, -3.5, -10]} scale={2.2} color="#659c82" />
      <Mountain position={[2, -3.5, -10]} scale={2.5} color="#78aa88" />
      <Mountain position={[8, -3.5, -9]} scale={2} color="#63947a" />
      <Mountain position={[13, -3.5, -11]} scale={2.3} color="#80b497" />

      <Cloud position={[-7, 4.5, -7]} scale={1.2} />
      <Cloud position={[-1, 5.2, -8]} scale={0.9} />
      <Cloud position={[6, 4.3, -7]} scale={1.3} />
      <Cloud position={[12, 5.5, -9]} scale={1} />

      <House position={[-7, -3.3, -5]} color="#e9bd83" />
      <House position={[0, -3.3, -5]} color="#e4a58b" />
      <House position={[8, -3.3, -5]} color="#e8d18f" />

      <Tree position={[-5.5, -3.4, -4]} />
      <Tree position={[2, -3.4, -4]} />
      <Tree position={[10, -3.4, -4]} />

      <group ref={birdRef} position={[BIRD_X, 0, 0]}>
        <Suspense fallback={null}>
          <Capybara />
        </Suspense>
      </group>

      {PIPE_STARTS.map((start, index) => {
        const gapCenter = PIPE_GAPS[index];

        return (
          <group
            key={index}
            ref={(element) => {
              pipeRefs.current[index] = element;
            }}
            position={[start, 0, 0]}
          >
            <mesh
              position={[
                0,
                gapCenter + PIPE_GAP / 2 + PIPE_HEIGHT / 2,
                0,
              ]}
              castShadow
            >
              <cylinderGeometry args={[0.8, 0.8, PIPE_HEIGHT, 24]} />
              <meshStandardMaterial color="#398d43" />
            </mesh>

            <mesh
              position={[
                0,
                gapCenter - PIPE_GAP / 2 - PIPE_HEIGHT / 2,
                0,
              ]}
              castShadow
            >
              <cylinderGeometry args={[0.8, 0.8, PIPE_HEIGHT, 24]} />
              <meshStandardMaterial color="#398d43" />
            </mesh>

            <mesh
              position={[0, gapCenter + PIPE_GAP / 2, 0]}
            >
              <cylinderGeometry args={[1.05, 1.05, 0.35, 24]} />
              <meshStandardMaterial color="#286f34" />
            </mesh>

            <mesh
              position={[0, gapCenter - PIPE_GAP / 2, 0]}
            >
              <cylinderGeometry args={[1.05, 1.05, 0.35, 24]} />
              <meshStandardMaterial color="#286f34" />
            </mesh>
          </group>
        );
      })}

      <mesh position={[0, -4.5, 0]}>
        <boxGeometry args={[200, 0.5, 5]} />
        <meshStandardMaterial color="#68a94d" />
      </mesh>
    </>
  );
}

export default function FlappyBaraPage() {
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [flapSignal, setFlapSignal] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const router = useRouter();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  const submittedRef = useRef(false);

  async function loadLeaderboard() {
    const token = getToken();

    if (!token) {
      setLeaderboardError("Please log in to view the leaderboard.");
      setLeaderboardLoading(false);
      return;
    }

    try {
      setLeaderboardLoading(true);
      setLeaderboardError("");

      const response = await fetch(
        `${API_URL}/users/flappy-bara/leaderboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load leaderboard.");
      }

      const data = await response.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (error) {
      setLeaderboardError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLeaderboardLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Automatically submit the score when the game ends.
  useEffect(() => {
    if (status !== "over" || submittedRef.current) return;

    submittedRef.current = true;

    async function submitGameScore() {
      const token = getToken();

      if (!token) {
        setSubmitMessage("Please log in to save your score.");
        return;
      }

      try {
        setSubmitting(true);
        setSubmitMessage("");

        const response = await fetch(
          `${API_URL}/users/flappy-bara/leaderboard`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
                 Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ score }),
          }
        );

        if (!response.ok) {
          throw new Error("Your score could not be submitted.");
        }

        const data = await response.json();

        setPersonalBest(data.highScore);

        setSubmitMessage(
          `Score saved! Your personal best is ${data.highScore}.`
        );

        await loadLeaderboard();
      } catch (error) {
        setSubmitMessage(
          error instanceof Error
            ? error.message
            : "Unable to save your score."
        );
      } finally {
        setSubmitting(false);
      }
    }

    submitGameScore();
  }, [status, score]);

  function flapOrStart() {
    if (status === "over") {
      submittedRef.current = false;
      setScore(0);
      setSubmitMessage("");
      setGameKey((value) => value + 1);
      setStatus("playing");
      setFlapSignal((value) => value + 1);
      return;
    }

    if (status === "ready") {
      setStatus("playing");
    }

    setFlapSignal((value) => value + 1);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();

        if (!event.repeat) {
          flapOrStart();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [status]);

  return (
    <main
      className="auth-page"
      style={{
        minHeight: "100vh",
        padding: "30px 20px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* GO BACK TO DASHBOARD */}
      <button
  type="button"
  onClick={() => router.push("/dashboard")}
  style={{
    position: "absolute",
    top: "60px",
    right: "max(20px, calc((100% - 1000px) / 2))",
    zIndex: 100,
    padding: "15px 20px",
    borderRadius: "25px",
    border: "1px solid rgba(238,229,216,0.35)",
    background: "rgba(255,255,255,0.08)",
    color: "#eee5d8",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: 500,
    backdropFilter: "blur(20px)",
  }}
>
  ← DASHBOARD
</button>

      <h1
        style={{
          textAlign: "center",
          fontSize: "42px",
          color: "#eee5d8",
          marginBottom: "20px",
        }}
      >
        Flappy-Bara 🐹
      </h1>

      <div
        className="dashboard-glass-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1000px",
          height: "550px",
          margin: "0 auto",
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        <Canvas
          camera={{
            position: [0, 0, 15],
            fov: 40,
          }}
          shadows
        >
          <GameWorld
            key={gameKey}
            running={status === "playing"}
            flapSignal={flapSignal}
            onScore={() => setScore((value) => value + 1)}
            onGameOver={() => setStatus("over")}
          />
        </Canvas>

        {/* Score */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: 0,
            right: 0,
            textAlign: "center",
            color: "white",
            fontSize: "32px",
            fontWeight: "bold",
            textShadow: "0 2px 5px #333",
            pointerEvents: "none",
          }}
        >
          {score}
        </div>

        {/* Start and Game Over */}
        {status !== "playing" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(35, 25, 18, 0.4)",
              color: "white",
              textAlign: "center",
              gap: "12px",
            }}
          >
            <h2 style={{ fontSize: "36px", fontWeight: "bold" }}>
              {status === "ready" ? "Flappy-Bara!" : "Game Over!"}
            </h2>

            <p style={{ fontSize: "18px" }}>
              {status === "ready"
                ? "Avoid the pipes and fly as far as you can!"
                : `Your Score: ${score}`}
            </p>

            {status === "over" && (
              <p style={{ fontSize: "14px", opacity: 0.9 }}>
                {submitting
                  ? "Saving your score..."
                  : submitMessage}
              </p>
            )}

            <button
              onClick={flapOrStart}
              style={{
                padding: "13px 32px",
                borderRadius: "14px",
                background: "#a6d78c",
                color: "#26351f",
                fontWeight: "bold",
                fontSize: "18px",
                cursor: "pointer",
                border: "none",
              }}
            >
              {status === "ready" ? "START GAME" : "PLAY AGAIN"}
            </button>

            <p style={{ fontSize: "13px", opacity: 0.8 }}>
              Press SPACE or ↑ to flap
            </p>
          </div>
        )}
      </div>

      {/* Mobile FLAP button */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "20px",
        }}
      >
        <button
          onClick={flapOrStart}
          style={{
            width: "180px",
            padding: "16px",
            borderRadius: "16px",
            border: "none",
            background: "#a6d78c",
            color: "#26351f",
            fontSize: "20px",
            fontWeight: "bold",
            cursor: "pointer",
            touchAction: "manipulation",
          }}
        >
          {status === "over" ? "PLAY AGAIN" : "FLAP 🪽"}
        </button>
      </div>

      {/* Personal Best */}
      {personalBest !== null && (
        <div
          className="dashboard-glass-card"
          style={{
            maxWidth: "1000px",
            margin: "25px auto 0",
            padding: "18px",
            borderRadius: "18px",
            textAlign: "center",
            color: "#eee5d8",
          }}
        >
          <p style={{ fontSize: "14px", opacity: 0.7 }}>
            YOUR FLAPPY-BARA PERSONAL BEST
          </p>
          <h2 style={{ fontSize: "30px", fontWeight: "bold" }}>
            🏆 {personalBest}
          </h2>
        </div>
      )}

      {/* Flappy-Bara Leaderboard */}
      <section
        className="dashboard-glass-card"
        style={{
          maxWidth: "1000px",
          margin: "25px auto",
          padding: "25px",
          borderRadius: "22px",
          color: "#eee5d8",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h2 style={{ fontSize: "27px", fontWeight: "bold" }}>
              🏆 Flappy-Bara Leaderboard
            </h2>
            <p style={{ fontSize: "13px", opacity: 0.65 }}>
              Top 10 players with the highest scores
            </p>
          </div>

          <button
            onClick={loadLeaderboard}
            disabled={leaderboardLoading}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(238,229,216,0.2)",
              background: "rgba(238,229,216,0.08)",
              color: "#eee5d8",
              cursor: "pointer",
              opacity: leaderboardLoading ? 0.5 : 1,
            }}
          >
            {leaderboardLoading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>

        {leaderboardLoading ? (
          <p style={{ textAlign: "center", padding: "25px", opacity: 0.7 }}>
            Loading leaderboard...
          </p>
        ) : leaderboardError ? (
          <p style={{ textAlign: "center", padding: "25px", color: "#e9a08b" }}>
            {leaderboardError}
          </p>
        ) : leaderboard.length === 0 ? (
          <p style={{ textAlign: "center", padding: "25px", opacity: 0.7 }}>
            No scores yet. Be the first to fly! 🪽
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "15px 18px",
                  borderRadius: "13px",
                  background:
                    index === 0
                      ? "rgba(246, 201, 103, 0.15)"
                      : "rgba(238, 229, 216, 0.06)",
                  border:
                    index === 0
                      ? "1px solid rgba(246, 201, 103, 0.35)"
                      : "1px solid rgba(238, 229, 216, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      minWidth: "35px",
                    }}
                  >
                    {index === 0
                      ? "🥇"
                      : index === 1
                      ? "🥈"
                      : index === 2
                      ? "🥉"
                      : `#${index + 1}`}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontWeight: "bold",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.user?.name || entry.user?.username || "Player"}
                    </p>
                    <p style={{ fontSize: "12px", opacity: 0.6 }}>
                      @{entry.user?.username || "player"}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: "21px", fontWeight: "bold" }}>
                    {entry.highScore}
                  </p>
                  <p style={{ fontSize: "11px", opacity: 0.6 }}>
                    POINTS
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

useGLTF.preload("/models/Capybara.glb");
