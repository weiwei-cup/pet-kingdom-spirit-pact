"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";

type Phase =
  | "title"
  | "name"
  | "shelter"
  | "road"
  | "capture"
  | "city"
  | "exam"
  | "festival"
  | "rupture"
  | "boss"
  | "aftermath"
  | "ending";

type PartnerId = "leaf" | "metal" | "tide";
type PetArtId = PartnerId | "wild" | "bird" | "guardian";
type CharacterVariant = "player" | "keeper" | "noah" | "jingjing" | "sergi" | "angela";
type Position = { x: number; y: number };
type SaveData = { phase: Phase; playerName: string; partnerId: PartnerId | null; captured: boolean };

type Partner = {
  id: PartnerId;
  name: string;
  kind: string;
  nature: string;
  quote: string;
  color: string;
  hp: number;
  attack: string;
  support: string;
};

type DialogueLine = {
  speaker: string;
  role?: string;
  text: string;
  tone?: "normal" | "warning" | "soft";
};

const SAVE_KEY = "pet-kingdom-spirit-pact-prologue-v1";

const PARTNERS: Record<PartnerId, Partner> = {
  leaf: {
    id: "leaf",
    name: "叶团子",
    kind: "植物系",
    nature: "胆小 · 体贴",
    quote: "躲在叶筐里，只肯把果子分给信任的人。",
    color: "#62a86f",
    hp: 66,
    attack: "芽叶拍击",
    support: "新芽守护",
  },
  metal: {
    id: "metal",
    name: "铆钉狐",
    kind: "金属系",
    nature: "骄傲 · 可靠",
    quote: "会向每个靠近的人挑战，却悄悄守着照护所的大门。",
    color: "#8397a8",
    hp: 58,
    attack: "银尾突进",
    support: "反光甲片",
  },
  tide: {
    id: "tide",
    name: "潮尾獭",
    kind: "海洋系",
    nature: "顽皮 · 好奇",
    quote: "把推荐信藏进水桶，只为看看你会不会追上来。",
    color: "#4f9eb7",
    hp: 62,
    attack: "潮泡连弹",
    support: "清凉水幕",
  },
};

const PET_ART: Record<PetArtId, string> = {
  leaf: "./pixel/pet-leaf.png?v=2",
  metal: "./pixel/pet-metal.png?v=2",
  tide: "./pixel/pet-tide.png?v=2",
  wild: "./pixel/pet-wild.png?v=2",
  bird: "./pixel/pet-bird.png?v=2",
  guardian: "./pixel/pet-guardian.png?v=2",
};

const CHARACTER_ART: Record<CharacterVariant, string> = {
  player: "./pixel/character-player.png?v=2",
  keeper: "./pixel/character-keeper.png?v=2",
  noah: "./pixel/character-noah.png?v=2",
  jingjing: "./pixel/character-jingjing.png?v=2",
  sergi: "./pixel/character-sergi.png?v=2",
  angela: "./pixel/character-angela.png?v=2",
};

const SCENE_ART: Record<Phase, string> = {
  title: "./pixel/title-landscape.webp?v=2",
  name: "./pixel/shelter-interior.webp?v=2",
  shelter: "./pixel/shelter-interior.webp?v=2",
  road: "./pixel/route-map.webp?v=2",
  capture: "./pixel/route-map.webp?v=2",
  city: "./pixel/rainbow-plaza.webp?v=2",
  exam: "./pixel/academy-arena.webp?v=2",
  festival: "./pixel/rainbow-plaza.webp?v=2",
  rupture: "./pixel/rainbow-plaza.webp?v=2",
  boss: "./pixel/spirit-sanctum.webp?v=2",
  aftermath: "./pixel/spirit-sanctum.webp?v=2",
  ending: "./pixel/title-landscape.webp?v=2",
};

const FESTIVAL_HEROES: Array<{ name: string; variant: CharacterVariant }> = [
  { name: "晶晶", variant: "jingjing" },
  { name: "帅帅", variant: "player" },
  { name: "卢克", variant: "noah" },
  { name: "米罗", variant: "angela" },
  { name: "塞其", variant: "sergi" },
];

const FESTIVAL_LINES: DialogueLine[] = [
  { speaker: "塞其", role: "现任黄金训练师", text: "欢迎来到彩虹学院。今天之后，你们之中会有人第一次与宠物立下灵契。" },
  { speaker: "帅帅", role: "前代黄金训练师", text: "先说好，考核输给姐姐不丢人——我小时候也只输过那么一点点。" },
  { speaker: "晶晶", role: "训练师协会会长", text: "是每一次都输。还有，别教坏新人。" },
  { speaker: "卢克", role: "金属地区代表", text: "五座旧国的共鸣灯已经点亮。仪式可以开始了。" },
  { speaker: "米罗", role: "宠物小村守望者", text: "奇怪……从刚才开始，宠物们都在看神殿的方向。" },
  { speaker: "塞其", text: "以万灵晶核为证——愿每一份选择，都被世界听见。", tone: "soft" },
  { speaker: "？？？", text: "归零程序，启动。", tone: "warning" },
];

const AFTERMATH_LINES: DialogueLine[] = [
  { speaker: "旁白", text: "守护宠物恢复意识的同一刻，彩虹神殿传来一声巨响。" },
  { speaker: "安琪儿", role: "调查员", text: "塞其，别让他们重新连接共鸣台。三年前我们打败的，从来都不是幕后的人。", tone: "warning" },
  { speaker: "塞其", text: "安琪儿，把晶核放下。至少告诉我，你看见了谁。" },
  { speaker: "安琪儿", text: "现在说出来，只会让真正的内应知道我们掌握了多少。" },
  { speaker: "旁白", text: "她跃上飞行宠物，带着破裂的万灵晶核消失在云层中。学院随后公布证据，将她列为首要嫌疑人。" },
  { speaker: "塞其", text: "我会在所有人面前追捕她。但你看见了守护宠物的记忆——去东之高原，找到那枚黑色铃铛。" },
  { speaker: "塞其", text: "还有一件事：不要让任何人替你的伙伴补办灵契登记。包括我。", tone: "soft" },
  { speaker: "安琪儿的残影", text: "如果你听见这段记忆，说明还有一种灵契没有被他们控制。不要把晶核交给任何人。", tone: "warning" },
];

const MEMORY_TEXT = [
  "幼年的塞其曾在雨中抱住受伤的白裂狮。",
  "黑色手套把一枚铃铛装进共鸣台下方。",
  "安琪儿冲进神殿，她是在阻止仪式。",
];

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function PetSprite({ id, size = "md", sleeping = false, glitched = false }: { id: PetArtId; size?: "sm" | "md" | "lg" | "xl"; sleeping?: boolean; glitched?: boolean }) {
  return (
    <div className={`pet-sprite pet-${id} pet-${size}${sleeping ? " sleeping" : ""}${glitched ? " glitched" : ""}`} aria-hidden="true">
      <i className="sprite-shadow" />
      <img src={PET_ART[id]} alt="" draggable={false} />
      {sleeping && <b className="sleep-mark">z</b>}
    </div>
  );
}

function Character({ name, variant = "player", small = false }: { name: string; variant?: CharacterVariant; small?: boolean }) {
  return (
    <div className={`character character-${variant}${small ? " character-small" : ""}`} aria-label={name}>
      <i className="sprite-shadow" />
      <img src={CHARACTER_ART[variant]} alt="" draggable={false} />
    </div>
  );
}

function Meter({ value, max, kind = "hp" }: { value: number; max: number; kind?: "hp" | "calm" | "memory" }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`meter meter-${kind}`}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}

function Dialogue({ lines, onComplete, backdrop }: { lines: DialogueLine[]; onComplete: () => void; backdrop?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const line = lines[index];
  const next = useCallback(() => {
    if (index >= lines.length - 1) onComplete();
    else setIndex((current) => current + 1);
  }, [index, lines.length, onComplete]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next]);

  return (
    <section className="dialogue-scene">
      <div className="dialogue-backdrop">{backdrop}</div>
      <div className={`dialogue-box dialogue-${line.tone ?? "normal"}`} onClick={next} role="button" tabIndex={0} aria-label="继续对话">
        <div className="speaker-seal">{line.speaker.slice(0, 1)}</div>
        <div className="dialogue-copy">
          <div className="speaker-line"><strong>{line.speaker}</strong>{line.role && <span>{line.role}</span>}</div>
          <p>{line.text}</p>
        </div>
        <div className="dialogue-progress"><span>{String(index + 1).padStart(2, "0")}</span> / {String(lines.length).padStart(2, "0")}</div>
        <button type="button" className="dialogue-next" onClick={(event) => { event.stopPropagation(); next(); }} aria-label="下一句">›</button>
      </div>
    </section>
  );
}

function DPad({ onMove, onInteract }: { onMove: (dx: number, dy: number) => void; onInteract: () => void }) {
  return (
    <div className="touch-controls">
      <div className="dpad" aria-label="移动控制">
        <button type="button" onClick={() => onMove(0, -6)} aria-label="向上">▲</button>
        <button type="button" onClick={() => onMove(-6, 0)} aria-label="向左">◀</button>
        <i />
        <button type="button" onClick={() => onMove(6, 0)} aria-label="向右">▶</button>
        <button type="button" onClick={() => onMove(0, 6)} aria-label="向下">▼</button>
      </div>
      <button type="button" className="interact-button" onClick={onInteract}><span>E</span>互动</button>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("title");
  const [playerName, setPlayerName] = useState("小澈");
  const [draftName, setDraftName] = useState("小澈");
  const [partnerId, setPartnerId] = useState<PartnerId | null>(null);
  const [saveAvailable, setSaveAvailable] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState("沿着石径前往彩虹城");

  const [roadPos, setRoadPos] = useState<Position>({ x: 29, y: 78 });
  const [berry, setBerry] = useState(false);
  const [wildHp, setWildHp] = useState(32);
  const [wildCalm, setWildCalm] = useState(0);
  const [balls, setBalls] = useState(3);
  const [captureWon, setCaptureWon] = useState(false);
  const [captureLog, setCaptureLog] = useState("茸角鼠被荆棘缠住，正警惕地望着你。");

  const [examHp, setExamHp] = useState(62);
  const [examEnemy, setExamEnemy] = useState(48);
  const [examWon, setExamWon] = useState(false);
  const [examGuard, setExamGuard] = useState(false);
  const [examLog, setExamLog] = useState("诺亚派出了银羽雀。考核开始！");

  const [ruptureNodes, setRuptureNodes] = useState<number[]>([]);
  const [bossHp, setBossHp] = useState(86);
  const [bossPlayerHp, setBossPlayerHp] = useState(68);
  const [memories, setMemories] = useState<string[]>([]);
  const [bossLog, setBossLog] = useState("白裂狮忘记了自己的名字。攻击只会让它更加狂暴。");
  const [bossWon, setBossWon] = useState(false);

  const partner = partnerId ? PARTNERS[partnerId] : null;

  useEffect(() => {
    let hasSavedGame = false;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SaveData;
      if (saved.playerName && saved.phase) {
        hasSavedGame = true;
      }
    } catch {
      window.localStorage.removeItem(SAVE_KEY);
    }
    const timer = window.setTimeout(() => setSaveAvailable(hasSavedGame), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "title" || phase === "name") return;
    const save: SaveData = { phase, playerName, partnerId, captured };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [captured, partnerId, phase, playerName]);

  const playTone = useCallback((pitch = 440) => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
    } catch {
      // Audio is optional; game input should never depend on it.
    }
  }, [soundOn]);

  const go = useCallback((next: Phase) => {
    playTone(next === "rupture" || next === "boss" ? 170 : 520);
    setPhase(next);
  }, [playTone]);

  const newGame = () => {
    window.localStorage.removeItem(SAVE_KEY);
    setPlayerName("小澈");
    setDraftName("小澈");
    setPartnerId(null);
    setCaptured(false);
    setRoadPos({ x: 29, y: 78 });
    setBerry(false);
    setWildHp(32);
    setWildCalm(0);
    setBalls(3);
    setCaptureWon(false);
    setExamHp(62);
    setExamEnemy(48);
    setExamWon(false);
    setRuptureNodes([]);
    setBossHp(86);
    setBossPlayerHp(68);
    setMemories([]);
    setBossWon(false);
    go("name");
  };

  const continueGame = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return newGame();
      const saved = JSON.parse(raw) as SaveData;
      setPlayerName(saved.playerName || "小澈");
      setDraftName(saved.playerName || "小澈");
      setPartnerId(saved.partnerId);
      setCaptured(Boolean(saved.captured));
      setPhase(saved.phase === "title" || saved.phase === "name" ? "shelter" : saved.phase);
    } catch {
      newGame();
    }
  };

  const selectPartner = (id: PartnerId) => {
    setPartnerId(id);
    playTone(id === "leaf" ? 480 : id === "metal" ? 330 : 580);
  };

  const moveRoad = useCallback((dx: number, dy: number) => {
    setRoadPos((position) => ({
      x: Math.max(7, Math.min(92, position.x + dx)),
      y: Math.max(24, Math.min(79, position.y + dy)),
    }));
  }, []);

  const roadInteraction = useCallback(() => {
    const berrySpot = { x: 34, y: 42 };
    const wildSpot = { x: 75, y: 55 };
    if (!berry && distance(roadPos, berrySpot) < 14) {
      setBerry(true);
      setToast("获得了香甜莓果 ×1 · 野生宠物喜欢它的气味");
      playTone(720);
      return;
    }
    if (distance(roadPos, wildSpot) < 15) {
      if (!berry) {
        setToast("茸角鼠很害怕。也许附近有能让它安心的东西。");
        return;
      }
      go("capture");
      return;
    }
    setToast("这里没有可以互动的东西。靠近发光标记再试试。");
  }, [berry, go, playTone, roadPos]);

  useEffect(() => {
    if (phase !== "road") return;
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e"].includes(key)) event.preventDefault();
      if (key === "arrowup" || key === "w") moveRoad(0, -4);
      if (key === "arrowdown" || key === "s") moveRoad(0, 4);
      if (key === "arrowleft" || key === "a") moveRoad(-4, 0);
      if (key === "arrowright" || key === "d") moveRoad(4, 0);
      if (key === "e") roadInteraction();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moveRoad, phase, roadInteraction]);

  const captureAction = (action: "attack" | "calm" | "ball") => {
    if (captureWon) return;
    if (action === "attack") {
      const damage = partnerId === "metal" ? 11 : 8;
      const nextHp = Math.max(4, wildHp - damage);
      setWildHp(nextHp);
      setCaptureLog(`${partner?.name}使用${partner?.attack}。茸角鼠的动作慢了下来。`);
      playTone(240);
      return;
    }
    if (action === "calm") {
      setWildCalm((value) => Math.min(3, value + 1));
      setCaptureLog(berry ? "你把莓果放在地上，退后一步。茸角鼠慢慢放松了耳朵。" : "茸角鼠仍然很戒备。" );
      playTone(610);
      return;
    }
    if (balls <= 0) {
      setCaptureLog("召唤胶囊已经用完了。黎叔的备用包里又滚出了两枚。");
      setBalls(2);
      return;
    }
    setBalls((value) => value - 1);
    if (wildHp <= 16 && wildCalm >= 1) {
      setCaptured(true);
      setCaptureWon(true);
      setCaptureLog("胶囊没有强行关闭。茸角鼠轻轻触碰按钮，主动接受了你的邀请。");
      playTone(840);
    } else {
      setCaptureLog(wildHp > 16 ? "茸角鼠还有力气挣脱。先让它停下来。" : "它的体力已经很低，但仍不信任你。试着安抚它。" );
      playTone(140);
    }
  };

  const examAction = (action: "attack" | "support") => {
    if (examWon || !partner) return;
    if (action === "support") {
      if (partnerId === "leaf" || partnerId === "tide") {
        setExamHp((value) => Math.min(partner.hp, value + 10));
        setExamLog(`${partner.name}使用${partner.support}，恢复了体力。银羽雀的风刃擦过护幕。`);
      } else {
        setExamGuard(true);
        setExamLog(`${partner.name}使用${partner.support}，下一次受到的伤害减半。`);
      }
      setExamHp((value) => Math.max(8, value - (examGuard ? 3 : 6)));
      playTone(580);
      return;
    }
    const damage = partnerId === "metal" ? 13 : partnerId === "tide" ? 11 : 10;
    const nextEnemy = Math.max(0, examEnemy - damage);
    setExamEnemy(nextEnemy);
    if (nextEnemy === 0) {
      setExamWon(true);
      setExamLog(`${partner.name}稳稳停在边线前。银羽雀失去战斗能力——考核通过！`);
      playTone(820);
      return;
    }
    const incoming = examGuard ? 3 : 7;
    setExamGuard(false);
    setExamHp((value) => Math.max(8, value - incoming));
    setExamLog(`${partner.name}使出${partner.attack}！银羽雀反击，造成 ${incoming} 点伤害。`);
    playTone(260);
  };

  const toggleRuptureNode = (node: number) => {
    if (ruptureNodes.includes(node)) return;
    const next = [...ruptureNodes, node];
    setRuptureNodes(next);
    playTone(300 + node * 120);
    if (next.length === 3) setToast("三处灵契稳定。广场中央仍有一只宠物无法醒来……");
  };

  const bossAction = (action: "attack" | "protect" | "soothe" | "call") => {
    if (bossWon || !partner) return;
    if (action === "call") {
      if (memories.length < 3) {
        setBossLog("记忆还不完整。白裂狮听不见你在呼唤谁。");
        playTone(150);
        return;
      }
      setBossWon(true);
      setBossLog("“白裂狮——塞其还在等你。” 它身上的灵纹重新亮起，利爪停在了你面前。");
      playTone(880);
      return;
    }

    let incoming = 9;
    if (action === "attack") {
      const nextHp = Math.max(18, bossHp - 9);
      setBossHp(nextHp);
      setBossLog(nextHp === 18 ? "白裂狮的身体已经到达极限，但黑色铃声仍控制着它。继续攻击无法结束战斗。" : `${partner.name}挡开利爪。白裂狮变得更加狂暴，记忆光点在它身后闪烁。`);
      incoming = 10;
      playTone(210);
    }
    if (action === "soothe") {
      setBossLog(`${partner.name}没有攻击，而是守在你身前。白裂狮迟疑了一瞬。`);
      incoming = 5;
      playTone(540);
    }
    if (action === "protect") {
      if (memories.length < 3) {
        const memory = MEMORY_TEXT[memories.length];
        setMemories((current) => [...current, memory]);
        setBossLog(`你护住了记忆碎片：${memory}`);
        incoming = 4;
        playTone(660 + memories.length * 80);
      } else {
        setBossLog("三段记忆已经完整。现在，呼唤它真正的名字。" );
        incoming = 3;
      }
    }
    setBossPlayerHp((value) => {
      const next = value - incoming;
      return next <= 0 ? 22 : next;
    });
  };

  const chapterLabel = useMemo(() => {
    if (["title", "name", "shelter", "road", "capture"].includes(phase)) return "序章 · 临虹村";
    if (["city", "exam", "festival"].includes(phase)) return "序章 · 黄金庆典";
    if (["rupture", "boss", "aftermath"].includes(phase)) return "序章 · 灵契断裂";
    return "序章 · 没有登记的伙伴";
  }, [phase]);

  return (
    <main className={`game-shell phase-${phase}`}>
      <img className="scene-image" src={SCENE_ART[phase]} alt="" aria-hidden="true" draggable={false} />
      <div className="world-noise" />
      {phase !== "title" && (
        <header className="game-hud">
          <button type="button" className="mini-brand" onClick={() => setPhase("title")} aria-label="返回标题">
            <span className="brand-orb">契</span>
            <span><b>宠物王国</b><small>SPIRIT PACT</small></span>
          </button>
          <div className="chapter-label"><span />{chapterLabel}</div>
          <div className="hud-actions">
            {partner && <div className="partner-chip"><PetSprite id={partner.id} size="sm" /><span><small>{partner.kind}</small><b>{partner.name}</b></span></div>}
            <button type="button" className="icon-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "关闭音效" : "开启音效"}>{soundOn ? "♪" : "×"}</button>
            <button type="button" className="icon-button" onClick={() => setHelpOpen(true)} aria-label="打开帮助">?</button>
          </div>
        </header>
      )}

      {phase === "title" && (
        <section className="title-screen">
          <div className="sky-layers"><i /><i /><i /></div>
          <div className="distant-city">
            <i className="city-tower tower-one" /><i className="city-tower tower-two" /><i className="city-tower tower-three" />
            <i className="rainbow-bridge" />
          </div>
          <div className="title-pets"><PetSprite id="leaf" size="lg" /><PetSprite id="metal" size="xl" /><PetSprite id="tide" size="lg" /></div>
          <div className="title-copy">
            <div className="title-kicker"><span>华娱经典世界观 · 非商业同人续作</span></div>
            <h1><small>宠物王国</small><strong>灵契</strong></h1>
            <p>当契约断裂，曾经的陪伴还会留下吗？</p>
            <div className="title-actions">
              <button type="button" className="primary-action" onClick={newGame}><span>新的旅程</span><b>›</b></button>
              {saveAvailable && <button type="button" className="secondary-action" onClick={continueGame}>继续上次进度</button>}
            </div>
            <div className="title-meta"><span>序章</span><i />没有登记的伙伴<i />单人剧情 RPG</div>
          </div>
          <div className="title-version">PROLOGUE BUILD 01</div>
        </section>
      )}

      {phase === "name" && (
        <section className="paper-screen name-screen">
          <div className="paper-card name-card">
            <div className="paper-kicker">TRAINER APPLICATION · 001</div>
            <h2>在推荐信上<br />写下你的名字</h2>
            <p>这个名字会被伙伴记住，也会出现在彩虹学院的新生档案里。</p>
            <label className="name-field">
              <span>训练师姓名</span>
              <input value={draftName} maxLength={8} onChange={(event) => setDraftName(event.target.value)} autoFocus aria-label="训练师姓名" />
            </label>
            <button type="button" className="primary-action dark" disabled={!draftName.trim()} onClick={() => { setPlayerName(draftName.trim()); go("shelter"); }}><span>收好推荐信</span><b>›</b></button>
            <div className="seal-stamp">临虹<br />照护所</div>
          </div>
        </section>
      )}

      {phase === "shelter" && (
        <section className="shelter-screen">
          <div className="shelter-scene">
            <div className="window-light"><i /><i /></div>
            <div className="shelf shelf-one" /><div className="shelf shelf-two" />
            <div className="keeper"><Character name="黎叔" variant="keeper" /><span>黎叔</span></div>
            <div className="shelter-copy">
              <div className="scene-index">01 · 临虹村宠物照护所</div>
              <h2>它们也在<br />挑选自己的伙伴</h2>
              <p>黎叔把三枚封印球放回抽屉。今天，不由训练师先做决定。</p>
            </div>
            <div className="partner-selection">
              {(Object.values(PARTNERS) as Partner[]).map((candidate) => (
                <button type="button" key={candidate.id} className={`partner-card${partnerId === candidate.id ? " selected" : ""}`} onClick={() => selectPartner(candidate.id)}>
                  <div className="partner-art"><PetSprite id={candidate.id} size="lg" /><span>{candidate.kind}</span></div>
                  <div className="partner-copy"><small>{candidate.nature}</small><b>{candidate.name}</b><p>{candidate.quote}</p></div>
                  <i className="select-mark">{partnerId === candidate.id ? "已靠近" : "靠近它"}</i>
                </button>
              ))}
            </div>
            <div className="shelter-footer">
              <p>{partner ? `“${partner.name}没有进入封印球，而是站到了${playerName}身边。”` : "选择一只你想先了解的宠物。"}</p>
              <button type="button" className="primary-action" disabled={!partnerId} onClick={() => go("road")}><span>一起出发</span><b>›</b></button>
            </div>
          </div>
        </section>
      )}

      {phase === "road" && partner && (
        <section className="field-screen">
          <div className="mission-card">
            <small>当前目标</small><h3>前往彩虹城</h3><p>沿石径向东北前进。途中似乎有宠物的叫声。</p>
            <div className="mission-items"><span className={berry ? "done" : ""}>◇ 找到安抚用的莓果</span><span>◇ 查看被困的宠物</span></div>
          </div>
          <div className="field-world" onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            const box = event.currentTarget.getBoundingClientRect();
            setRoadPos({ x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 });
          }}>
            <div className="field-skyline"><i /><i /><i /></div>
            <div className="river" /><div className="stone-path" />
            <div className="tree-line tree-line-back">{Array.from({ length: 11 }).map((_, index) => <i key={index} />)}</div>
            <div className="tree-line tree-line-front">{Array.from({ length: 7 }).map((_, index) => <i key={index} />)}</div>
            <button type="button" className={`map-object berry-object${berry ? " collected" : ""}`} style={{ left: "34%", top: "42%" }} onClick={(event) => { event.stopPropagation(); setRoadPos({ x: 34, y: 42 }); }} aria-label="莓果丛"><span>✦</span></button>
            <button type="button" className="map-object wild-object" style={{ left: "75%", top: "55%" }} onClick={(event) => { event.stopPropagation(); setRoadPos({ x: 75, y: 55 }); }} aria-label="被困的茸角鼠"><PetSprite id="wild" size="sm" /><span>!</span></button>
            <div className="player-party" style={{ left: `${roadPos.x}%`, top: `${roadPos.y}%` }}><Character name={playerName} small /><PetSprite id={partner.id} size="sm" /></div>
            <div className="city-gate-marker"><span>彩虹城</span><i>›</i></div>
          </div>
          <div className="field-toast"><span>{berry ? "莓" : "路"}</span><p>{toast}</p><kbd>E</kbd></div>
          <DPad onMove={moveRoad} onInteract={roadInteraction} />
        </section>
      )}

      {phase === "capture" && partner && (
        <section className="battle-screen capture-battle">
          <div className="battle-backdrop field-battle-bg"><i /><i /><i /></div>
          <div className="battle-heading"><small>WILD ENCOUNTER</small><h2>第一次邀请</h2><p>被困的宠物不会因为获救就立刻相信你。</p></div>
          <div className="enemy-side">
            <div className="combatant-info"><span><b>茸角鼠</b><small>猛兽系 · Lv.4</small></span><em>{wildHp} / 32</em><Meter value={wildHp} max={32} /></div>
            <PetSprite id="wild" size="xl" />
            <div className="calm-indicator"><span>戒备</span><Meter value={wildCalm} max={3} kind="calm" /></div>
          </div>
          <div className="ally-side"><PetSprite id={partner.id} size="xl" /><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.5</small></span><em>状态良好</em><Meter value={partner.hp} max={partner.hp} /></div></div>
          <div className="battle-command">
            <div className="battle-log"><span>行动记录</span><p>{captureLog}</p></div>
            {!captureWon ? <div className="command-grid">
              <button type="button" onClick={() => captureAction("attack")}><span>攻击</span><b>{partner.attack}</b><small>降低体力</small></button>
              <button type="button" onClick={() => captureAction("calm")}><span>安抚</span><b>放下莓果</b><small>降低戒备</small></button>
              <button type="button" className="ball-command" onClick={() => captureAction("ball")}><span>道具 · {balls}</span><b>召唤胶囊</b><small>邀请同行</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => go("city")}><span>带着新伙伴进城</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "city" && (
        <Dialogue lines={[
          { speaker: "旁白", text: "越过最后一座石桥，彩虹城的高塔第一次出现在你眼前。" },
          { speaker: "诺亚", role: "学院考生", text: `你就是${playerName}？档案上说，你的宠物还没有登记灵契。` },
          { speaker: playerName, text: "它不是我的所有物。是它自己决定跟我来的。" },
          { speaker: "诺亚", text: "没有登记就无法证明关系。考场上，感情可不会替你计算胜负。" },
          { speaker: "晶晶", role: "训练师协会会长", text: "那就让考核回答吧。双方准备，点到为止。" },
        ]} onComplete={() => go("exam")} backdrop={<div className="city-dialogue-bg"><div className="city-buildings"><i /><i /><i /><i /></div><div className="dialogue-characters"><div><Character name={playerName} variant="player" /><span>{playerName}</span></div><div><Character name="诺亚" variant="noah" /><span>诺亚</span></div></div></div>} />
      )}

      {phase === "exam" && partner && (
        <section className="battle-screen exam-battle">
          <div className="battle-backdrop arena-bg"><i /><i /><i /><i /></div>
          <div className="battle-heading light"><small>RAINBOW ACADEMY · ENTRY TEST</small><h2>新生考核</h2><p>击败诺亚的银羽雀，取得临时训练师徽章。</p></div>
          <div className="enemy-side"><div className="combatant-info"><span><b>银羽雀</b><small>飞行系 · Lv.6</small></span><em>{examEnemy} / 48</em><Meter value={examEnemy} max={48} /></div><PetSprite id="bird" size="xl" /><div className="trainer-label"><Character name="诺亚" variant="noah" small /><span>诺亚</span></div></div>
          <div className="ally-side"><PetSprite id={partner.id} size="xl" /><div className="combatant-info"><span><b>{partner.name}</b><small>{partner.kind} · Lv.6</small></span><em>{examHp} / {partner.hp}</em><Meter value={examHp} max={partner.hp} /></div><div className="trainer-label"><Character name={playerName} variant="player" small /><span>{playerName}</span></div></div>
          <div className="battle-command">
            <div className="battle-log"><span>裁判记录</span><p>{examLog}</p></div>
            {!examWon ? <div className="command-grid two">
              <button type="button" onClick={() => examAction("attack")}><span>技能 01</span><b>{partner.attack}</b><small>稳定伤害</small></button>
              <button type="button" onClick={() => examAction("support")}><span>技能 02</span><b>{partner.support}</b><small>{partnerId === "metal" ? "减轻伤害" : "恢复体力"}</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => go("festival")}><span>参加黄金庆典</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "festival" && (
        <Dialogue lines={FESTIVAL_LINES} onComplete={() => go("rupture")} backdrop={<div className="festival-bg"><div className="rainbow-ring"><i /><i /><i /><i /><i /></div><div className="hero-line">{FESTIVAL_HEROES.map((hero, index) => <div key={hero.name} className={`hero-token hero-${index}`}><Character name={hero.name} variant={hero.variant} /><span>{hero.name}</span></div>)}</div><div className="crowd-line">{Array.from({ length: 18 }).map((_, index) => <i key={index} />)}</div></div>} />
      )}

      {phase === "rupture" && partner && (
        <section className="rupture-screen">
          <div className="rupture-sky"><i /><i /><i /></div>
          <div className="rupture-copy"><small>EMERGENCY · 灵契异常</small><h2>共鸣环断裂了</h2><p>触碰广场上三处闪烁的灵契，帮助失控宠物记住身边的人。</p></div>
          <div className="rupture-field">
            {[0, 1, 2].map((node) => (
              <button type="button" key={node} className={`rupture-node node-${node}${ruptureNodes.includes(node) ? " restored" : ""}`} onClick={() => toggleRuptureNode(node)} aria-label={`稳定第${node + 1}处灵契`}>
                <PetSprite id={node === 0 ? "bird" : node === 1 ? "wild" : "leaf"} size="md" glitched={!ruptureNodes.includes(node)} />
                <span>{ruptureNodes.includes(node) ? "已稳定" : "触碰灵纹"}</span>
              </button>
            ))}
            <div className="rupture-player"><Character name={playerName} /><PetSprite id={partner.id} size="md" /></div>
          </div>
          <div className="rupture-status"><span>{ruptureNodes.length} / 3</span><Meter value={ruptureNodes.length} max={3} kind="memory" /></div>
          {ruptureNodes.length === 3 && <button type="button" className="primary-action rupture-next" onClick={() => go("boss")}><span>前往广场中央</span><b>›</b></button>}
        </section>
      )}

      {phase === "boss" && partner && (
        <section className="battle-screen boss-battle">
          <div className="battle-backdrop boss-bg"><i /><i /><i /></div>
          <div className="battle-heading light"><small>AWAKENING BATTLE · NOT A HUNT</small><h2>被遗忘的名字</h2><p>保护浮现的记忆。不要让白裂狮在狂乱中耗尽自己。</p></div>
          <div className="enemy-side guardian-side"><div className="combatant-info danger"><span><b>白裂狮</b><small>金属系 · 灵契断裂</small></span><em>{bossHp} / 86</em><Meter value={bossHp} max={86} /></div><PetSprite id="guardian" size="xl" glitched={!bossWon} /><div className="black-bell">◆<span>黑铃共鸣</span></div></div>
          <div className="ally-side"><PetSprite id={partner.id} size="xl" /><div className="combatant-info"><span><b>{partner.name}</b><small>未登记灵契</small></span><em>{bossPlayerHp} / 68</em><Meter value={bossPlayerHp} max={68} /></div></div>
          <div className="memory-ribbon">{[0, 1, 2].map((slot) => <div key={slot} className={memories[slot] ? "found" : ""}><span>{slot + 1}</span><p>{memories[slot] ?? "记忆尚未浮现"}</p></div>)}</div>
          <div className="battle-command boss-command">
            <div className="battle-log"><span>灵契回声</span><p>{bossLog}</p></div>
            {!bossWon ? <div className="command-grid four">
              <button type="button" onClick={() => bossAction("attack")}><span>战斗</span><b>{partner.attack}</b><small>挡开攻击</small></button>
              <button type="button" className="memory-command" onClick={() => bossAction("protect")}><span>核心</span><b>守护记忆</b><small>{memories.length} / 3</small></button>
              <button type="button" onClick={() => bossAction("soothe")}><span>协力</span><b>{partner.support}</b><small>减少伤害</small></button>
              <button type="button" className={memories.length === 3 ? "call-ready" : ""} onClick={() => bossAction("call")}><span>唤灵</span><b>呼唤名字</b><small>{memories.length === 3 ? "可以使用" : "需要完整记忆"}</small></button>
            </div> : <button type="button" className="primary-action battle-continue" onClick={() => go("aftermath")}><span>赶往彩虹神殿</span><b>›</b></button>}
          </div>
        </section>
      )}

      {phase === "aftermath" && (
        <Dialogue lines={AFTERMATH_LINES} onComplete={() => go("ending")} backdrop={<div className="temple-bg"><div className="temple-columns"><i /><i /><i /><i /></div><div className="crystal-core"><i /><span>万灵晶核</span></div><div className="temple-characters"><div><Character name="塞其" variant="sergi" /><span>塞其</span></div><div><Character name="安琪儿" variant="angela" /><span>安琪儿</span></div></div></div>} />
      )}

      {phase === "ending" && partner && (
        <section className="ending-screen">
          <div className="ending-landscape"><div className="dawn-orb" /><div className="ending-city"><i /><i /><i /></div><div className="ending-party"><Character name={playerName} /><PetSprite id={partner.id} size="lg" />{captured && <PetSprite id="wild" size="md" />}</div></div>
          <div className="ending-card">
            <div className="ending-kicker">PROLOGUE COMPLETE</div>
            <h2>没有登记的伙伴</h2>
            <p>彩虹城在身后封锁。东之高原的风里，传来了黑色铃铛的声音。</p>
            <div className="ending-record">
              <div><small>训练师</small><b>{playerName}</b></div>
              <div><small>初始伙伴</small><b>{partner.name}</b></div>
              <div><small>图鉴记录</small><b>{captured ? "2" : "1"} / 100</b></div>
              <div><small>下一目标</small><b>东之高原</b></div>
            </div>
            <div className="next-chapter"><span>第一章</span><div><b>不愿回家的宠物</b><small>TO BE CONTINUED</small></div></div>
            <div className="ending-actions"><button type="button" className="primary-action dark" onClick={() => setPhase("title")}><span>保存并返回标题</span><b>›</b></button><button type="button" className="text-action" onClick={newGame}>重新体验序章</button></div>
          </div>
        </section>
      )}

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section className="help-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭">×</button>
            <small>TRAINER HANDBOOK</small><h2>旅行手册</h2>
            <div className="help-grid"><div><kbd>WASD</kbd><b>移动</b><p>野外也支持方向键和点击地面。</p></div><div><kbd>E</kbd><b>互动</b><p>靠近发光物体、宠物或人物。</p></div><div><kbd>Enter</kbd><b>继续对话</b><p>也可以点击对话框。</p></div><div><kbd>自动</kbd><b>保存进度</b><p>每次进入新场景都会保存在本机。</p></div></div>
            <p className="help-note">这是《宠物王国：灵契》的可玩序章原型，玩法与剧情会在后续章节中继续扩展。</p>
          </section>
        </div>
      )}
    </main>
  );
}
