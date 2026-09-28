import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';

type Owner = 'none' | 'player' | 'cpu' | 'flight';
type Difficulty = 1 | 2 | 3;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const flatDistance = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

await RAPIER.init();

const gameRoot = $('#game');
const hud = $('#hud');
const menu = $('#menu');
const tutorialPanel = $('#tutorial-panel');
const messageEl = $('#message');
const statusEl = $('#status');
const clockEl = $('#clock');
const playerScoreEl = $('#player-score');
const cpuScoreEl = $('#cpu-score');
const heatFillEl = $('#heat-fill');
const heatValueEl = $('#heat-value');
const shotMeterEl = $('#shot-meter');
const shotFillEl = shotMeterEl.querySelector('i') as HTMLElement;
const shotNeedleEl = shotMeterEl.querySelector('em') as HTMLElement;
const careerEl = $('#career');

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
gameRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070910);
scene.fog = new THREE.FogExp2(0x070910, 0.018);

const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 120);
camera.position.set(-9, 7, 10);

const hemi = new THREE.HemisphereLight(0x9bb8ff, 0x26120b, 1.65);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(-4, 13, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -18;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 12;
keyLight.shadow.camera.bottom = -12;
scene.add(keyLight);
const redLight = new THREE.PointLight(0xff2448, 22, 24, 2);
redLight.position.set(0, 6, -6);
scene.add(redLight);

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 60;

const court = new THREE.Group();
scene.add(court);

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, cast = false, receive = false) {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = cast;
  item.receiveShadow = receive;
  return item;
}

const floorMat = new THREE.MeshStandardMaterial({ color: 0xa95328, roughness: 0.48, metalness: 0.04 });
const floor = mesh(new THREE.BoxGeometry(28.8, 0.28, 15.6), floorMat, false, true);
floor.position.y = -0.18;
court.add(floor);

for (let index = 0; index < 16; index += 1) {
  const stripe = mesh(
    new THREE.BoxGeometry(1.78, 0.018, 15),
    new THREE.MeshStandardMaterial({ color: index % 2 ? 0xb96130 : 0x9d4926, roughness: 0.55 }),
  );
  stripe.position.set(-13.35 + index * 1.78, -0.025, 0);
  court.add(stripe);
}

const lineMat = new THREE.MeshBasicMaterial({ color: 0xf6ead7 });
const addLine = (x: number, z: number, width: number, depth: number) => {
  const line = mesh(new THREE.BoxGeometry(width, 0.025, depth), lineMat);
  line.position.set(x, 0.018, z);
  court.add(line);
};
addLine(0, 0, 0.07, 15);
addLine(0, 7.47, 28, 0.07);
addLine(0, -7.47, 28, 0.07);
addLine(13.97, 0, 0.07, 15);
addLine(-13.97, 0, 0.07, 15);

const centerRing = mesh(new THREE.RingGeometry(1.75, 1.82, 64), lineMat);
centerRing.rotation.x = -Math.PI / 2;
centerRing.position.y = 0.024;
court.add(centerRing);

for (const side of [-1, 1]) {
  const key = mesh(
    new THREE.PlaneGeometry(5.8, 4.9),
    new THREE.MeshBasicMaterial({ color: 0x6c1b25, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
  );
  key.rotation.x = -Math.PI / 2;
  key.position.set(side * 11.1, 0.03, 0);
  court.add(key);
  addLine(side * 8.2, 0, 0.07, 4.9);
  addLine(side * 11.08, 2.45, 5.8, 0.07);
  addLine(side * 11.08, -2.45, 5.8, 0.07);
}

const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.2, 0));
world.createCollider(RAPIER.ColliderDesc.cuboid(14.4, 0.15, 7.8).setFriction(0.86).setRestitution(0.64), groundBody);

const hoopCenters = {
  left: new THREE.Vector3(-12.55, 3.05, 0),
  right: new THREE.Vector3(12.55, 3.05, 0),
};

function buildHoop(side: -1 | 1) {
  const group = new THREE.Group();
  const x = side * 13.25;
  const supportMat = new THREE.MeshStandardMaterial({ color: 0x222732, metalness: 0.8, roughness: 0.3 });
  const boardMat = new THREE.MeshPhysicalMaterial({ color: 0xdce9f4, transparent: true, opacity: 0.72, roughness: 0.12 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xff3a24, roughness: 0.35, metalness: 0.5 });
  const pole = mesh(new THREE.CylinderGeometry(0.13, 0.18, 4.3, 16), supportMat, true);
  pole.position.set(side * 0.55, 1.9, 0);
  group.add(pole);
  const board = mesh(new THREE.BoxGeometry(0.12, 1.15, 1.95), boardMat, true);
  board.position.set(0, 3.35, 0);
  group.add(board);
  const rim = mesh(new THREE.TorusGeometry(0.46, 0.055, 12, 32), rimMat, true);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-side * 0.7, 3.05, 0);
  group.add(rim);
  const netMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f4, wireframe: true, transparent: true, opacity: 0.48 });
  const net = mesh(new THREE.CylinderGeometry(0.43, 0.28, 0.72, 12, 5, true), netMat);
  net.position.set(-side * 0.7, 2.68, 0);
  group.add(net);
  group.position.x = x;
  court.add(group);

  const boardBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 3.35, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.07, 0.58, 0.98).setRestitution(0.56), boardBody);
  const center = side === 1 ? hoopCenters.right : hoopCenters.left;
  for (let index = 0; index < 14; index += 1) {
    const angle = index / 14 * Math.PI * 2;
    const rimBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(
      center.x + Math.cos(angle) * 0.46,
      center.y,
      Math.sin(angle) * 0.46,
    ));
    world.createCollider(RAPIER.ColliderDesc.ball(0.07).setRestitution(0.72), rimBody);
  }
}
buildHoop(-1);
buildHoop(1);

const standsMat = new THREE.MeshStandardMaterial({ color: 0x171c27, roughness: 0.9 });
for (const z of [-9.2, 9.2]) {
  for (let row = 0; row < 4; row += 1) {
    const stand = mesh(new THREE.BoxGeometry(30, 0.45 + row * 0.28, 0.9), standsMat, false, true);
    stand.position.set(0, row * 0.36, z + Math.sign(z) * row * 0.82);
    court.add(stand);
  }
}

function createPlayer(color: number, accent: number) {
  const group = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.62 });
  const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.52 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x7b442c, roughness: 0.8 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.55 });
  const torso = mesh(new THREE.CapsuleGeometry(0.38, 0.66, 4, 10), uniform, true);
  torso.position.y = 1.35;
  group.add(torso);
  const chest = mesh(new THREE.BoxGeometry(0.58, 0.08, 0.42), trim, true);
  chest.position.set(0, 1.48, 0.1);
  group.add(chest);
  const head = mesh(new THREE.SphereGeometry(0.25, 16, 12), skin, true);
  head.position.y = 2.12;
  group.add(head);
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.09, 0.62, 3, 8), skin, true);
    arm.position.set(side * 0.46, 1.38, 0);
    arm.rotation.z = side * 0.16;
    arm.name = side === 1 ? 'rightArm' : 'leftArm';
    group.add(arm);
    const leg = mesh(new THREE.CapsuleGeometry(0.12, 0.72, 3, 8), skin, true);
    leg.position.set(side * 0.2, 0.55, 0);
    group.add(leg);
    const shoe = mesh(new THREE.BoxGeometry(0.25, 0.16, 0.45), shoes, true);
    shoe.position.set(side * 0.2, 0.1, 0.1);
    group.add(shoe);
  }
  group.userData.uniform = uniform;
  group.userData.baseColor = color;
  return group;
}

const player = createPlayer(0xb4152c, 0xffffff);
const cpu = createPlayer(0x1f4fc4, 0xffffff);
player.position.set(-6, 0, 0);
cpu.position.set(6, 0, 0);
player.rotation.y = Math.PI / 2;
cpu.rotation.y = -Math.PI / 2;
scene.add(player, cpu);

const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xe96820, roughness: 0.72 });
const ball = mesh(new THREE.SphereGeometry(0.24, 24, 16), ballMaterial, true);
scene.add(ball);
const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x2b1008 });
for (const rotation of [new THREE.Euler(0, 0, 0), new THREE.Euler(Math.PI / 2, 0, 0)]) {
  const seam = mesh(new THREE.TorusGeometry(0.242, 0.012, 6, 32), seamMaterial);
  seam.rotation.copy(rotation);
  ball.add(seam);
}

const ballBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.32, 0).setLinearDamping(0.12).setAngularDamping(0.08),
);
world.createCollider(RAPIER.ColliderDesc.ball(0.24).setDensity(0.62).setRestitution(0.76).setFriction(0.72), ballBody);

let gameRunning = false;
let owner: Owner = 'none';
let difficulty: Difficulty = 2;
let timeRemaining = 90;
let playerScore = 0;
let cpuScore = 0;
let heat = 0;
let hotTimer = 0;
let charging = false;
let charge = 0;
let jumpTime = 0;
let dashTime = 0;
let switchStyle = 0;
let messageTimer = 0;
let cpuDecisionTimer = 0;
let resetTimer = -1;
let goldenPoint = false;
let shotBy: 'player' | 'cpu' = 'player';
let shotInFlight = false;
let previousBallY = 0;
let dunk: null | { elapsed: number; start: THREE.Vector3 } = null;
let wins = Number(localStorage.getItem('fc3d-wins') || 0);
let coins = Number(localStorage.getItem('fc3d-coins') || 0);
const keys = new Set<string>();
const clock = new THREE.Clock();
const temp = new THREE.Vector3();

function setMessage(text: string, duration = 1) {
  messageEl.textContent = text;
  messageTimer = duration;
}

function setBallEnabled(enabled: boolean) {
  ballBody.setEnabled(enabled);
  if (!enabled) ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
}

function claimBall(nextOwner: 'player' | 'cpu') {
  if (owner !== 'none') return;
  owner = nextOwner;
  shotInFlight = false;
  setBallEnabled(false);
  setMessage(nextOwner === 'player' ? '공을 잡았습니다' : 'CPU가 공을 잡았습니다');
}

function releaseShot(by: 'player' | 'cpu', power: number, forcedDunk = false) {
  const actor = by === 'player' ? player : cpu;
  const target = by === 'player' ? hoopCenters.right : hoopCenters.left;
  const distance = flatDistance(actor.position, target);
  if (forcedDunk && distance > 2.25) {
    setMessage('덩크는 골대 가까이에서 가능합니다');
    return;
  }
  if (forcedDunk) {
    dunk = { elapsed: 0, start: actor.position.clone() };
    shotBy = 'player';
    owner = 'flight';
    setMessage('덩크!');
    return;
  }
  owner = 'flight';
  shotBy = by;
  shotInFlight = true;
  setBallEnabled(true);
  const start = actor.position.clone().add(new THREE.Vector3(by === 'player' ? 0.4 : -0.4, 1.75, 0));
  ballBody.setTranslation(start, true);
  ball.position.copy(start);
  const timingError = Math.abs(power - 0.72);
  const contest = flatDistance(player.position, cpu.position) < 1.45 ? 0.22 : 0;
  const difficultyError = by === 'cpu' ? (3 - difficulty) * 0.06 : 0;
  const error = Math.max(0, timingError - 0.08) * 2.2 + contest + difficultyError;
  const missSide = (Math.random() - 0.5) * error;
  const aim = target.clone().add(new THREE.Vector3(0, 0.18 + (Math.random() - 0.5) * error * 0.35, missSide));
  const flight = clamp(distance / 10.5, 0.62, 1.18);
  const delta = aim.sub(start);
  ballBody.setLinvel({
    x: delta.x / flight,
    y: (delta.y + 4.905 * flight * flight) / flight,
    z: delta.z / flight,
  }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: by === 'player' ? -11 : 11 }, true);
  previousBallY = start.y;
  setMessage(distance > 7.3 ? '3점슛!' : distance < 2.8 ? '레이업!' : '점프슛!');
}

function resetTipOff() {
  owner = 'none';
  shotInFlight = false;
  charging = false;
  charge = 0;
  dunk = null;
  resetTimer = -1;
  player.position.set(-6, 0, 0);
  cpu.position.set(6, 0, 0);
  setBallEnabled(true);
  ballBody.setTranslation({ x: 0, y: 0.34, z: 0 }, true);
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  setMessage('센터의 공을 먼저 잡으세요', 1.2);
}

function startGame() {
  gameRunning = true;
  timeRemaining = 90;
  playerScore = 0;
  cpuScore = 0;
  heat = 0;
  hotTimer = 0;
  goldenPoint = false;
  menu.classList.add('hidden');
  tutorialPanel.classList.add('hidden');
  hud.classList.remove('hidden');
  resetTipOff();
  setMessage('TIP OFF!', 1.1);
}

function endGame() {
  gameRunning = false;
  if (playerScore > cpuScore) {
    wins += 1;
    coins += 25 + difficulty * 10;
  } else {
    coins += 5;
  }
  localStorage.setItem('fc3d-wins', String(wins));
  localStorage.setItem('fc3d-coins', String(coins));
  careerEl.textContent = `통산 ${wins}승 · 코인 ${coins}`;
  menu.querySelector('p')!.textContent = playerScore > cpuScore
    ? `${playerScore} : ${cpuScore} 승리! 다시 도전하시겠습니까?`
    : `${playerScore} : ${cpuScore} 경기 종료 · 다시 도전하세요`;
  menu.classList.remove('hidden');
  hud.classList.add('hidden');
}

function scoreBasket(by: 'player' | 'cpu') {
  const target = by === 'player' ? hoopCenters.right : hoopCenters.left;
  const distance = flatDistance(by === 'player' ? player.position : cpu.position, target);
  const points = distance > 7.2 ? 3 : 2;
  if (by === 'player') {
    playerScore += points;
    heat = clamp(heat + (dunk ? 34 : 25), 0, 100);
  } else cpuScore += points;
  shotInFlight = false;
  setMessage(`${points}점 성공!`, 1.2);
  if (goldenPoint) {
    setTimeout(endGame, 700);
    return;
  }
  resetTimer = 1.15;
  owner = 'flight';
}

function activateHeat() {
  if (heat < 100) {
    setMessage(`HEAT ${Math.round(heat)}%`);
    return;
  }
  heat = 0;
  hotTimer = 7;
  setMessage('ON FIRE! 속도와 슛 정확도 상승', 1.5);
}

function attemptDefense() {
  if (owner === 'cpu' && flatDistance(player.position, cpu.position) < 1.35) {
    const chance = difficulty === 1 ? 0.72 : difficulty === 2 ? 0.56 : 0.42;
    if (Math.random() < chance) {
      owner = 'player';
      heat = clamp(heat + 20, 0, 100);
      setBallEnabled(false);
      setMessage('스틸 성공!');
    } else setMessage('스틸 실패');
  } else if (owner === 'flight' && shotBy === 'cpu' && flatDistance(player.position, cpu.position) < 1.65) {
    const velocity = ballBody.linvel();
    ballBody.setLinvel({ x: velocity.x, y: Math.min(velocity.y, -1), z: velocity.z + 2.1 }, true);
    heat = clamp(heat + 16, 0, 100);
    shotInFlight = false;
    setMessage('블록!');
  } else setMessage('수비 자세');
}

function updateDunk(dt: number) {
  if (!dunk) return;
  dunk.elapsed += dt;
  const t = clamp(dunk.elapsed / 0.8, 0, 1);
  const destination = new THREE.Vector3(11.72, 0, clamp(player.position.z, -0.35, 0.35));
  player.position.lerpVectors(dunk.start, destination, Math.sin(t * Math.PI * 0.5));
  const lift = Math.sin(t * Math.PI) * 1.05;
  player.position.y = lift;
  ball.position.copy(player.position).add(new THREE.Vector3(0.42, 1.65 + lift * 0.22, 0));
  if (t >= 0.7 && !shotInFlight) {
    setBallEnabled(true);
    ballBody.setTranslation({ x: hoopCenters.right.x, y: 3.58, z: 0 }, true);
    ballBody.setLinvel({ x: 0, y: -2.2, z: 0 }, true);
    ballBody.setAngvel({ x: 0, y: 0, z: -7 }, true);
    shotInFlight = true;
    previousBallY = 3.58;
  }
  if (t >= 1) {
    player.position.y = 0;
    dunk = null;
  }
}

function updatePlayer(dt: number) {
  if (dunk) return;
  let dx = 0;
  let dz = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dz -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dz += 1;
  const length = Math.hypot(dx, dz) || 1;
  const styleBoost = switchStyle === 1 ? 1.12 : 1;
  const speed = 5.4 * styleBoost * (dashTime > 0 ? 1.85 : 1) * (hotTimer > 0 ? 1.18 : 1) * (charging ? 0.46 : 1);
  player.position.x = clamp(player.position.x + dx / length * speed * dt, -13.1, 13.1);
  player.position.z = clamp(player.position.z + dz / length * speed * dt, -6.8, 6.8);
  if (dx || dz) player.rotation.y = Math.atan2(dx, dz);
  if (jumpTime > 0) {
    jumpTime = Math.max(0, jumpTime - dt);
    player.position.y = Math.sin((1 - jumpTime / 0.62) * Math.PI) * 0.86;
  } else player.position.y = 0;
}

function updateCPU(dt: number) {
  cpuDecisionTimer -= dt;
  const target = temp;
  if (owner === 'none') target.copy(ball.position);
  else if (owner === 'player') target.copy(player.position).add(new THREE.Vector3(0.85, 0, Math.sin(performance.now() * 0.002) * 0.7));
  else if (owner === 'cpu') target.set(-10.8, 0, Math.sin(performance.now() * 0.0016) * 2.1);
  else return;
  const direction = target.sub(cpu.position);
  direction.y = 0;
  if (direction.lengthSq() > 0.08) {
    direction.normalize();
    const speed = difficulty === 1 ? 3.6 : difficulty === 2 ? 4.4 : 5.15;
    cpu.position.addScaledVector(direction, speed * dt);
    cpu.rotation.y = Math.atan2(direction.x, direction.z);
  }
  cpu.position.x = clamp(cpu.position.x, -13.1, 13.1);
  cpu.position.z = clamp(cpu.position.z, -6.8, 6.8);
  if (owner === 'player' && flatDistance(player.position, cpu.position) < 1.05 && cpuDecisionTimer <= 0) {
    cpuDecisionTimer = 0.75 + Math.random() * 0.5;
    if (Math.random() < (difficulty === 1 ? 0.12 : difficulty === 2 ? 0.24 : 0.36)) {
      owner = 'cpu';
      setBallEnabled(false);
      setMessage('CPU 스틸!');
    }
  }
  if (owner === 'cpu' && flatDistance(cpu.position, hoopCenters.left) < 3.25 && cpuDecisionTimer <= 0) {
    cpuDecisionTimer = 1.1;
    releaseShot('cpu', 0.72 + (Math.random() - 0.5) * (difficulty === 3 ? 0.12 : 0.3));
  }
}

function updateBall(dt: number) {
  if (owner === 'player' && !dunk) {
    const bounce = Math.abs(Math.sin(performance.now() * 0.0065));
    ball.position.copy(player.position).add(new THREE.Vector3(0.48, 0.28 + bounce * 0.75, 0.18));
  } else if (owner === 'cpu') {
    const bounce = Math.abs(Math.sin(performance.now() * 0.0062));
    ball.position.copy(cpu.position).add(new THREE.Vector3(-0.48, 0.28 + bounce * 0.75, 0.18));
  } else if (!dunk) {
    const translation = ballBody.translation();
    ball.position.set(translation.x, translation.y, translation.z);
    const rotation = ballBody.rotation();
    ball.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
  if (owner === 'none') {
    if (flatDistance(player.position, ball.position) < 0.9) claimBall('player');
    else if (flatDistance(cpu.position, ball.position) < 0.9) claimBall('cpu');
  }
  if (shotInFlight) {
    const target = shotBy === 'player' ? hoopCenters.right : hoopCenters.left;
    const passedDown = previousBallY > target.y && ball.position.y <= target.y;
    if (passedDown && Math.hypot(ball.position.x - target.x, ball.position.z - target.z) < 0.48) scoreBasket(shotBy);
    previousBallY = ball.position.y;
    if (ball.position.y < 0.42 && ballBody.linvel().y < 0.8) {
      shotInFlight = false;
      owner = 'none';
      setMessage('리바운드!');
    }
  }
  ball.rotation.z -= dt * 2.4;
}

function updateCamera(dt: number) {
  const direction = owner === 'cpu' ? -1 : 1;
  const desired = new THREE.Vector3(player.position.x - direction * 6.6, 5.7, player.position.z + 7.7);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
  const look = player.position.clone().lerp(cpu.position, 0.28);
  look.y = 1.15;
  camera.lookAt(look);
}

function updateHUD() {
  playerScoreEl.textContent = String(playerScore);
  cpuScoreEl.textContent = String(cpuScore);
  const seconds = Math.max(0, Math.ceil(timeRemaining));
  clockEl.textContent = goldenPoint ? 'GOLDEN' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  statusEl.textContent = owner === 'player' ? 'YOUR BALL' : owner === 'cpu' ? 'DEFENSE' : owner === 'flight' ? 'SHOT' : 'LOOSE BALL';
  heatFillEl.style.width = `${heat}%`;
  heatValueEl.textContent = hotTimer > 0 ? 'ON FIRE' : `${Math.round(heat)}%`;
  shotMeterEl.classList.toggle('hidden', !charging);
  shotFillEl.style.width = `${charge * 100}%`;
  shotNeedleEl.style.left = `${charge * 100}%`;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (gameRunning) {
    world.timestep = dt;
    world.step();
    timeRemaining -= dt;
    messageTimer = Math.max(0, messageTimer - dt);
    dashTime = Math.max(0, dashTime - dt);
    hotTimer = Math.max(0, hotTimer - dt);
    if (charging) charge = (charge + dt * 0.72) % 1;
    if (resetTimer >= 0) {
      resetTimer -= dt;
      if (resetTimer <= 0) resetTipOff();
    } else {
      updatePlayer(dt);
      updateCPU(dt);
      updateDunk(dt);
      updateBall(dt);
    }
    if (messageTimer === 0) messageEl.textContent = owner === 'player' ? '오른쪽 골대를 공격하세요' : owner === 'cpu' ? '상대를 막으세요' : '공을 잡으세요';
    if (timeRemaining <= 0 && !goldenPoint) {
      timeRemaining = 0;
      if (playerScore === cpuScore) {
        goldenPoint = true;
        setMessage('GOLDEN POINT · 다음 득점이 승리!', 2);
      } else endGame();
    }
    updateHUD();
  } else {
    camera.position.x = Math.sin(performance.now() * 0.00016) * 16;
    camera.position.y = 8;
    camera.position.z = Math.cos(performance.now() * 0.00016) * 16;
    camera.lookAt(0, 0.9, 0);
  }
  updateCamera(gameRunning ? dt : 0);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (event.repeat) return;
  keys.add(key);
  if (!gameRunning && event.key === 'Enter' && tutorialPanel.classList.contains('hidden')) startGame();
  if (!gameRunning) return;
  if (key === 'j' && owner === 'player') {
    charging = true;
    charge = 0;
    setMessage('초록 구간에서 J를 놓으세요', 10);
  }
  if (key === ' ') jumpTime = jumpTime > 0 ? jumpTime : 0.62;
  if (key === 'k' || key === 'shift') dashTime = 0.26;
  if (key === 's' && !keys.has('arrowdown')) attemptDefense();
  if (key === 'z' && owner === 'player') releaseShot('player', 0.72, true);
  if (key === 'l') activateHeat();
  if (key === 'i' && owner !== 'flight') {
    switchStyle = 1 - switchStyle;
    const uniform = player.userData.uniform as THREE.MeshStandardMaterial;
    uniform.color.setHex(switchStyle ? 0xf0a11e : player.userData.baseColor);
    setMessage(switchStyle ? 'FLASH · 빠른 돌파' : 'ACE · 균형형');
  }
});

addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys.delete(key);
  if (key === 'j' && charging) {
    charging = false;
    releaseShot('player', charge);
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
  button.addEventListener('click', () => {
    difficulty = Number(button.dataset.level) as Difficulty;
    localStorage.setItem('fc3d-difficulty', String(difficulty));
    document.querySelectorAll('[data-level]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
}

difficulty = clamp(Number(localStorage.getItem('fc3d-difficulty') || 2), 1, 3) as Difficulty;
document.querySelectorAll('[data-level]').forEach((item) => item.classList.toggle('active', Number((item as HTMLElement).dataset.level) === difficulty));
careerEl.textContent = `통산 ${wins}승 · 코인 ${coins}`;
$('#start').addEventListener('click', startGame);
$('#tutorial').addEventListener('click', () => tutorialPanel.classList.remove('hidden'));
$('#close-tutorial').addEventListener('click', () => tutorialPanel.classList.add('hidden'));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
