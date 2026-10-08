import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

const T = {
  bg: '#0a0b1a', card: 'rgba(14,15,36,.86)', ink: '#ece9ff', muted: '#8b8ab0',
  line: 'rgba(160,158,230,.16)', indigo: '#6b69e6', amber: '#ffb454',
  green: '#34d399', blue: '#38bdf8', violet: '#a78bfa', purple: '#a855f7',
  steel: '#9fb3c8', graphite: '#0b0d12',
};
const serif = "'Spectral', Georgia, serif";
const sans = "'Spectral', Georgia, serif";

const SceneFrame = ({children, admin = false, frame = 0}: {children: React.ReactNode; admin?: boolean; frame?: number}) => {
  const intro = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const stars = Array.from({length: 70}, (_, i) => <i key={i} style={{position: 'absolute', left: `${(i * 71 + 9) % 100}%`, top: `${(i * 43 + 4) % 100}%`, width: i % 9 === 0 ? 3 : 2, height: i % 9 === 0 ? 3 : 2, borderRadius: 9, background: T.ink, opacity: admin ? 0.12 : 0.18 + (i % 4) * 0.06}} />);
  return <AbsoluteFill style={{overflow: 'hidden', color: T.ink, fontFamily: sans, background: admin ? T.graphite : T.bg}}>
    {stars}
    <AbsoluteFill style={{background: admin ? 'radial-gradient(ellipse at 55% 45%, rgba(159,179,200,.09), transparent 62%)' : 'radial-gradient(ellipse at 50% 38%, rgba(107,105,230,.22), transparent 58%)'}} />
    <AbsoluteFill style={{opacity: intro, transform: `translateY(${(1 - intro) * 24}px)`}}>{children}</AbsoluteFill>
  </AbsoluteFill>;
};

const Logo = ({size = 42}: {size?: number}) => <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
  <div style={{width: size, height: size, border: `2px solid ${T.amber}`, borderRadius: size * 0.28, display: 'grid', placeItems: 'center', color: T.amber, fontFamily: serif, fontWeight: 700, fontSize: size * 0.62, boxShadow: '0 0 36px rgba(255,180,84,.2)'}}>H</div>
  <b style={{fontFamily: serif, fontSize: size * 0.62, letterSpacing: '.28em'}}>HERO</b>
</div>;

const Panel = ({children, style = {}}: {children: React.ReactNode; style?: React.CSSProperties}) => <div style={{position: 'relative', overflow: 'hidden', borderRadius: 24, border: `1px solid ${T.line}`, background: T.card, boxShadow: '0 28px 80px rgba(0,0,0,.34)', ...style}}>
  <i style={{position: 'absolute', left: 28, top: 0, width: 72, height: 3, borderRadius: '0 0 3px 3px', background: `linear-gradient(90deg, ${T.indigo}, ${T.amber})`}} />
  {children}
</div>;

const Tag = ({children}: {children: React.ReactNode}) => <span style={{display: 'inline-block', borderRadius: 999, padding: '9px 17px', background: T.amber, color: '#1d160e', fontFamily: sans, fontSize: 16, fontWeight: 700, letterSpacing: '.09em'}}>{children}</span>;

const Header = ({admin = false}: {admin?: boolean}) => <div style={{position: 'absolute', top: 42, left: 84, right: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
  <Logo />
  <div style={{color: admin ? T.steel : T.muted, fontFamily: sans, fontSize: 17, letterSpacing: '.16em'}}>WHERE HISTORY HAPPENED</div>
</div>;

const Base = ({title, subtitle, children, tag, admin = false}: {title: string; subtitle: string; children: React.ReactNode; tag?: string; admin?: boolean}) => {
  const frame = useCurrentFrame();
  return <SceneFrame admin={admin} frame={frame}>
    <Header admin={admin}/>
    <div style={{position: 'absolute', top: 148, left: 90, right: 90, textAlign: 'center'}}>
      <div style={{fontFamily: serif, fontWeight: 700, fontSize: 74, lineHeight: 1.08, color: T.ink}}>{title}</div>
      <div style={{marginTop: 15, fontFamily: serif, fontSize: 29, color: admin ? T.steel : T.muted}}>{subtitle}</div>
    </div>
    <div style={{position: 'absolute', left: 110, right: 110, top: 350, height: 490, display: 'grid', placeItems: 'center'}}>{children}</div>
    {tag && <div style={{position: 'absolute', left: 0, right: 0, bottom: 92, textAlign: 'center', fontFamily: sans, fontSize: 18, fontWeight: 700, letterSpacing: '.14em', color: admin ? T.steel : T.amber}}>{tag}</div>}
    <div style={{position: 'absolute', left: 0, bottom: 0, height: 5, width: `${Math.min(100, frame / 4)}%`, background: admin ? T.steel : `linear-gradient(90deg, ${T.indigo}, ${T.amber})`}} />
  </SceneFrame>;
};

const MapArt = () => <svg viewBox="0 0 860 400" style={{width: '100%', height: '100%'}}>
  <g fill="#171a38" stroke="#68699d" strokeWidth="2">
    <path d="M63 92 117 47 204 58 250 101 222 145 191 157 176 207 140 238 112 197 79 188 56 143Z"/><path d="m211 239 41-12 35 32-8 59-26 61-27-30-8-51Z"/>
    <path d="m342 101 58-31 57 13 24 30-41 27-57-3-21 35-39-19Z"/><path d="m401 172 62-30 63 20 30 67-29 82-46 56-35-29-11-69-41-41Z"/>
    <path d="m481 83 72-36 105 20 49 49-21 53-65 8-38 43-53-32-53-22Z"/><path d="m646 268 53-19 42 34-15 44-58 4-33-27Z"/>
  </g>
  <path d="M425 183 Q445 230 457 276 T486 345" fill="none" stroke={T.blue} strokeWidth="5" strokeDasharray="12 12"/>
  <g><circle cx="444" cy="225" r="15" fill={T.blue}/><circle cx="218" cy="146" r="13" fill={T.green}/><circle cx="549" cy="148" r="16" fill={T.violet}/><circle cx="480" cy="293" r="14" fill={T.purple}/></g>
</svg>;

export const IntroScene = () => {
  const f = useCurrentFrame();
  const glow = interpolate(f, [0, 95, 119], [0.15, 0.6, 1], {extrapolateRight: 'clamp'});
  return <SceneFrame frame={f}><AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
    <div style={{opacity: glow, transform: `scale(${0.86 + glow * 0.14}) rotateY(${(1 - glow) * -18}deg)`}}>
      <div style={{display: 'flex', justifyContent: 'center'}}><Logo size={92}/></div>
      <div style={{fontFamily: serif, fontSize: 91, fontWeight: 700, marginTop: 48}}>Studying, redefined.</div>
      <div style={{fontFamily: serif, color: T.amber, fontSize: 36, marginTop: 14}}>Meet Hero.</div>
    </div>
    <AbsoluteFill style={{background: '#fff', opacity: interpolate(f, [95, 100, 102, 108], [0, 1, 1, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'}), pointerEvents: 'none'}} />
  </SceneFrame>;
};

export const HomeScene = () => <Base title="Geography with history attached." subtitle="Pick your tour: one year, or two." tag="QUOTE OF THE DAY  ·  YEAR TOGGLE">
  <Panel style={{width: 930, padding: 34, textAlign: 'center'}}>
    <div style={{borderLeft: `3px solid ${T.indigo}`, padding: '4px 24px', maxWidth: 580, margin: '0 auto 24px', textAlign: 'left', color: T.muted, fontFamily: serif, fontSize: 23, fontStyle: 'italic'}}>“Egypt is the gift of the Nile.”<div style={{fontSize: 14, fontStyle: 'normal', letterSpacing: '.14em', marginTop: 8}}>HERODOTUS</div></div>
    <div style={{fontFamily: serif, fontSize: 36, marginBottom: 24}}>Where will your curiosity take you?</div>
    <div style={{display: 'flex', justifyContent: 'center', gap: 18}}><Panel style={{padding: '17px 34px', borderColor: T.amber, fontSize: 20}}>1 YEAR TOUR</Panel><Panel style={{padding: '17px 34px', fontSize: 20, color: T.muted}}>2 YEAR TOUR</Panel></div>
    <div style={{display: 'flex', justifyContent: 'center', gap: 14, marginTop: 26}}><Tag>Name the Place</Tag><Tag>Find the Land</Tag><Tag>Revisit the Forgotten</Tag></div>
  </Panel>
</Base>;

export const MapScene = () => {
  const f = useCurrentFrame();
  return <Base title="Name the Place." subtitle="Countries, seas, rivers—even empires light up." tag="DARK MAP  ·  REGION HIGHLIGHTS  ·  NEW">
    <Panel style={{width: 1020, height: 440, padding: 24, transform: `perspective(1400px) rotateX(5deg) rotateY(${Math.sin(f / 24) * 3}deg)`}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 20px'}}><b style={{fontFamily: serif, fontSize: 29}}>Explore the ancient world</b><Tag>NAME THE PLACE</Tag></div>
      <div style={{height: 345}}><MapArt/></div>
    </Panel>
  </Base>;
};

export const FindScene = () => {
  const f = useCurrentFrame(); const tick = Math.min(100, Math.max(4, f * 1.25));
  return <Base title="Find the Land." subtitle="Hero names a place. You find it." tag="BEAT THE CLOCK  ·  NEW GAME MODE">
    <Panel style={{width: 950, height: 430, padding: 26}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><b style={{fontFamily: serif, fontSize: 31}}>Find: The Nile</b><Tag>00:{Math.max(0, 30 - Math.floor(f / 5)).toString().padStart(2, '0')}</Tag></div>
      <div style={{height: 315, marginTop: 12}}><MapArt/></div>
      <div style={{position: 'absolute', bottom: 16, left: 28, width: `${tick}%`, height: 5, background: T.green, borderRadius: 9}} />
    </Panel>
  </Base>;
};

export const ForgottenScene = () => <Base title="Lands Forgotten." subtitle="Miss a place? Hero remembers." tag="YOUR WEAK SPOTS BECOME YOUR NEXT ROUND">
  <Panel style={{width: 820, padding: 38}}><div style={{fontFamily: serif, fontSize: 33, marginBottom: 24}}>Places to revisit</div>
    {['Carthage', 'Hormuz', 'Anatolia'].map((name, i) => <div key={name} style={{display: 'flex', alignItems: 'center', gap: 20, margin: '20px 0', fontSize: 23}}><span style={{width: 170}}>{name}</span><div style={{height: 13, flex: 1, background: '#242544', borderRadius: 10}}><div style={{height: '100%', width: `${[84, 67, 46][i]}%`, background: [T.amber, T.indigo, T.violet][i], borderRadius: 10}} /></div><b style={{color: T.amber}}>{5 - i}×</b></div>)}
  </Panel>
</Base>;

export const ClioScene = () => <Base title="Meet Clio." subtitle="Your muse of history. One question away." tag="MEMORY TRICKS  ·  HISTORY CONTEXT  ·  NEW">
  <Panel style={{width: 850, padding: 32}}><div style={{textAlign: 'right', marginLeft: 175, padding: 18, borderRadius: 16, background: 'rgba(107,105,230,.2)', fontSize: 21}}>Why does the Nile matter?</div>
    <div style={{display: 'flex', gap: 18, marginTop: 25, alignItems: 'start'}}><div style={{width: 50, height: 50, borderRadius: 16, background: `linear-gradient(135deg, ${T.indigo}, ${T.amber})`, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 25}}>C</div><div style={{padding: 22, borderRadius: 17, background: 'rgba(255,255,255,.045)', fontSize: 21, lineHeight: 1.5}}>The Nile’s annual floods renewed the soil, supporting farms and cities along its banks.<div style={{color: T.amber, marginTop: 14}}>Memory trick: Nile = nourish, navigate, unite.</div></div></div>
  </Panel>
</Base>;

export const CustomsScene = () => <Base title="Make it yours." subtitle="Six colorways, four fonts, ambient space music." tag="CUSTOMS  ·  LIGHT TO DARK  ·  YOUR STUDY SPACE">
  <Panel style={{width: 1040, padding: 34}}><div style={{display: 'flex', gap: 14, justifyContent: 'center'}}>{[['Bronze','#a8692a'],['Dusk','#7c3aed'],['Ember','#ea580c'],['Moss','#16a34a'],['Coral','#e11d48'],['Graphite','#64748b']].map(([name,color])=><div key={name} style={{width: 145, height: 96, borderRadius: 16, background: color, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700}}>{name}</div>)}</div>
    <div style={{margin: '30px auto 0', maxWidth: 680, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', fontSize: 21}}><span>Ambient space music</span><b style={{color: T.green}}>● ON　 ▂▅▃▆▂</b></div>
  </Panel>
</Base>;

export const MontageScene = () => <Base title="A world of discovery." subtitle="Charts. Chronicle. Scribes. Built for your phone." tag="HALL OF HEROES  ·  PRIVATE CHARTS  ·  THE CHRONICLE">
  <div style={{display: 'flex', alignItems: 'center', gap: 28}}><Panel style={{width: 500, padding: 30}}><div style={{color: T.amber, letterSpacing: '.13em', fontSize: 17}}>HALL OF HEROES</div><div style={{fontFamily: serif, fontSize: 36, margin: '20px 0'}}>A living leaderboard</div>{['01　Alexandria','02　Carthage','03　Babylon'].map((x, i) => <div key={x} style={{padding: 17, marginTop: 10, borderRadius: 13, background: 'rgba(107,105,230,.11)', fontSize: 21}}>{x}<b style={{float: 'right', color: T.amber}}>{98 - i * 3}%</b></div>)}</Panel>
    <Panel style={{width: 275, height: 420, padding: 15, transform: 'rotateY(-10deg)'}}><div style={{height: '100%', borderRadius: 20, background: '#101127', padding: 22}}><div style={{marginBottom: 28}}><Logo size={36}/></div><div style={{fontFamily: serif, fontSize: 25}}>Your next journey awaits.</div><div style={{position: 'absolute', bottom: 24, left: 25, color: T.amber, fontSize: 16}}>Map　 Heroes　 Charts　 Clio</div></div></Panel></div>
</Base>;

export const AdminScene = () => <Base admin title="For the stewards." subtitle="A different kind of control." tag="LIVE ANALYTICS  ·  FEEDBACK INBOX  ·  ONE-CLICK REDEPLOY">
  <Panel style={{width: 1040, padding: 30, background: 'rgba(16,21,30,.94)', borderColor: 'rgba(159,179,200,.24)'}}><div style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${T.line}`, paddingBottom: 18, fontSize: 24}}><b>Stewards <span style={{color: T.steel}}> / Control room</span></b><span style={{color: T.green}}>● LIVE</span></div>
    <div style={{display: 'flex', gap: 14, marginTop: 22}}>{[['LIVE NOW','128'],['SESSIONS','2,418'],['COMPLETION','87%']].map(([label, value]) => <div key={label} style={{flex: 1, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, background: 'rgba(255,255,255,.025)'}}><div style={{fontSize: 14, letterSpacing: '.12em', color: T.steel}}>{label}</div><b style={{fontFamily: serif, fontSize: 38}}>{value}</b></div>)}</div>
    <div style={{display: 'flex', gap: 20, marginTop: 20}}><div style={{flex: 1, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18}}><div style={{color: T.steel, fontSize: 15}}>VISITS · LAST 14 DAYS</div><div style={{height: 120, display: 'flex', alignItems: 'end', gap: 8, marginTop: 10}}>{[28,42,35,68,54,82,61,95,70,77,100,73,89,85].map((height, i) => <i key={i} style={{height: `${height}%`, flex: 1, background: T.steel, opacity: .75, borderRadius: '5px 5px 0 0'}} />)}</div></div>
      <div style={{width: 300, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18}}><div style={{color: T.steel, fontSize: 15}}>FEEDBACK INBOX</div><p style={{fontSize: 19}}>Map marker issue</p><p style={{fontSize: 19}}>New region request</p><div style={{color: T.green}}>● 12 resolved</div></div></div>
    <div style={{marginTop: 19, fontSize: 15, letterSpacing: '.12em', color: T.steel}}>QUIZ　 CHRONICLE　 FEEDBACK　 ANALYTICS　 SITE</div>
  </Panel>
</Base>;

export const FinaleScene = () => {
  const f = useCurrentFrame();
  const spin = interpolate(f, [0, 80, 140, 179], [-12, 9, 0, 0], {extrapolateRight: 'clamp'});
  const flash = interpolate(f, [0, 4, 10], [0, 0.9, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return <SceneFrame frame={f}><Header/><AbsoluteFill style={{display: 'grid', placeItems: 'center'}}><div style={{transform: `rotateY(${spin}deg)`, textAlign: 'center'}}><div style={{display: 'flex', justifyContent: 'center'}}><Logo size={88}/></div><div style={{fontFamily: serif, fontSize: 88, fontWeight: 700, marginTop: 38}}>All new. All Hero.</div><div style={{fontFamily: serif, color: T.amber, fontSize: 34, marginTop: 16}}>Studying, redefined.</div><div style={{fontSize: 20, color: T.muted, letterSpacing: '.12em', marginTop: 20}}>WHERE HISTORY HAPPENED</div></div></AbsoluteFill><AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}}/></SceneFrame>;
};
